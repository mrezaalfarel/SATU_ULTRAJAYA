# Rilis SATU ULTRAJAYA

Tujuan utama rilis ini adalah **Cloudflare Workers pada workers.dev** dengan aset statis, build dari repositori GitHub, serta database, Auth, Storage, dan Realtime di Supabase. Paket juga mendukung Cloudflare Pages untuk instalasi yang telah memakai Pages. Pilih jalur deploy sesuai host yang digunakan karyawan.

## Terapkan SQL lebih dulu

1. Identifikasi deployment dan commit yang sedang aktif. Untuk instalasi lama, catat kode line yang tersimpan, jumlah laporan per status dan line, versi laporan contoh, akun serta lampiran contoh. Salin database, objek Storage, konfigurasi dan SQL versi lama sesuai prosedur IT. Pulihkan salinan pada proyek uji dan buka kembali data contoh. Pastikan identitas Auth dapat dipulihkan bersama profil aplikasi. [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
2. Untuk pemasangan baru, siapkan proyek Supabase dan nonaktifkan pendaftaran publik. Jalankan **supabase/01_install.sql** lengkap melalui SQL Editor. Buat akun admin terkonfirmasi di Supabase Auth, sesuaikan dua nilai contoh pada **02_admin.sql**, lalu jalankan. Untuk upgrade akun/admin yang sudah ada, cukup terapkan **01_install.sql** versi rilis pada salinan uji dahulu.
3. Terapkan **03_lampiran.sql** untuk bucket privat dan **04_dashboard_live.sql** untuk sinyal Realtime. Uji login, akses line/area, pengarsipan draf, status dan versi pada tracing, persetujuan independen, dan pembukaan lampiran lama. Bandingkan hasil dengan inventaris awal. [Panduan penugasan](guides/LINE_PRODUKSI.md)
4. Saat staging lulus, jadwalkan jendela perpindahan dengan pengawas shift. Aktifkan prosedur pencatatan cadangan, selesaikan transaksi yang sedang berjalan, lalu terapkan SQL rilis ke proyek tujuan **sebelum menjalankan deployment aplikasi**. Cegah deploy otomatis saat perubahan database masih berlangsung. Selanjutnya pasang Worker dari commit yang sama, periksa akun lama melalui Area manajemen, uji satu alur produksi pada line pertama, lalu buka akses operator. Jalankan migrasi pada proyek yang sama agar identitas laporan, versi, histori, dan tautan objek tetap utuh.

### Pemeriksaan SQL sesudah upgrade

Bandingkan rekap jumlah dan versi sebelum serta sesudah migrasi selama jendela perubahan. Jalankan pada SQL Editor internal.

```sql
select line, type, status, count(*) as jumlah, sum(version) as jumlah_versi
from satu.reports
group by line, type, status
order by line, type, status;
```

Sesudah `01_install.sql`, kueri berikut mencari akun produksi aktif yang belum mendapat formulir. Opsi pemeriksaan ini membaca penugasan yang berlaku pada versi SQL rilis.

```sql
select p.employee, p.role, p.work_area, p.production_lines
from satu.people as p
where p.active
  and p.role in ('operator', 'pengawas', 'foreman')
  and cardinality(satu.allowed_forms(p)) = 0
order by p.role, p.employee;
```

Admin meninjau hasil bersama PIC shift. Tetapkan line dan area kepada orang yang akan bertugas. Pindahkan atau nonaktifkan foreman yang masih ditugaskan sebelum mengubah pengawasnya. Nonaktifkan akun yang telah berhenti bertugas melalui Area manajemen. Simpan profil dan ID historis agar identitas pembuat serta persetujuan pada laporan lama tetap dapat ditelusuri. Setelah penugasan disimpan, masuk kembali dengan akun yang diperbarui. Uji supervisor dan tiap foreman di satu line yang diizinkan, lalu periksa bahwa laporan dari area lain tidak tersedia.

## Workers pada workers.dev

1. Dari akar repositori jalankan `npm ci --include=dev`, `python3 src/build.py`, dan `npm test`. `wrangler.json` menunjuk `dist/_worker.js` sebagai entry point dan `pages/` untuk static assets dengan binding `ASSETS`. Cloudflare menjalankan Worker lebih dulu untuk API dan template privat.
2. Buka **Workers & Pages → proyek Worker → Settings → Builds** dan hubungkan repositori privat milik perusahaan serta branch produksi yang benar. Untuk build gunakan `npm ci --include=dev && python3 src/build.py && npm test`. Untuk deploy gunakan `npx --yes wrangler@4.76.0 deploy`. Untuk deploy melalui CLI, jalankan perintah deploy yang sama dari checkout rilis setelah tes lulus dengan kredensial akun Cloudflare yang berwenang. Periksa nama Worker dalam konfigurasi terhadap nama layanan yang sebenarnya. [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) · [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
3. Isi URL proyek Supabase dan publishable key pada variabel runtime, lalu simpan **SUPABASE_SECRET_KEY** sebagai secret Worker. Pastikan kode `PILOT_LINE`, konfigurasi GPS, dan IP sesuai area kerja. Gunakan proyek/Worker staging dan akun uji yang terpisah dari produksi. Atur binding **Workers AI** bernama **AI** untuk fitur generatif. Konfigurasi Wrangler paket ini sudah menyertakan `"ai": { "binding": "AI" }`. Periksa daftar binding aktif setelah deploy. Pada akun baru, selesaikan ketentuan model vision melalui mekanisme persetujuan resmi untuk akun tersebut. Binding dan secret diperlukan pada layanan yang benar-benar melayani pengguna. [Cloudflare Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/) · [Variabel aplikasi](MULAI_DI_SINI.md)
4. Di **Deployments**, cocokkan commit/versi aktif dan buka URL yang tertera pada **Domains & Routes**. Periksa login melalui HTTPS dan jalankan skenario penerimaan di bagian bawah. Status build sukses baru membuktikan terbitnya aplikasi.

## Alternatif untuk instalasi Cloudflare Pages

| Jalur | Pengaturan |
|---|---|
| Pages dengan Git | **Create application → Pages → Connect to Git**. Gunakan repositori privat, production branch `main` jika sesuai, preset **None**, root direktori proyek, build `python3 src/build.py && npm test`, output `dist`, dan Node 22+ dengan devDependencies. Isi runtime variables, secrets dan binding AI di **Settings** per lingkungan. Hubungkan Preview ke Supabase staging. [Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) |
| Pages Direct Upload manual | Buka **Create deployment** pada proyek Pages tujuan dan unggah **01_UPLOAD_KE_CLOUDFLARE.zip**. Di akar arsip terdapat `index.html`, `_worker.js`, dan `_routes.json`. [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) |
| Pages Direct Upload dari GitHub | Pada repo privat, sertakan `.github/workflows/pages-direct.yml`. Atur secret `CLOUDFLARE_API_TOKEN` dengan izin **Cloudflare Pages · Edit** untuk akun tujuan. Atur variables `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT` dan bila perlu `CF_PAGES_PRODUCTION_BRANCH`. Aktifkan `PAGES_DIRECT_UPLOAD=true` setelah SQL terpasang. Workflow berjalan dari branch `main`. Biarkan opsi ini nonaktif untuk deployment utama Workers. [CI Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) |

## Penerimaan di pabrik

| Pemeriksaan | Bukti yang dicatat oleh PIC |
|---|---|
| Akun & lokasi | Uji di perangkat terkelola, di tengah dan tepi radius pabrik serta di luar area. Periksa login dengan jaringan yang diizinkan. Uji setiap area operator, relasi foreman, pengawas lintas line, dan penolakan akses laporan di luar kewenangan. |
| Transaksi | Buat draf, ubah, simpan, coba kirim ulang setelah Wi-Fi putus, arsipkan draf uji dengan alasan. Buat laporan berikutnya, kirim, minta revisi, perbaiki dan setujui dengan peninjau berbeda. Pada tracing serta ekspor periksa status, parameter dan versi sesuai riwayat. Uji hasil filter melebihi 25 laporan. |
| Dashboard | Catat baseline pada dua perangkat. Dengan akun yang berwenang, buat Total Produksi sintetis berisi aktual 100, baik 97, reject 3 di staging. Setelah persetujuan, periksa kenaikan 100/97/3 dan ukur jeda tampil pada perangkat kedua. Periksa planned/unplanned dengan kejadian yang durasinya diketahui. Ulangi pada waktu pergantian shift. |
| LMS & AI | Uji pengumuman, lampiran privat, quiz, jawaban dari manual dengan revisi yang benar, serta pertanyaan lanjutan. Uji kamera di tablet melalui HTTPS dengan izin pengguna dan kuota AI tersedia. Uji contoh kemasan normal, cacat, dan foto buram bersama QC. Pastikan penilaian visual dapat mengembalikan hasil tidak pasti. [Ketentuan akses model vision](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/) |
| Kesiapan operasi | Cocokkan shift WIB dan hasil cetak terhadap revisi formulir terkendali. Catat p95 simpan, p95 perubahan dashboard, kuota Worker/AI, ukuran database dan kapasitas lampiran per shift. Tetapkan PIC gangguan serta cara merekonsiliasi catatan cadangan. |

Buka line pertama setelah PIC produksi, QC, dan IT menyelesaikan pengecekan lapangan. Pisahkan hasil uji lokal dari bukti akun hosted. [Panduan verifikasi](guides/VERIFIKASI_RILIS.md)

## Pemulihan

Catat waktu insiden dan versi yang bermasalah. Jeda deployment otomatis, alihkan pencatatan ke prosedur cadangan shift, dan simpan jejak transaksi yang perlu direkonsiliasi. Pada **Workers → Deployments**, kembalikan versi aplikasi terakhir yang kompatibel dengan skema aktif. Untuk Pages gunakan **Rollback to this deployment**. Pastikan konfigurasi binding dan izin pada versi pemulihan cocok dengan layanan tujuan. [Workers Rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/) · [Pages Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)

Rollback aplikasi tidak mengembalikan data dan peran di Supabase. Jika perlu menyesuaikan SQL, gunakan migrasi korektif yang telah diuji. Untuk pemulihan yang membutuhkan backup, pulihkan ke proyek terisolasi, rekonsiliasi laporan dan lampiran setelah waktu backup bersama pengawas, lalu putuskan pengalihan. Pertahankan salinan pascainsiden agar catatan produksi terbaru dapat dipulihkan. Aktifkan kembali deployment otomatis setelah uji akun, simpan, tracing dan persetujuan lulus pada versi pemulihan.
