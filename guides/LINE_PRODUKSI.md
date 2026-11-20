# Penugasan operator, pengawas, dan foreman

Admin mengatur setiap ID pada **Area manajemen → Karyawan**. Isi line dengan kode yang sama persis dengan laporan di lapangan, kemudian pilih peran dan area kerja. ID individu diperlukan untuk jejak audit. Gunakan akun berbeda untuk pembuat dan peninjau.

| Area operator | Formulir yang dapat diisi | Area pengawas atau foreman |
|---|---|---|
| Filling | Produksi Filling Machine, Volume Control, Pack Integrity, Kejadian Produksi, CIP Filling Machine | Filling - Packing |
| Sterilizer - Aseptic Tank | Produksi Sterilizer GEA, Produksi Aseptic Tank GEA, CIP Aseptic Tank | InProses |
| Proses | Produksi Milk, CIP Line Pasteurizer | Proses |
| Packing | High Speed Cardboard Packer, Produksi Mesin Straw Applicator | Filling - Packing |

Operator membuka formulir sesuai area dan line yang ditetapkan. Satu ID operator menggunakan area yang sama pada seluruh line penugasannya. Event Filling mencatat downtime pada laporan kejadian. Total Produksi dan Supervisor Daily berada di luar dua belas formulir operator. Admin/management dapat mengelola rekap dan laporan pendukung sesuai akses line. Tim perlu menetapkan siapa yang mencatat rekap yang digunakan dashboard.

**Penugasan peninjau.** Buat pengawas aktif untuk salah satu dari tiga area peninjauan dan pilih semua line yang menjadi tanggung jawabnya. Buat ID foreman, pilih pengawas langsung dalam area yang sama, lalu pilih line yang juga ditugaskan pada pengawas tersebut. Satu pengawas dapat dipersiapkan sebelum foreman dibuat dan dapat membawahi hingga empat foreman aktif. Untuk rotasi, pindahkan atau nonaktifkan penugasan foreman terlebih dahulu jika perubahan area/line pengawas memengaruhi timnya. Pengawas dan foreman membuka dan menyetujui atau mengembalikan laporan sesuai area dan line. Riwayat tindakan menentukan independensi peninjau.

**Contoh.** Di line yang sama, operator Filling melihat lima formulir. Operator Packing melihat dua formulir Packing. Foreman yang ditugaskan pada area Filling - Packing dapat meninjau ketujuh formulir pada line tersebut. Laporan Sterilizer pada line yang sama memerlukan peninjau InProses. Saat suatu ID memiliki beberapa line, pilih line aktif di bagian atas layar sebelum mencari lot, meninjau antrean atau mencetak.

**Upgrade akun lama.** Pertahankan kode line pada laporan historis. Terapkan SQL rilis ini dan periksa semua akun operator serta peninjau lama di Area manajemen. Label lama Sterilizer dan Aseptic Tank pada operator dipetakan ke area gabungan. Isi penugasan yang kosong, periksa akun yang telah dinonaktifkan, lalu uji dengan masuk kembali pada setiap peran. Pastikan laporan historis dapat ditemukan oleh penanggung jawab yang masih memiliki hak line dan area tersebut. Pencabutan sesi saat perubahan akses mengharuskan karyawan masuk kembali.

Direktori karyawan, modul pembelajaran, pengumuman, dan leaderboard dipakai lintas line. Terbitkan materi sesuai audiens tersebut. Simpan perubahan akun dan reset kata sandi melalui admin yang berwenang.
