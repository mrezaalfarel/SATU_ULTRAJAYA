# Rilis SATU ULTRAJAYA di Cloudflare Pages

Paket sumber digunakan oleh tim IT. Berkas ZIP Direct Upload di dalamnya hanya memuat hasil build yang akan dijalankan di Pages. Pengisian laporan, akun, lampiran, dan sinyal dashboard menggunakan proyek Supabase. Menautkan GitHub membuat pembaruan kode berjalan otomatis. Terapkan perubahan database secara terpisah di lingkungan yang benar.

## Proyek baru dengan GitHub

1. Ekstrak paket sumber. Simpan isinya di repositori GitHub privat milik perusahaan. Letakkan `package.json`, `package-lock.json`, `src/`, `supabase/`, `pages/`, dan `tests/` di akar repositori. Sertakan `.gitignore`. Paket sumber memuat koordinat pabrik dan template formulir internal. Simpan repo sebagai privat. Isi secret di dashboard Cloudflare dan gunakan data sintetis di Preview.
2. Pilih **Cloudflare → Workers & Pages → Create application → Pages → Connect to Git**. Hubungkan repositori tersebut. Pilih **main** sebagai production branch. Gunakan pengaturan berikut.
   
   | Pengaturan Pages | Nilai |
   |---|---|
   | Framework preset | None |
   | Root directory | Kosong untuk repo di atas |
   | Build command | `python3 src/build.py && npm test` |
   | Build output directory | `dist` |
   | Build environment | Node.js 22 atau lebih baru, Python 3, devDependencies npm terpasang |

   Instalasi dependensi bawaan Pages memakai lockfile. Jika mengatur versi sendiri, tetapkan `NODE_VERSION=22` di lingkungan build. Build menghasilkan Worker, aturan rute, antarmuka dan SQL. Ketika tes gagal, periksa log build sebelum mempromosikan perubahan. [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
3. Di **Settings → Variables and Secrets**, pasang `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `PILOT_LINE`, `SITE_LAT`, `SITE_LON`, `SITE_RADIUS_M`, dan `GPS_MAX_ACCURACY_M`. Pasang `SUPABASE_SECRET_KEY` sebagai **secret**. `SITE_IP_ALLOWLIST` dapat diisi dengan IP publik keluar pabrik. Binding `AI` mengaktifkan pemanggilan Workers AI. Rilis memakai titik pabrik −6.867190, 107.513711 dan radius 200 m sebagai nilai bawaan di Worker. Ambang akurasi GPS awal 60 m dapat diubah dari konfigurasi. Jarak ke pusat ditambah estimasi ketidakpastian GPS harus masuk radius 200 m. Uji di dalam gedung serta di tepi area. [Panduan variabel aplikasi](MULAI_DI_SINI.md)
4. Isi **Preview** dan **Production** secara terpisah. Hubungkan Preview ke Supabase uji. Preview deployments Cloudflare dapat diakses melalui URL preview, sehingga perusahaan dapat menerapkan Cloudflare Access pada preview untuk membatasi akses. Setelah mengatur variabel/binding, deploy ulang. [Cloudflare Preview Deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
5. Gunakan pull request untuk menguji perubahan dengan data sintetis. Setelah UAT dan penerapan SQL di bawah, gabungkan commit yang telah diuji ke `main`. Lihat status **Success** serta commit SHA pada tab **Deployments**.

## Proyek yang sudah memakai Direct Upload

Proyek Direct Upload menggunakan mekanisme deploy yang dipilih saat dibuat. Untuk mempertahankan URL yang sama, gunakan salah satu dari dua cara berikut. [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

- **Sekali unggah dari dashboard.** Pilih **Create deployment**, lalu unggah `01_UPLOAD_KE_CLOUDFLARE.zip`. Pastikan `_worker.js` dan `index.html` berada di akar arsip.
- **Otomatis dari GitHub Actions.** Sertakan `.github/workflows/pages-direct.yml` dan lockfile dalam repositori privat. Di GitHub **Settings → Secrets and variables → Actions**, isi secret `CLOUDFLARE_API_TOKEN` menggunakan token Cloudflare dengan izin akun **Cloudflare Pages · Edit** pada akun tujuan. Isi variables `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT` (nama proyek persis), serta `CF_PAGES_PRODUCTION_BRANCH` bila nama cabang produksi di Pages berbeda dari `main`. Setelah staging dan persiapan SQL selesai, tetapkan `PAGES_DIRECT_UPLOAD=true`. Push ke `main` atau jalankan **Pages Direct Upload** dari tab Actions pada branch `main`. Workflow memasang dependensi, membangun, menguji, lalu menerbitkan direktori `dist` melalui Wrangler. Untuk proyek Git-integrated, biarkan variabel pengaktif workflow kosong agar tiap commit hanya diterbitkan sekali. [CI untuk Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)

Untuk mereproduksi hasil di komputer pengembang gunakan Node.js 22+, Python 3 dan perintah berikut dari akar proyek.

```sh
npm ci --include=dev
python3 src/build.py
npm test
npm run test:size
```

Jika menggunakan analisis foto, aktifkan binding Workers AI serta selesaikan ketentuan akses model vision pada akun perusahaan. Selama model belum aktif, uji pencarian kutipan manual. Keputusan kualitas produk tetap memerlukan verifikasi QC. [Cloudflare vision model](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/)

## Menyiapkan Supabase

| Kondisi | Tindakan |
|---|---|
| Proyek baru | Jalankan `supabase/01_install.sql`. Buat satu akun admin di Auth dan sesuaikan `supabase/02_admin.sql` dengan ID serta nama admin. Nonaktifkan pendaftaran publik dan gunakan akun individu. Tahapan akun ada di [panduan awal](MULAI_DI_SINI.md). |
| Upgrade pilot yang telah dipakai | Tetapkan waktu perubahan, tuntaskan draf aktif dan catat versi Pages serta commit aktif. Ambil salinan database, objek Storage, konfigurasi dan SQL versi sebelumnya. Coba pemulihan di lingkungan terisolasi, termasuk login akun uji, jumlah laporan serta pembukaan lampiran. Uji terlebih dulu penerapan `01_install.sql` baru pada salinan pilot. Saat siap, terapkan file yang sama pada proyek tujuan. Skrip `02_admin.sql` hanya untuk bootstrap. |
| Lampiran dan dashboard antarperangkat | Terapkan `supabase/03_lampiran.sql`, lalu `supabase/04_dashboard_live.sql`. Pastikan bucket `satu-private` bersifat privat. Uji unggah dan unduh lampiran serta pembaruan dashboard via dua akun. |
| Instalasi lintas line | Pertahankan kode `PILOT_LINE` historis. Tetapkan hak akses line sesuai [panduan penugasan](guides/LINE_PRODUKSI.md), kemudian uji akun operator dan pengawas setiap line. |

Database backup dan file Storage perlu dicadangkan secara terpisah. Verifikasi bahwa strategi pemulihan yang dipilih IT mencakup identitas Auth dan keterkaitannya dengan profil karyawan. Jika skrip inti gagal, baca kesalahan transaksi di SQL Editor dan perbaiki pada salinan staging sebelum meneruskan ke produksi. [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)

## Keputusan pembukaan line

Lakukan UAT di tablet dan jaringan pabrik. Catat tanggal, line, versi aplikasi, peran penguji, hasil aktual serta nama PIC shift.

| Skenario | Hasil penerimaan pada lingkungan target |
|---|---|
| Akses | Perangkat yang memenuhi kebijakan lokasi/jaringan dapat login. Percobaan di luar area dan akun nonaktif ditolak. Pastikan operator hanya melihat fungsi dan line yang ditugaskan. |
| Satu siklus shift | Operator mengisi laporan, simpan draf, buka kembali, kirim. Pengawas berbeda menyetujui. QC dapat membuka laporan dan riwayat lewat batch/lot. Uji shift melewati tengah malam dan pencetakan. Cocokkan parameter serta hasil cetak dengan SOP/revisi yang berlaku. |
| Rekap dan live | Di staging, catat angka dasar dashboard. Kirim satu Total Produksi sintetis berisi aktual 100, baik 97, reject 3. Setelah persetujuan, perangkat kedua menampilkan penambahan tepat 100/97/3. Uji planned/unplanned pada satu kejadian dan cocokkan menit dengan catatan sumber. |
| Gangguan | Coba kirim ulang setelah Wi-Fi terputus dan edit bersamaan pada dua perangkat. Cocokkan jumlah laporan, jejak versi, waktu simpan dan waktu pembaruan. Ulangi pada jam serah terima dengan jumlah pengguna yang ditargetkan. |
| Menu pendukung | Uji pengumuman, perubahan akun, publikasi modul, kuis dan lampiran privat dari dua peran. Uji pencarian manual beserta rujukan revisi. Jika AI digunakan, periksa respons pada akun layanan dan verifikasi observasi foto bersama QC. |
| Operasional | IT menilai hasil uji pemulihan, ruang database, egress, pesan Realtime, permintaan Worker serta pemakaian AI berdasarkan trafik shift. Pengawas dan QC menyepakati perangkat, PIC gangguan dan prosedur pencatatan saat layanan terputus. |

Jika transaksi ganda, kebocoran lingkup line, hasil rekap keliru, atau pemulihan gagal ditemukan, tangguhkan pembukaan line terkait sampai reproduksi, perbaikan, dan pengujian ulang selesai. Untuk insiden setelah pembukaan shift, alihkan pencatatan ke prosedur cadangan milik pabrik dan simpan identitas transaksi yang perlu direkonsiliasi.

## Mengembalikan versi aplikasi

1. Catat waktu insiden, SHA dan ID deployment. Hentikan rilis otomatis sementara agar build berikutnya tidak menimpa pemulihan.
2. Jika versi database kompatibel, gunakan **Pages → Deployments → Rollback to this deployment** untuk versi produksi terakhir yang lolos UAT. Periksa kembali bindings, login, tracing, dan simpan draf pada lingkungan target. [Cloudflare Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
3. Rollback Pages hanya mengembalikan aplikasi. Bila skema atau data ikut terdampak, siapkan perbaikan SQL atau pulihkan backup ke proyek terisolasi terlebih dahulu. Cocokkan transaksi dan lampiran sejak waktu backup bersama pemilik data sebelum pengalihan. Pertahankan salinan data pascainsiden supaya laporan shift dapat direkonsiliasi.
4. Kembalikan perbaikan atau revert commit ke branch produksi dan aktifkan lagi deployment otomatis setelah verifikasi.
