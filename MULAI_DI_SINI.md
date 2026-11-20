# Panduan SATU ULTRAJAYA

Paket ini mengonversi proyek **Satu Ultrajaya (1).zip** untuk pencatatan laporan per line dan area kerja operator. Operator mengakses satu alamat HTTPS. Cloudflare menyajikan antarmuka dan Worker menjalankan API, dan Supabase menyimpan akun, laporan, riwayat persetujuan, serta materi pembelajaran.

Untuk workers.dev, mulai dari [panduan rilis Worker dan urutan migrasi](DEPLOY.md). Bagian pemasangan berikut berlaku bagi proyek Cloudflare Pages Direct Upload.

## Urutan pemasangan lewat Direct Upload

1. **Ekstrak ZIP utama** ke komputer. Berkas **01_UPLOAD_KE_CLOUDFLARE.zip** di dalamnya sudah siap diunggah. Biarkan ZIP kecil ini tetap terkompresi.
2. **Buat proyek Supabase Free** pada akun yang akan memegang data pilot. Catat Project URL, Publishable key dan Secret key dari pengaturan API keys. Password database dipakai untuk administrasi PostgreSQL. Aplikasi memakai key API.
3. **Pasang skema.** Buka SQL Editor → New query. Tempel seluruh isi **supabase/01_install.sql** lalu jalankan. Untuk materi dengan lampiran PDF, video, atau gambar, jalankan juga **supabase/03_lampiran.sql**. Untuk pembaruan dashboard antarperangkat, jalankan **supabase/04_dashboard_live.sql** pada proyek Supabase yang menyediakan Realtime. Bucket bernama `satu-private` harus bersifat private.
4. **Siapkan satu administrator.** Di Authentication → Sign In / Providers, aktifkan login email/password dan matikan **Allow new users to sign up**. Di Authentication → Users → Add user → Create new user, buat email teknis dengan bentuk `id-karyawan@login.satu.invalid` dan password kuat. Tandai **Auto Confirm User**. Contoh ID `admin-pilot` berarti email teknis `admin-pilot@login.satu.invalid`. Alamat ini dipakai sebagai pemetaan ID, tanpa pengiriman email. Di SQL Editor, buka **supabase/02_admin.sql**, ganti ID dan nama contoh sesuai akun tadi, lalu jalankan. Di aplikasi, kolom login diisi dengan **ID saja**.
5. **Buat Cloudflare Pages.** Di Cloudflare pilih Workers & Pages → Create application → Pages → Drag and drop / Direct Upload. Beri nama proyek, lalu pilih **01_UPLOAD_KE_CLOUDFLARE.zip** dan deploy. Arsip berisi `index.html` dan `_worker.js` di tingkat teratas. SQL, arsip sumber, hasil tes dan panduan disimpan terpisah dari bahan unggahan ini.
6. **Isi konfigurasi Production** pada proyek Pages → Settings → Variables and Secrets. Nama variabel dan ejaannya harus sesuai tabel di bawah. Simpan secret melalui pilihan **Encrypt/Secret**. Untuk lingkungan Preview yang akan digunakan, gunakan konfigurasi serta database uji terpisah.
7. **Deploy lagi ZIP yang sama** melalui Create deployment agar konfigurasi dan binding diterapkan. Buka alamat `https://nama-proyek.pages.dev` dari area pilot. Izinkan lokasi, kemudian login sebagai admin. Koordinat dan nama line harus sesuai area yang benar sebelum pengujian lapangan.
8. Buka **Area manajemen → + Karyawan**. Buat satu operator Filling dan satu pengawas Filling - Packing dengan ID berbeda. Tetapkan line keduanya dengan ejaan yang sama. Jika digunakan, hubungkan ID foreman dengan pengawas aktif sesuai [panduan penugasan](guides/LINE_PRODUKSI.md). Berikan kata sandi awal melalui saluran internal. Karyawan dapat menggantinya di Pengaturan. Admin dapat mereset kata sandi akun yang lupa.
9. **Uji putaran pertama** dengan data sintetis di situs Anda. Operator Filling membuat laporan pada area dan line tugas, menyimpan draf, membukanya kembali dan mengirimnya. Pengawas atau foreman Filling - Packing masuk dengan akun sendiri untuk meninjau laporan. Sesudah persetujuan, temukan status, parameter dan versi melalui Penelusuran data dan ekspor CSV. Untuk memeriksa tambahan angka produksi pada dashboard, siapkan Total Produksi memakai akun pengelola rekap dengan peninjau terpisah.

## Variabel runtime Cloudflare

