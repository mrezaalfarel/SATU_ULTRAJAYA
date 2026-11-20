"""Build the Cloudflare Pages directory and matching Direct Upload archive."""
import base64
import json
import shutil
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
ARCHIVE_NAME = "01_UPLOAD_KE_CLOUDFLARE.zip"
PRIVATE_TYPES = {
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".png": "image/png",
}


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def source(name):
    return (ROOT / "src" / name).read_text(encoding="utf-8")


def build():
    catalog = json.loads(source("catalog.json"))
    private_assets = {
        asset.name: [PRIVATE_TYPES[asset.suffix], base64.b64encode(asset.read_bytes()).decode("ascii")]
        for asset in sorted((ROOT / "src/private").iterdir()) if asset.is_file()
    }
    worker = "\n".join((
        f"const CATALOG={compact(catalog)};",
        f"const PRIVATE_ART={compact(private_assets)};",
        source("validation.js"), source("worker.js"),
    ))
    routes = {"version": 1, "include": ["/api/*", "/private/*", "/_worker.js"], "exclude": []}
    with tempfile.TemporaryDirectory(prefix=".satu-build-", dir=ROOT) as temp:
        stage = Path(temp)
        output = stage / "dist"
        shutil.copytree(ROOT / "pages", output)
        (output / "_worker.js").write_text(worker, encoding="utf-8")
        (output / "_routes.json").write_text(compact(routes), encoding="utf-8")
        (stage / "01_install.sql").write_text(source("schema.sql") + "\n" + source("services.sql"), encoding="utf-8")
        with zipfile.ZipFile(stage / ARCHIVE_NAME, "w") as archive:
            for asset in sorted(output.rglob("*")):
                if asset.is_file():
                    info = zipfile.ZipInfo(asset.relative_to(output).as_posix())
                    info.external_attr = 0o100644 << 16
                    archive.writestr(info, asset.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        if DIST.exists():
            DIST.rename(stage / "old-dist")
        output.rename(DIST)
        (stage / ARCHIVE_NAME).replace(ROOT / ARCHIVE_NAME)
        (stage / "01_install.sql").replace(ROOT / "supabase/01_install.sql")
    print(f"Cloudflare Pages: dist/, {ARCHIVE_NAME}, {len(catalog)} forms")


if __name__ == "__main__":
    build()
