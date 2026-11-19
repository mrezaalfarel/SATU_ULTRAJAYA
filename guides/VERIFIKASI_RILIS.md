# Verifikasi kandidat rilis SATU ULTRAJAYA

| Pemeriksaan | Bukti dan batas pengukuran |
|---|---|
| Formulir dan audit | 14 jenis disimpan, dikirim, disetujui oleh akun terpisah dan dibaca kembali lewat Worker dengan PostgreSQL lokal. Uji mencakup duplikasi, versi konflik, koreksi shift, penolakan persetujuan sendiri, rekap serta downtime. |
| Penugasan | Admin membuat operator dan menetapkan area/line dari browser. Uji API memeriksa isolasi antara Filling dan Sterilizer, pembatasan detail, daftar, ringkasan dan perubahan. Pengawas dua line dapat memilih line, dan sesi lama berakhir saat penugasan diubah. |
| Geofence | Uji dengan koordinat perangkat sintetis mencakup pusat, titik dekat batas dengan estimasi kesalahan melewati radius, serta titik di luar pabrik. Browser meminta geolokasi lewat HTTPS pada deployment. Akurasi aktual di dalam gedung perlu diukur. |
| Browser | Chromium headless dengan build distribusi dan kebijakan header. Operator menyimpan ulang setelah respons terputus, menelusuri lot dan mencetak. Pengawas menyetujui, lalu dashboard menampilkan aktual 100, baik 95 dan reject 5. Delapan latar cetak dan tata letak lebar 390 px diuji. |
| Pembelajaran dan AI | Pengumuman admin tampil, operator lulus kuis dan membuka sumber jawabannya. Uji Worker memeriksa izin lampiran, status publikasi, batas foto dan penanganan layanan AI yang gagal. Layanan model dan Auth/Storage hosted memerlukan verifikasi di akun tujuan. |
| Pembaruan dashboard | Uji mencakup kebijakan kanal privat, sinyal perubahan, logout dan penyegaran browser dengan transport pesan simulasi. Verifikasi dua perangkat terpisah di Pages dan Supabase hosted masih diperlukan. |
| Volume | 5.000 laporan Sterilizer × 8 slot jam × 25 nilai sintetis disimpan dan dibaca kembali. Sampel ini memuat 1.000.000 nilai parameter. Ukuran skema, indeks dan rencana pencarian tercatat dalam HASIL_UJI_KAPASITAS.json. Kinerja serah terima shift dan kuota paket gratis perlu diukur di jaringan tujuan. |

## Peluncuran minggu 19–22 November 2026

1. **20 November · IT dan admin aplikasi.** Siapkan proyek Supabase uji dan produksi serta Cloudflare Pages. Hubungkan repo privat dan isi konfigurasi per lingkungan. Buat akun dengan contoh penugasan di panduan line dan pasang SQL rilis.
2. **20–21 November · operator, pengawas, dan QC.** Di staging, uji satu siklus shift dari dua perangkat pabrik, tracing lot, keadaan Wi-Fi putus dan login di tepi area. Cocokkan definisi parameter, revisi dan hasil cetak dengan dokumen terkendali. Rekam waktu simpan p95 dan jeda dashboard p95 saat pergantian shift. Usulan target pilot 2 detik dan 5 detik bila Realtime aktif.
3. **21–22 November · PIC produksi bersama IT.** Buka satu line setelah hasil aktual disetujui, backup dan pemulihan sudah diuji, serta operator mengenal prosedur gangguan. Tetapkan siapa yang merekonsiliasi catatan cadangan. Evaluasi satu shift sebelum menambah line. Jadwal ini merupakan target yang bergantung pada kesiapan akun, perangkat dan persetujuan pabrik.

Untuk mengulang uji, gunakan Node.js 22+, Python 3, dan Chromium. Dari akar repo jalankan `npm ci`, `python3 src/build.py`, `npm test`, `npm run test:size` dan `npm run test:browser`. Browser menggunakan PostgreSQL lokal serta akun sintetis. Untuk pengecekan cloud gunakan prosedur dua perangkat dalam DEPLOY.md.
