# Verifikasi rilis SATU ULTRAJAYA

## Pemeriksaan migrasi lokal

SQL rilis sebelumnya (19 November 2026) dipasang pada PostgreSQL lokal PGlite. Satu laporan sintetis yang disetujui, tiga entri histori, dan satu operator berlabel Aseptic Tank disiapkan sebelum memasang ulang SQL kandidat sebanyak dua kali. ID, isi laporan, versi, status, pembuat, serta jumlah histori cocok dengan data sebelum migrasi. Operator tetap memiliki line historis dan mendapatkan tiga formulir Sterilizer - Aseptic Tank. Pemeriksaan satu sampel ini melengkapi uji pemulihan dan penerimaan pada salinan instalasi perusahaan.

Perintah Wrangler `deploy --dry-run` berhasil membangun Worker dengan binding ASSETS dan AI. Ketersediaan model, persetujuan syarat pada akun, kuota dan kualitas inferensi diperiksa di lingkungan target.

## Pemeriksaan yang dapat diulang

Gunakan checkout dan SQL dari versi yang sama. Dari akar proyek, jalankan `npm ci`, `python3 src/build.py`, `npm test`, `npm run test:size`, dan `npm run test:browser`. Uji browser menggunakan Chromium, Worker hasil build dan data sintetis. Catat commit, waktu, penanggung jawab, log serta hasil setiap pemeriksaan sebelum menandai versi lulus. [Prosedur deploy dan pemulihan](../DEPLOY.md)

| Bidang | Periksa pada kandidat rilis |
|---|---|
| Peran dan area | Operator Filling memiliki 5 formulir, Sterilizer - Aseptic Tank 3, Proses 2, Packing 2. Foreman mempunyai pengawas aktif pada area yang sama dan line yang mencakup penugasannya. Uji penolakan foreman aktif kelima, penugasan tak cocok serta akses ke line atau formulir di luar area. |
| Tinjauan dan riwayat | Operator mengisi draf, menyimpan perubahan dan mengirim. Foreman atau pengawas area meninjau, mengembalikan dengan alasan, lalu menyetujui revisi. Uji konflik versi, kirim ulang dan penolakan peninjau yang pernah mengisi atau mengirim. Arsip draf/revisi menyimpan alasan dan histori. |
| Ekspor | Gunakan filter dengan lebih dari 25 hasil lintas tanggal/shift di line yang sama. Cocokkan jumlah ID laporan unik, status, versi dan parameter pada CSV dengan seluruh hasil filter, termasuk halaman lanjutan. Uji pembatalan unduhan dan periksa pembatasan akses pada akun area berbeda. |
| Browser dan laporan | Login dengan GPS sintetis, navigasi ponsel, simpan dan buka kembali, periksa rekap dashboard, telusuri lot, serta cetak contoh tiap jenis latar. Periksa hasil fisik di printer line dan revisi isian bersama pemilik SOP. |
| AI dan kamera | Uji jawaban singkat, pertanyaan majemuk, pertanyaan lanjutan dan rujukan yang kurang. Dengan binding aktif, uji foto kemasan normal, cacat dan tidak jelas serta penolakan akses kamera. Uji kamera dan model hosted memerlukan perangkat serta akun target. |
| Dashboard, LMS, volume | Verifikasi persetujuan melalui dua perangkat berbeda, angka terkini per line, lampiran privat dan kuis. `test:size` mengisi 5.000 laporan × 8 slot × 25 nilai sintetis. Ukuran skema, indeks, dan rencana pencarian pada sampel lokal tersedia di HASIL_UJI_KAPASITAS.json. |

## Pencatatan penerimaan

| Lingkungan | Versi dan waktu WIB | PIC | Bukti yang dilampirkan |
|---|---|---|---|
| Staging | Diisi saat uji | IT + operator/pengawas | Migrasi berhasil, akun per peran, hasil uji jaringan, transaksi, ekspor, AI dan cetak |
| Produksi, line pertama | Diisi saat buka shift | Pengawas shift + QC | Laporan uji, nomor versi, waktu simpan dan perubahan dashboard dua perangkat |
| Pemulihan | Diisi saat simulasi | IT | Pemulihan database, Auth, lampiran dan pemeriksaan laporan setelah backup |

Dalam target minggu 20–22 November 2026, jadwalkan SQL dan pengujian staging sebelum promosi Worker. Pantau satu pergantian shift pada line pertama, lalu tinjau hasil bersama pengawas sebelum penambahan line. Kuota layanan, perangkat, akurasi lokasi dan persetujuan pemilik proses diperiksa pada lingkungan tujuan.