| Nama | Nilai yang digunakan |
|---|---|
| `SUPABASE_URL` | Project URL dari Supabase, misalnya `https://PROJECTREF.supabase.co`, tanpa garis miring terakhir |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key proyek. Pasang pada konfigurasi Worker |
| `SUPABASE_SECRET_KEY` | Secret key proyek. Pilih Secret/Encrypt. Simpan hanya di server |
| `PILOT_LINE` | Line bawaan untuk peran yang mengizinkan fallback. Operator, pengawas dan foreman memerlukan penugasan line dan area eksplisit. Pertahankan kode historis ketika upgrade |
| `SITE_LAT` | Default server `-6.867190` |
| `SITE_LON` | Default server `107.513711` |
| `SITE_RADIUS_M` | Default server `200` meter |
| `GPS_MAX_ACCURACY_M` | Default server `60` meter. Verifikasi pada tablet yang digunakan di pabrik |
| `SITE_IP_ALLOWLIST` | Opsional. Daftar IP publik keluar perusahaan, dipisah koma, pencocokan per alamat persis. Kosongkan jika pilot hanya memeriksa GPS |
| Binding `AI` | Opsional. Pages Settings → Bindings → Workers AI, beri nama `AI` dan deploy kembali. Tanpa binding, AI Corner tetap menyediakan pencarian kutipan manual |

Konfigurasi yang tidak lengkap menahan login. Aturan lokasi memakai jarak ke pusat ditambah estimasi akurasi. Uji titik tengah, tepi area serta area luar pabrik pada perangkat aktual. Browser dapat meminta izin lokasi pada kunjungan pertama. Halaman login disajikan langsung dari domain Pages sehingga alur Apps Script dan pembungkus iframe lama sudah dilepas. Koordinat dari perangkat dapat dimanipulasi. Allowlist IP menambah pemeriksaan asal jaringan jika perusahaan memiliki jalur keluar yang stabil.

## Pemakaian di line

- **Report Production** mengelompokkan formulir menurut area. Kolom tanda bintang menunjukkan identitas atau nilai yang diperlukan. Draf dapat memuat bagian yang belum lengkap. Bagian jam menggunakan waktu server WIB. Operator dapat mengubah draf miliknya. Untuk koreksi laporan menunggu, peninjau di area dan line yang sesuai mengembalikan laporan dengan alasan. Operator memperbaiki dan mengirim ulang. Pengarsipan draf/revisi memerlukan alasan, dan admin dapat menelusuri arsip. Pengarsipan mempertahankan histori.
- **Proses Milk** memiliki satu record per masakan. Masakan 2–4 terbuka setelah masakan sebelumnya disetujui untuk tanggal dan line pasteurizer yang sama. Kolom cetak tetap ditempatkan pada posisi masakan terkait.
- **Filling** mempertahankan sepuluh jaw, 19 parameter per jam, sumber lot paper/strip, inspeksi pack, kontrol pengawas, kejadian dan CIP. Dua pemeriksaan visual per jam memakai V, X, atau =. Perawatan harian dan ketersediaan alat mengunci satu checklist lengkap per tanggal dan mesin.
- **Shift** untuk Sterilizer/Aseptic mengikuti 06.30, 14.30, dan 22.30 WIB. Filling menggunakan awal 06.00, 14.00 dan 22.00 serta irisan serah terima 30 menit. Entri per jam Filling, Sterilizer dan Aseptic memakai tanggal kalender setempat, termasuk slot 24 untuk pukul 00.00. Rekap per shift memakai tanggal awal shift malam. Filter tanggal dashboard dapat diperluas saat menelusuri peristiwa yang melintasi tengah malam.
- **Tracing Data** mencari kode persis, tanpa membedakan huruf besar dan kecil. Nilai batch, lot, SKU, unit, produk, reel dan lot material yang dipetakan dapat ditelusuri. Hasil tampil 25 per halaman. Ekspor CSV mengikuti seluruh halaman hasil filter yang aktif, mencakup identitas, jenis formulir, versi, status, bagian, slot, kode parameter, nilai dan satuan tersedia. Untuk unduhan besar, pilih rentang tanggal per shift atau hari. Cetak/PDF memakai data tersimpan dan mencantumkan status serta versi.
- **Dashboard** menghitung target/aktual/baik/reject dari Total Produksi. Isi satu rekap per shift, mesin, SKU, batch dan lot. Planned dan unplanned berasal dari klasifikasi yang dipilih pada Event Filling. Short stop ditambahkan ke unplanned. Catat suatu durasi sekali agar agregat tidak berlipat. Top Quality Issue memakai frekuensi kode pada entri kualitas yang disetujui. Saat indikator **Live antarperangkat** tampil, persetujuan pada perangkat lain memicu pemuatan angka terbaru. Dashboard juga mencocokkan ulang angka setiap 60 detik saat aktif. Kanal Realtime privat hanya membawa sinyal perubahan. Tanggal produksi dan rentang filter menggunakan WIB.
- **Education Corner** menampilkan lima kategori, lampiran privat, quiz, riwayat kunjungan, serta leaderboard berdasarkan durasi aktif. Saat tab aktif dan fokus, browser mengirim heartbeat per 30 detik. Nilai kuis minimal 70 untuk menandai modul berkuis selesai. Durasi aktif merupakan indikator penggunaan.
- **AI Corner** menelusuri teks manual yang diterbitkan. Masukkan kutipan, judul, dan revisi yang telah disetujui untuk audiens karyawan. Dengan binding Workers AI, chatbot dapat menyusun jawaban singkat, penjelasan bertahap atau perbandingan dengan rujukan manual. Empat pasangan tanya/jawab terakhir dapat menjadi konteks lanjutan selama halaman terbuka. Perbarui pengetahuan melalui revisi manual.
- **AI Camera** memakai izin kamera browser pada HTTPS. Buka pratinjau, ambil foto atau pilih gambar yang didukung, periksa gambar, lalu kirim untuk dinilai. Kamera mengirim gambar yang dipilih ketika pengguna menekan kirim. Pemeriksaan visual dapat menghasilkan **normal, abnormal atau tidak pasti** berdasarkan bagian yang tampak dan kecukupan rujukan. QC menjadikan hasil sebagai masukan inspeksi dan menetapkan keputusan produk. Model vision memerlukan binding AI, alokasi inferensi, dan persetujuan syarat model pada akun perusahaan.
- **Management Area** memungkinkan admin dan management mengelola pengumuman dan modul serta melihat direktori. Pendaftaran, perubahan peran, penonaktifan dan reset password karyawan khusus admin. Sistem menggunakan akun individu dan riwayat tindakan.
- **Pengaturan** memuat tema terang/gelap, kepadatan tabel dan perubahan kata sandi. Pilihan Indonesia/English berlaku untuk navigasi dan format angka/tanggal. Nama formulir dan materi mengikuti dokumen sumber.

