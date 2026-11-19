# Riwayat konversi dari versi satu line

Dokumen ini menjelaskan cakupan awal yang menyertai ZIP sumber. Untuk versi rilis, gunakan [catatan verifikasi](VERIFIKASI_RILIS.md) serta [penugasan karyawan](LINE_PRODUKSI.md).

Versi pilot berasal dari 77 berkas ekspor **Satu Ultrajaya (1).zip**. Katalog produksi memuat 14 jenis laporan, 57 bagian formulir dan 667 definisi kolom termasuk identitas yang muncul pada beberapa formulir. **DAFTAR_PARAMETER.csv** menunjukkan asal formulir, nomor dokumen, urutan bagian, tipe isian, satuan, pilihan dan batas referensi yang dibawa dari sumber. Nilai referensi proses merupakan salinan dari ekspor. Pemilik SOP perlu mencocokkan revisi pengendaliannya sebelum laporan resmi pertama.

## Perubahan pada kode lama

| Temuan pada ekspor | Implementasi pilot | Dampak operasional |
|---|---|---|
| Penyajian HTML dan panggilan `google.script.run` memerlukan server Google Apps Script | Antarmuka Pages dengan API pada Worker domain yang sama | Karyawan membuka URL Pages langsung. Aset publik awal berisi antarmuka login dan kode aplikasi |
| Sejumlah layanan membaca seluruh isi sheet kemudian menyaring laporan | PostgreSQL mengindeks tanggal, status, identitas mesin serta daftar batch/lot/reel. Hanya ringkasan yang diambil untuk daftar | Formulir rinci dimuat ketika dibuka. Penelusuran memakai halaman 25 laporan |
| Sesi lama memakai sheet serta penjagaan akses tersebar di endpoint | Supabase Auth, cookie Secure/HttpOnly/SameSite, verifikasi peran dan status pada server serta izin RPC terbatas | Menonaktifkan karyawan mencabut sesi. Akun individu dicatat dalam riwayat |
| Radius lokasi dalam sumber diatur 150.000 meter | Pusat lokasi, radius dan batas akurasi diatur dari lingkungan server. Daftar IP keluar tersedia | Batas dapat ditentukan sesuai pabrik. GPS browser tetap merupakan informasi yang dilaporkan perangkat |
| Fungsi simpan dan audit tersebar di beberapa dokumen | Penulisan laporan, versi, jejak perubahan dan identitas permintaan dilakukan dalam transaksi yang sama | Simpan memakai dua panggilan database, yakni pembacaan konteks secara terpadu dan penulisan transaksional. Ketukan ulang dengan ID operasi yang sama diproses sekali. Perubahan dari dua perangkat menghasilkan konflik versi yang terlihat |
| Peta formulir, patch Proses Milk dan aturan khusus Filling berada di beberapa berkas | Katalog menggabungkan kolom, identitas masakan, unit, form, revisi, slot jam, hasil cek dan jenis input | Operator membuka kelompok isian yang dibutuhkan. Dashboard membedakan draf, antrean dan hasil yang telah disetujui |
| Latar formulir berupa gambar besar disertakan bersama halaman lama | Delapan latar dan pemetaan koordinat asli disimpan di sisi Worker dan diambil saat cetak dengan sesi yang valid | Halaman login dan dashboard tidak mengunduh latar cetak. Semua cetakan melampirkan nilai tersimpan agar isian panjang tetap terbaca |

## Pemetaan formulir

