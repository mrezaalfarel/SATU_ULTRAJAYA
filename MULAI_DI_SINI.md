# SATU ULTRAJAYA untuk Cloudflare Pages

Paket ini mengonversi proyek **Satu Ultrajaya (1).zip** untuk pencatatan laporan per line dan area kerja operator. Operator mengakses satu alamat HTTPS. Cloudflare Pages menyajikan antarmuka, Pages Worker menjalankan API, dan Supabase menyimpan akun, laporan, riwayat persetujuan, serta materi pembelajaran.

Gunakan [panduan rilis](DEPLOY.md) untuk integrasi GitHub, konfigurasi Preview dan Production, upgrade pilot, serta uji penerimaan di pabrik.

## Urutan pemasangan lewat Direct Upload

1. **Ekstrak ZIP utama** ke komputer. Berkas **01_UPLOAD_KE_CLOUDFLARE.zip** di dalamnya sudah siap diunggah. Biarkan ZIP kecil ini tetap terkompresi.
2. **Buat proyek Supabase Free** pada akun yang akan memegang data pilot. Catat Project URL, Publishable key dan Secret key dari pengaturan API keys. Password database dipakai untuk administrasi PostgreSQL. Aplikasi memakai key API.
3. **Pasang skema.** Buka SQL Editor → New query. Tempel seluruh isi **supabase/01_install.sql** lalu jalankan. Untuk materi dengan lampiran PDF, video, atau gambar, jalankan juga **supabase/03_lampiran.sql**. Untuk pembaruan dashboard antarperangkat, jalankan **supabase/04_dashboard_live.sql** pada proyek Supabase yang menyediakan Realtime. Bucket bernama `satu-private` harus bersifat private.
4. **Siapkan satu administrator.** Di Authentication → Sign In / Providers, aktifkan login email/password dan matikan **Allow new users to sign up**. Di Authentication → Users → Add user → Create new user, buat email teknis dengan bentuk `id-karyawan@login.satu.invalid` dan password kuat. Tandai **Auto Confirm User**. Contoh ID `admin-pilot` berarti email teknis `admin-pilot@login.satu.invalid`. Alamat ini dipakai sebagai pemetaan ID, tanpa pengiriman email. Di SQL Editor, buka **supabase/02_admin.sql**, ganti ID dan nama contoh sesuai akun tadi, lalu jalankan. Di aplikasi, kolom login diisi dengan **ID saja**.
5. **Buat Cloudflare Pages.** Di Cloudflare pilih Workers & Pages → Create application → Pages → Drag and drop / Direct Upload. Beri nama proyek, lalu pilih **01_UPLOAD_KE_CLOUDFLARE.zip** dan deploy. Arsip berisi `index.html` dan `_worker.js` di tingkat teratas. SQL, arsip sumber, hasil tes dan panduan disimpan terpisah dari bahan unggahan ini.
6. **Isi konfigurasi Production** pada proyek Pages → Settings → Variables and Secrets. Nama variabel dan ejaannya harus sesuai tabel di bawah. Simpan secret melalui pilihan **Encrypt/Secret**. Untuk lingkungan Preview yang akan digunakan, gunakan konfigurasi serta database uji terpisah.
7. **Deploy lagi ZIP yang sama** melalui Create deployment agar konfigurasi dan binding diterapkan. Buka alamat `https://nama-proyek.pages.dev` dari area pilot. Izinkan lokasi, kemudian login sebagai admin. Koordinat dan nama line harus sesuai area yang benar sebelum pengujian lapangan.
8. Buka **Area manajemen → + Karyawan**. Buat satu operator dan satu pengawas dengan ID berbeda. Tetapkan line keduanya dengan ejaan yang sama dan pilih area kerja operator sesuai [panduan penugasan](guides/LINE_PRODUKSI.md). Berikan kata sandi awal melalui saluran internal. Karyawan dapat menggantinya di Pengaturan. Admin dapat mereset kata sandi akun yang lupa.
9. **Uji putaran pertama** dengan data sintetis di situs Anda. Operator membuat Total Produksi, mengisi mesin, SKU, batch, lot, target 120, aktual 100, produk baik 97 dan reject 3. Simpan draf, buka lagi, lalu kirim ke pengawas. Tracing Data menampilkan status menunggu persetujuan. Pengawas masuk dengan akun sendiri dan menyetujui. Dashboard untuk rentang tanggal itu seharusnya bertambah 100 aktual, 97 baik, dan 3 reject. Pencarian lot harus membuka laporan dan riwayatnya.

## Variabel Pages

| Nama | Nilai yang digunakan |
|---|---|
| `SUPABASE_URL` | Project URL dari Supabase, misalnya `https://PROJECTREF.supabase.co`, tanpa garis miring terakhir |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key proyek. Pasang pada konfigurasi Worker |
| `SUPABASE_SECRET_KEY` | Secret key proyek. Pilih Secret/Encrypt. Simpan hanya di server |
| `PILOT_LINE` | Line bawaan bagi akun tanpa penugasan eksplisit. Nilai awal Produksi. Untuk upgrade, pertahankan kode historis |
| `SITE_LAT` | Default server `-6.867190` |
| `SITE_LON` | Default server `107.513711` |
| `SITE_RADIUS_M` | Default server `200` meter |
| `GPS_MAX_ACCURACY_M` | Default server `60` meter. Verifikasi pada tablet yang digunakan di pabrik |
| `SITE_IP_ALLOWLIST` | Opsional. Daftar IP publik keluar perusahaan, dipisah koma, pencocokan per alamat persis. Kosongkan jika pilot hanya memeriksa GPS |
| Binding `AI` | Opsional. Pages Settings → Bindings → Workers AI, beri nama `AI` dan deploy kembali. Tanpa binding, AI Corner tetap menyediakan pencarian kutipan manual |

