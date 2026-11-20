# Portal karyawan SATU

## Laporan produksi

Buka **Laporan produksi** di sidebar, pilih area, lalu pilih kartu laporan. Kartu menampilkan formulir sesuai penugasan pengguna. Pada akun peninjau, kartu membuka antrean laporan yang menunggu persetujuan. Tombol **Semua area** membawa pengguna kembali ke pilihan area. Menu Supervisor mengelompokkan rekap Downtime dari kejadian yang disetujui, Total Produksi, dan DMS yang memakai formulir laporan harian pengawas.

## Tambah modul pembelajaran

1. Masuk sebagai admin atau management. Pilih **Pusat belajar → Tambah modul**.
2. Isi judul, kategori, revisi, dan isi materi. Lampiran opsional mendukung PDF, JPG, PNG, atau MP4 hingga 12 MiB.
3. Untuk kuis, pilih **Tambah pertanyaan**. Isikan pertanyaan, pilihan jawaban pada baris terpisah, dan nomor jawaban benar mulai dari 1. Kategori Mini Quiz memerlukan setidaknya satu soal.
4. Centang **Terbitkan modul**, lalu **Simpan modul**. Aktifkan opsi sumber manual untuk menerbitkan isi teks modul sebagai rujukan AI.

Kategori Tutorial juga menampilkan materi lama berjenis Book dan Video. Tab Mini Quiz menampilkan seluruh modul yang memiliki kuis. Pada leaderboard, jumlah akses menghitung pembukaan modul. Waktu baca merupakan estimasi saat halaman materi aktif dan memiliki fokus. Poin merupakan jumlah skor terbaik tiap modul dari 0 hingga 100. Perubahan soal atau revisi mengatur ulang skor modul sesuai aturan aplikasi.

## AI Corner

Ketik pesan atau gunakan tombol mikrofon untuk mendikte dalam bahasa Indonesia pada browser yang mendukung pengenalan suara. Periksa transkripsi sebelum mengirim. Pemrosesan suara mengikuti layanan pengenalan suara browser dan izin perangkat.

Dengan binding Workers AI aktif, tombol **＋** menyediakan pilihan dokumen teks TXT, MD atau CSV (maksimal 48 KB dan 12.000 karakter), foto JPG/PNG (maksimal 1 MiB), serta kamera. Foto dapat diperiksa sebelum dikirim. Dokumen menjadi konteks percakapan ketika pengguna menekan **Kirim**. Pemeriksaan visual tetap memerlukan konfirmasi QC.

## Pemasangan

Ikuti panduan rilis di DEPLOY.md. Uji versi supabase/01_install.sql dari cabang ini pada salinan database sebelum menerapkannya pada database tujuan. Pasang SQL sebelum deployment aplikasi agar kategori, peringkat poin, dan pencatatan waktu membaca tersedia bersamaan.