| Kode formulir | Nama pada pilot | Dukungan cetak |
|---|---|---|
| F.U.P.002 | Produksi Milk, masakan 1–4 | Latar dan pemetaan asli per masakan, disertai rincian |
| F.U.U.CL.06 | CIP Line Pasteurizer | Latar dan pemetaan asli |
| F.U.F.060 | Produksi Sterilizer GEA | Latar dan pemetaan asli |
| F.U.F.040 | Produksi Aseptic Tank GEA | Latar dan pemetaan asli |
| F.U.U.CL.04 | CIP Aseptic Tank | Latar dan pemetaan asli |
| F.U.F.012 | High Speed Cardboard Packer | Latar dan pemetaan asli |
| F.U.F.029 | Produksi Mesin Straw Applicator | Latar dan pemetaan asli |
| F.U.F.023 | Supervisor Daily Reports | Latar dan pemetaan asli |
| F.U.F.039 | Produksi Filling Machine | Cetak terstruktur dari nilai tersimpan |
| F.U.F.024 | Volume Control, 10 jaw | Cetak terstruktur |
| F.U.F.019.A | Pack Integrity | Cetak terstruktur |
| F.U.G.001 | Laporan Kejadian Produksi | Cetak terstruktur |
| F.U.F.013 | CIP Filling Machine | Cetak terstruktur |
| Rekap | Total Produksi | Cetak terstruktur |

Lima template cetak Filling sebelumnya diambil melalui ID Google Sheets. Ekspor berisi referensi ID dan kode pemetaan. Berkas template terpisah diperlukan untuk menyamakan layout resmi kelimanya. PDF pada pilot dibuat lewat dialog cetak browser, lalu **Save as PDF / Simpan sebagai PDF**. Cocokkan margin, skala dan hasil fisik dengan formulir terkendali saat uji lapangan.

## Keputusan desain untuk pilot

- Satu proyek melayani **satu line**. Karyawan yang aktif dapat membaca catatan line pilot. Operator, QC, QA dan CI dapat membuat laporan dan mengubah draf miliknya. Pengawas, admin dan management dapat meninjau draf. Persetujuan membutuhkan akun peninjau yang berbeda dari pembuat perubahan maupun pengirim. Masakan Proses Milk disetujui per masakan. Laporan lain disetujui per record shift atau kejadian CIP.
- Header Sterilizer dan Aseptic memuat identitas mesin, tank dan petugas shift. Login individu menggantikan PIN supervisor bersama serta akun tablet per mesin. Rotasi grup A/B/C dari basis data karyawan lama tidak diimpor. Perubahan menuju pemakaian di beberapa line memerlukan cakupan akses karyawan per line.
- Operator dapat mengarsipkan draf atau laporan revisi dengan alasan. Riwayat dan versi sebelumnya tetap dapat diperiksa oleh pengelola data. Daftar Tracing Data normal hanya menampilkan laporan aktif.
- Cakupan katalog mengikuti definisi yang ada di ZIP. Perubahan yang hanya tersimpan pada Google Sheet master, materi Drive, akun, hasil kuis, lampiran dan data produksi historis memerlukan ekspor sumber aktual. Paket dimulai dari database kosong. Hash password Google Apps Script lama tidak digunakan. Admin menetapkan password awal baru.
- Untuk mengubah katalog pengembangan, edit `src/catalog.json` lalu bangun ulang. Pertahankan ID serta kunci parameter yang sudah dipakai oleh laporan tersimpan. Perubahan yang menghapus/mengganti arti kolom memerlukan migrasi dan versi skema terkontrol. Sinkronisasi Drive terjadwal dan pemindaian otomatis folder lama digantikan unggah/penerbitan materi oleh pengelola.
- Pencarian manual tersedia dengan Supabase saja. Rangkuman generatif dan observasi foto menggunakan Workers AI jika binding diaktifkan. Kuota, kebijakan penggunaan dokumen dan pemeriksaan visual oleh QC berlaku di lokasi pilot.

## Hasil verifikasi