## Apabila pemasangan tertahan

| Gejala | Pemeriksaan pertama |
|---|---|
| Halaman muncul, API gagal atau merespons HTML | Pastikan berkas unggahan adalah ZIP kecil, berisi `_worker.js` di akar dan bukan folder atau ZIP utama. Periksa variabel Production lalu deploy ulang |
| Pesan database belum siap | Jalankan seluruh `01_install.sql`, periksa Project URL, key dari proyek yang sama dan kondisi Supabase project |
| Login gagal setelah membuat user di Auth | Cocokkan email teknis huruf kecil, konfirmasi email dan cek profil aktif `satu.people` dengan UUID Auth yang sama |
| Lokasi ditolak dari kantor | Izinkan lokasi presisi untuk situs dan sistem operasi. Bandingkan titik pusat, akurasi, radius, serta IP publik keluar bila filter jaringan aktif |
| Dua perangkat mendapat konflik | Pertahankan tab berisi isian, buka riwayat versi terbaru di tab lain, lalu terapkan kembali perubahan yang relevan |
| Dashboard masih kosong | Periksa rentang tanggal, SKU/batch/lot di Total Produksi, dan apakah peninjau berwenang sudah menyetujui laporan |
| Lampiran gagal dibuka | Periksa `03_lampiran.sql`, jenis/ukuran berkas, kuota Storage, akses modul serta sesi login |
| Manual tidak menghasilkan jawaban | Terbitkan modul, aktifkan sumber manual, sertakan isi teks dan cari istilah yang ada di dokumen |

## Tautan resmi

- [Direct Upload Cloudflare Pages](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Advanced mode dan _worker.js](https://developers.cloudflare.com/pages/functions/advanced-mode/)
- [Pengaturan Supabase Auth](https://supabase.com/docs/guides/auth/general-configuration)
- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Kuota Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Kuota Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/)
- [Harga dan alokasi gratis Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)


Di AI Corner, pilih **Pengetahuan umum produksi** untuk pertanyaan pembelajaran, atau **Manual dan SOP pabrik** untuk jawaban dengan kutipan. Penilaian foto menggunakan kriteria visual dari manual.
