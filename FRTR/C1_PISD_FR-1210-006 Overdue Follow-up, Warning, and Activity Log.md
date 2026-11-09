# C1_PISD_FR-1210-006: Overdue Follow-up, Warning, and Activity Log

| Field | Value |
| --- | --- |
| **Document ID** | FR-01210-006 |
| **Date** | 12-10-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [User Story 4: Pemrosesan Berkas Tagihan Tertahan (Data Outstanding)](https://docmost.ayutrans.id/s/ccr/p/user-story-4-pemrosesan-berkas-tagihan-tertahan-data-outstanding-nteihgavTt) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan kebutuhan fungsional untuk mengelola penugasan penagihan, mencatat dan memperbarui riwayat tindak lanjut piutang (*follow-up progress*), menghapus riwayat log dengan pembalikan transaksi otomatis (*automatic payment reversal*), serta menerbitkan Surat Peringatan (Warning Letter) resmi.

---

## Description

Sistem harus menyediakan alur kerja penagihan komprehensif bagi staf dan manajemen, mencakup pencatatan perkembangan penagihan secara kronologis, penyuntingan catatan terdahulu, penghapusan log riwayat dengan dialog konfirmasi aman, pembuatan Surat Peringatan berformat PDF resmi (*SP-1, SP-2, SP-3*), serta jaminan pelestarian riwayat tindak lanjut melalui model basis data yang terdesentralisasi dari alert piutang aktif.

---

## Scope and Users

| Item | Value |
| --- | --- |
| Scope | Pencatatan log follow-up penagihan; status progres (`ASSIGNED`, `IN_PROGRESS`, `PENDING`, `COMPLETED`); janji bayar (`promise_date`) dan nominal pelunasan; penyuntingan log; penghapusan log beserta pembalikan pembayaran otomatis; penerbitan Surat Peringatan PDF multi-tingkat. |
| Actor / user role | Level Management / Supervisor (`MANAGEMENT`) dan Level Admin / Staff (`STAFF`). |

---

## Functional Requirements

- **FR-CCR-006-01 Pencatatan Progres Tindak Lanjut Penagihan**  
  Staf penagihan dapat menambahkan rekaman progres tindak lanjut baru pada halaman Create Follow-up (`/overdue-alert/create/[id]`), mencakup:
  - Status follow-up: `ASSIGNED`, `IN_PROGRESS`, `PENDING`, atau `COMPLETED`.
  - Aksi penagihan: Panggilan Telepon, Pesan WhatsApp, Kunjungan Lapangan, Email Peringatan, atau Negosiasi Khusus.
  - Tanggal komitmen bayar (*promise date*).
  - Catatan penjelasan (*notes*) bebas (sistem mempertahankan bahasa asli inputan pengguna).
  - Tautan lampiran bukti penagihan (*attachment URL*).
  - Estimasi/nominal pembayaran yang diterima (*payment amount*).
- **FR-CCR-006-02 Penyuntingan Riwayat Follow-Up Terdahulu (Edit Log)**  
  Pengguna berwenang dapat menyunting isi catatan, status, tanggal komitmen, maupun nominal pada entri riwayat follow-up sebelumnya langsung pada timeline halaman Edit Overdue (`/overdue-alert/edit/[id]`).
- **FR-CCR-006-03 Penghapusan Riwayat Follow-Up (Delete Log)**  
  Pengguna dapat menghapus entri log riwayat follow-up yang salah input melalui tombol "Delete Log" berwarna merah. Sistem menampilkan modal dialog konfirmasi berlatar belakang blur (*backdrop blur*) yang merinci dampak penghapusan sebelum eksekusi dilakukan.
- **FR-CCR-006-04 Pembalikan Pelunasan Otomatis (Automatic Payment Reversal)**  
  Jika log riwayat yang disunting atau dihapus berstatus `COMPLETED` (yang sebelumnya telah memicu pencatatan transaksi pelunasan di `c1_payment_transactions`):
  - Sistem secara otomatis menghapus/membalikkan rekaman transaksi pelunasan terkait dari basis data `c1_payment_transactions`.
  - Sistem mengevaluasi ulang status alert invoice sehingga invoice kembali muncul sebagai piutang jatuh tempo (*overdue alert*) aktif bila belum ada pelunasan lain.
- **FR-CCR-006-05 Generator Surat Peringatan (Warning Letter Generator)**  
  Sistem menyediakan generator Surat Peringatan in-app dengan dialog modal interaktif:
  - Klasifikasi otomatis berdasarkan usia tunggakan: `30 - 59 Hari` (SP-1), `60 - 90 Hari` (SP-2), `> 90 Hari` (SP-3).
  - Input tanggal terbit dan batas waktu pembayaran via kalender date-picker.
  - Informasi nomor rekening resmi Bank Mandiri `1234-5678-9012` a.n. `PT Andima Transportindo`.
  - Format penandatangan resmi: PIC penagihan, `Credit Controller`, dan `PT Andima Transportindo`.
  - Tombol "Simpan Draf" (mengunduh berkas `Draft-SP-{invoice}.pdf`) dan "Kirim SP Sekarang" (mengunduh berkas `Surat-Peringatan-{level}-{invoice}.pdf`).
- **FR-CCR-006-06 Standar Bahasa Antarmuka & Inputan**  
  Seluruh antarmuka penagihan, judul formulir, label tombol, dan status disajikan dalam Bahasa Inggris baku (*system-wide English*), sedangkan catatan bebas penagihan (*follow-up notes*) tetap mempertahankan bahasa input asli pengguna.

---

## Business Rules

1. Menetapkan status `COMPLETED` pada penagihan mewajibkan pengisian nominal pelunasan dan otomatis memindahkan status tagihan menjadi lunas di Customer Analytics.
2. Menghapus log pelunasan terakhir mengembalikan invoice ke status overdue tanpa menghilangkan riwayat penugasan PIC sebelumnya.
3. Seluruh mutasi progres dicatat bersama ID pengguna pengubah (*updated_by*) dan stempel waktu (*timestamp*) untuk kebutuhan audit rekam jejak.

---

## API Endpoint Contract

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| POST | /api/v1/overdue/[invoiceId]/progress | Menambahkan entri progres tindak lanjut baru pada invoice. | Staff & Management |
| PATCH | /api/v1/overdue/[invoiceId]/progress | Memperbarui isi catatan atau status dari entri follow-up tertentu. | Staff & Management |
| DELETE | /api/v1/overdue/[invoiceId]/progress | Menghapus entri follow-up dan membalikkan pembayaran pelunasan jika ada. | Staff & Management |
| GET | /api/v1/overdue/[invoiceId]/history | Mengambil seluruh kronologi riwayat tindak lanjut invoice tertentu. | Staff & Management |

---

## Acceptance Criteria

1. Pengguna dapat menambahkan riwayat tindak lanjut penagihan baru dengan pilihan status, aksi, catatan, dan komitmen tanggal bayar.
2. Pengguna dapat mengedit catatan riwayat follow-up lama melalui formulir modal penyuntingan.
3. Menghapus entri riwayat follow-up memunculkan dialog konfirmasi; jika entri tersebut adalah pelunasan `COMPLETED`, pembayaran di Customer Analytics otomatis dibatalkan dan invoice kembali menjadi overdue.
4. Generator Surat Peringatan menghasilkan berkas PDF resmi berlogo perusahaan, nomor registrasi terstandar, dan rekening Bank Mandiri.
5. Riwayat penugasan tetap tersimpan utuh di basis data sekalipun status tagihan telah diselesaikan.

---

## Source Traceability

| Source | Requirements Coverage |
| --- | --- |
| [User Story 4: Pemrosesan Berkas Tagihan Tertahan](https://docmost.ayutrans.id/s/ccr/p/user-story-4-pemrosesan-berkas-tagihan-tertahan-data-outstanding-nteihgavTt) | Pencatatan tindak lanjut, eskalasi status, pembuatan Surat Peringatan, dan histori penagihan. |
