# Penugasan ID karyawan

Admin membuka **Area manajemen → + Karyawan**. Gunakan satu ID per orang. Isi nama, peran, line yang diizinkan, dan kata sandi awal. Untuk peran operator, pilih area dari katalog formulir. Nama line dapat dibuat langsung saat mengatur akun. Gunakan ejaan dan kapitalisasi yang sama untuk semua orang yang bertugas di line yang sama.

| Contoh penugasan | Peran | Line yang diizinkan | Area kerja | Setelah masuk |
|---|---|---|---|---|
| Operator mesin filling 57 | operator | Filling 57 | Filling | Lima formulir Filling, downtime dan Total Produksi untuk Filling 57 |
| Operator sterilizer | operator | Sterilizer A | Sterilizer | Formulir Sterilizer dan Total Produksi untuk Sterilizer A |
| Pengawas kedua unit | pengawas | Filling 57, Sterilizer A | — | Memilih line di bagian atas halaman dan meninjau laporan di line itu |
| Pemeriksa kualitas | qc | Filling 57 | — | Menelusuri laporan line dan mengisi rekaman pemeriksaan |
| Administrator | admin | Filling 57, Sterilizer A | — | Mengelola akun seluruh pabrik dan dapat meninjau laporan di line yang ditugaskan |

Setelah login, aplikasi membuka line pertama penugasan. Jika ada beberapa line, pengguna dapat berpindah melalui pilihan di bagian atas. Operator mempunyai satu area formulir untuk seluruh line yang ditugaskan pada ID tersebut. Setiap operator dapat mengisi Total Produksi pada line penugasannya. Sepakati penanggung jawab rekap per shift. Dashboard, pencarian lot, persetujuan serta cetak mengikuti line aktif. Nama unit di dalam laporan tetap mengikuti identitas peralatan pada formulir.

Daftar karyawan, modul, pengumuman, kutipan manual, dan leaderboard berlaku untuk seluruh pabrik. Publikasikan materi yang sesuai untuk seluruh peserta. Hanya admin yang dapat membuat akun, mengganti penugasan, menonaktifkan akun, atau mereset kata sandi. Mengubah akses karyawan mencabut sesi aktifnya. Gunakan persetujuan oleh akun pengawas lain untuk laporan yang pengawas pertama isi atau kirim sendiri.

Untuk memperbarui instalasi pilot terdahulu, terapkan SQL rilis baru lalu atur penugasan setiap akun operator yang aktif sebelum membuka line lain. Profil lama tanpa penugasan masih memakai PILOT_LINE historis dan cakupan katalog pilot. Kode line tersimpan pada laporan. Jika mesin atau nama line berubah, tetapkan penugasan baru dan pertahankan akses penelusuran historis untuk pengawas yang berwenang.