Konfigurasi yang tidak lengkap menahan login. Aturan lokasi memakai jarak ke pusat ditambah estimasi akurasi. Uji titik tengah, tepi area serta area luar pabrik pada perangkat aktual. Browser dapat meminta izin lokasi pada kunjungan pertama. Halaman login disajikan langsung dari domain Pages sehingga alur Apps Script dan pembungkus iframe lama sudah dilepas. Koordinat dari perangkat dapat dimanipulasi. Allowlist IP menambah pemeriksaan asal jaringan jika perusahaan memiliki jalur keluar yang stabil.

## Pemakaian di line

- **Report Production** mengelompokkan formulir menurut area. Kolom tanda bintang menunjukkan identitas atau nilai yang diperlukan. Draf dapat memuat bagian yang belum lengkap. Bagian jam menggunakan waktu server WIB. Pengawas dapat memperbaiki isian jam yang terlewat pada draf tersimpan dengan alasan tertulis di riwayat. Pengawas yang mengedit memerlukan peninjau lain untuk persetujuan akhir. Untuk koreksi laporan menunggu, pengawas mengembalikannya disertai alasan.
- **Proses Milk** memiliki satu record per masakan. Masakan 2–4 terbuka setelah masakan sebelumnya disetujui untuk tanggal dan line pasteurizer yang sama. Kolom cetak tetap ditempatkan pada posisi masakan terkait.
- **Filling** mempertahankan sepuluh jaw, 19 parameter per jam, sumber lot paper/strip, inspeksi pack, kontrol pengawas, kejadian dan CIP. Dua pemeriksaan visual per jam memakai V, X, atau =. Perawatan harian dan ketersediaan alat mengunci satu checklist lengkap per tanggal dan mesin.
- **Shift** untuk Sterilizer/Aseptic mengikuti 06.30, 14.30, dan 22.30 WIB. Filling menggunakan awal 06.00, 14.00 dan 22.00 serta irisan serah terima 30 menit. Entri per jam Filling, Sterilizer dan Aseptic memakai tanggal kalender setempat, termasuk slot 24 untuk pukul 00.00. Rekap per shift memakai tanggal awal shift malam. Filter tanggal dashboard dapat diperluas saat menelusuri peristiwa yang melintasi tengah malam.
- **Tracing Data** mencari kode persis, tanpa membedakan huruf besar dan kecil. Nilai batch, lot, SKU, unit, produk, reel dan lot material yang dipetakan dapat ditelusuri. Hasil tampil 25 per halaman. Ekspor CSV memuat hasil yang telah ditampilkan. Cetak/PDF memakai data tersimpan dan mencantumkan status serta versi.
- **Dashboard** menghitung target/aktual/baik/reject dari Total Produksi. Isi satu rekap per shift, mesin, SKU, batch dan lot. Planned dan unplanned berasal dari klasifikasi yang dipilih pada Event Filling. Short stop ditambahkan ke unplanned. Catat suatu durasi sekali agar agregat tidak berlipat. Top Quality Issue memakai frekuensi kode pada entri kualitas yang disetujui. Saat indikator **Live antarperangkat** tampil, persetujuan pada perangkat lain memicu pemuatan angka terbaru. Dashboard juga mencocokkan ulang angka setiap 60 detik saat aktif. Kanal Realtime privat hanya membawa sinyal perubahan. Tanggal produksi dan rentang filter menggunakan WIB.
- **Education Corner** menampilkan lima kategori, lampiran privat, quiz, riwayat kunjungan, serta leaderboard berdasarkan durasi aktif. Saat tab aktif dan fokus, browser mengirim heartbeat per 30 detik. Nilai kuis minimal 70 untuk menandai modul berkuis selesai. Durasi aktif merupakan indikator penggunaan.
- **AI Corner** mencari teks manual yang ditandai pengelola. Masukkan kutipan yang boleh diakses oleh seluruh karyawan pilot, judul dan revisinya. Lampirkan manual jika perlu. Pengindeksan memakai kolom teks. Dengan binding AI, kutipan dapat dirangkum dan foto JPEG/PNG hingga 1 MiB dapat dikirim ke Workers AI. Observasi foto perlu diperiksa QC sebelum dipakai untuk keputusan produk. Pembaruan pengetahuan dilakukan dengan menerbitkan revisi manual. Pertanyaan pengguna tidak otomatis menjadi materi pelatihan.
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
| Dashboard masih kosong | Periksa rentang tanggal, SKU/batch/lot di Total Produksi, dan apakah pengawas lain sudah menyetujui laporan |
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

