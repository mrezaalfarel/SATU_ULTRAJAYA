# Alur Apps Script di portal SATU

Perbandingan ini menggunakan kode arsip, termasuk komponen HTML. Pengamatan tampilan dilakukan dari kode, tanpa sesi langsung ke aplikasi lama.

| Bagian lama | Padanan pada portal |
|---|---|
| FillingMachineContext dan FillingShellStart | Area dan line berasal dari penugasan akun. Dari dashboard, Buat laporan langsung membuka pilihan formulir jika hanya ada satu area. Nomor mesin pada formulir Filling baru terisi dari kode line seperti FM57 atau Filling 57 dan dapat diperiksa sebelum simpan. |
| FillingHourWheel, FillingVolume dan FillingScripts | Pemeriksaan produksi dan volume diurutkan dari 00.00 sampai 23.00 WIB. Pukul 00.00 tetap memakai slot penyimpanan 24. Matriks menampilkan sembilan posisi dan 24 jam untuk satu jaw yang dipilih. Perubahan draf dan angka tersimpan memakai simbol berbeda. |
| SUStlzApp dan SUAtApp | Data preheating disusun per sesi. Formulir menampilkan alasan saat sesi sebelumnya belum lengkap, sesuai pemeriksaan server yang sudah berjalan. |
| SUProcessMilkWorkflow, SUReportStraw dan SUReportCardboardPacker | Portal memiliki formulir masakan, Straw dan CBP. Isian berasal dari katalog portal. Laporan disimpan dengan versi dan pengajuan ke pengawas. |
| SUUnifiedTraceV69 dan ApprovalService | Penelusuran portal memakai tanggal, jenis, status dan identitas material. Keputusan pengawas dicatat atas nama akun yang sedang login. |
| EducationDriveAutoSync dan UltraDriveKnowledgeService | Dokumen baru diterbitkan melalui Education Corner di penyimpanan privat Supabase. Referensi yang dipakai AI mengikuti dokumen terbit di portal. |

Rilis ini menggunakan database SATU yang sudah berjalan. Pemindahan isi Google Sheets, arsip PDF Drive, registrasi identitas shift lintas formulir Proses, serta rekap bulanan khusus mesin dari aplikasi lama berada di luar perubahan ini. Kunci API, akun dan PIN pada sistem lama tidak disalin ke portal.