| Pemeriksaan | Hasil |
|---|---|
| PostgreSQL lokal | Skema berhasil dipasang pada PostgreSQL 17.5 melalui PGlite. Transaksi, hak akses, pencarian dan agregasi dijalankan pada mesin SQL tersebut |
| API aplikasi | Delapan kelompok uji lulus. Keempat belas formulir disimpan dan dibaca kembali, persetujuan diri ditolak, kirim ulang tidak menggandakan data, konflik versi terdeteksi, dan pengarsipan serta pencabutan akses diperiksa |
| Browser | Dashboard, pemilihan area dan formulir, pengisian rekap dan penelusuran lot dijalankan dengan akun sintetis. Uji 100 aktual, 97 baik, 3 reject dibuka kembali melalui Tracing Data dengan status menunggu persetujuan. Gambar hasil uji ada di folder ini |
| Cetak | Fungsi pembentuk delapan layout asli dijalankan dengan nilai sintetis. Referensi gambar dan overlay SVG diverifikasi. Tampilan fisik hasil printer pabrik memerlukan uji di perangkat aktual |
| Pembaruan dashboard | SQL penerbit pesan dan logika klien diuji dengan layanan transport Realtime simulasi. Hanya sinyal kosong yang dikirim ke kanal privat sesinya. Logout mengakhiri kelayakan kanal. Verifikasi koneksi WebSocket pada domain Pages memerlukan uji dua perangkat setelah deployment |
| Kapasitas | 5.000 laporan Sterilizer sintetis × 8 jam × 25 parameter = **1.000.000 nilai tersimpan dan dibaca kembali**. Termasuk 15.000 entri histori dan 15.000 entri operasi. Periksa berkas `HASIL_UJI_KAPASITAS.json` untuk ukuran tabel/indeks dan rencana query PostgreSQL aktual |

Ukuran contoh mencakup tabel dalam skema `satu` beserta indeks dan TOAST. Angka berubah dengan variasi nilai, ukuran catatan, frekuensi revisi, jumlah audit, dan lampiran. Laporan contoh dibuat secara massal di PostgreSQL lokal. Durasi query pada berkas hasil merupakan pengukuran lokal dengan cache hangat. Latensi jaringan, throughput tulis produksi, GPS di dalam bangunan, layanan hosted Auth/Storage/Realtime, dan model Workers AI belum diukur pada akun perusahaan. Untuk penerimaan pilot, lakukan alur dua akun dalam panduan pada perangkat operator, kemudian catat durasi simpan dan waktu sampai dashboard perangkat pengawas berubah.

## Biaya dan batas operasional

Cloudflare Pages dapat menampung frontend dan Worker pada satu alamat. Paket Workers Free memiliki batas 100.000 permintaan per hari per akun. Supabase Free menyediakan 500 MB database per proyek dan 1 GB untuk Storage. Realtime juga memiliki kuota pesan serta koneksi. Workers AI memiliki alokasi gratis harian 10.000 Neurons. Buka halaman Usage masing-masing produk selama pilot karena batas paket dapat berubah. Penyimpanan gratis tidak tanpa batas. Pisahkan jumlah **nilai parameter**, **laporan**, dan **transaksi per detik** saat menyusun kebutuhan untuk tim IT.

## Membangun dan menguji ulang

ZIP direct upload yang telah disiapkan tidak memerlukan instalasi. Tim pengembang dapat meregenerasi paket menggunakan Python 3 dengan `python3 src/build.py` dari direktori proyek. Sumber publik berada di `pages/` dan kode Worker/SQL di `src/`. Alat build menanamkan isi `src/private/` ke Worker. **Gunakan ZIP hasil build saat deploy.** Simpan kode sumber lengkap sebagai bahan pengembangan internal.

Untuk mengulang pengujian lokal, gunakan Node.js 22+ dan `npm install`, lalu `npm test` serta `npm run test:size`. Semua data uji sintetis dibuat di memori. `npm run test:browser` menyediakan otomasi tambahan apabila browser Chrome headless tersedia. Set `CHROME_BIN` ke lokasi executable bila diperlukan. Pada lingkungan ini, Chrome headless mandiri tidak dapat dimulai. Pengujian browser aktual dijalankan melalui peramban dalam aplikasi. Untuk mengekstrak ulang katalog dari ekspor sumber, gunakan `python3 src/extract.py "/path/ke/folder-hasil-ekstrak-GAS"` sebelum build. Ekstraksi ulang menimpa perubahan manual pada katalog.

- [Kuota dan pemakaian Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Supabase Realtime Protocol](https://supabase.com/docs/guides/realtime/protocol)

