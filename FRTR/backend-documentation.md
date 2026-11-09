# Dokumentasi Teknis Backend Modul C1 (CCR)

Dokumen ini merupakan panduan teknis komprehensif mengenai arsitektur backend, skema basis data PostgreSQL, prosedur stored procedure teroptimasi, katalog route handler API, serta alur bisnis otomatisasi pelunasan dan pembalikan transaksi pada modul Credit Control & Recovery (CCR) PT Andima Transportindo.

---

## 1. Arsitektur Backend & Lingkungan Runtime

Seluruh operasi basis data, validasi berkas, perhitungan analitik, dan autentikasi berjalan pada lapisan server (*server-side authoritative*). Klien peramban web (*browser*) tidak pernah melakukan kueri langsung ke Supabase SDK publik.

### Komponen Utama:
- **Framework**: Next.js 14 App Router (Node.js runtime server-side).
- **Klien Basis Data**:
  - `createAdminClient()`: Klien server dengan `SUPABASE_SERVICE_ROLE_KEY` untuk operasi mutasi proyeksi dan RPC berhak akses tinggi.
  - `createClient()`: Klien server terotentikasi berdasarkan token sesi pengguna.
- **Sistem Sesi & Autentikasi**:
  - Menggunakan cookie HTTP-Only, `SameSite=Lax`, dan `Secure` pada lingkungan produksi.
  - Sesi diperiksa secara ketat melalui middleware dan helper `requireSession()`.
- **Role-Based Access Control (RBAC)**:
  - Profil CCR diverifikasi melalui helper `getCcrProfile()`.
  - Hak akses:
    - `canUseCcr`: Hak akses membaca dashboard dan data penagihan.
    - `canManage`: Hak akses manajerial (level `MANAGEMENT`), termasuk penetapan PIC dan aksi evaluasi.
    - `canUpload`: Hak akses operasional staf (level `STAFF`), termasuk mengunggah dan menghapus dokumen mandiri.
- **Proteksi Mutasi**: Seluruh endpoint mutasi (`POST`, `PATCH`, `DELETE`) melakukan verifikasi header `Origin` untuk mencegah serangan Cross-Site Request Forgery (CSRF).

---

## 2. Konfigurasi Lingkungan (Environment Variables)

Variabel lingkungan berikut wajib dikonfigurasi pada server (lihat file referensi `.env.example`):

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
```

*Catatan Keamanan: `SUPABASE_SERVICE_ROLE_KEY` bersifat rahasia dan tidak boleh diekspos ke lingkungan klien peramban.*

### Konfigurasi Template Email Supabase Auth:
Pada dashboard Supabase Auth -> Email Templates -> Confirm Signup, tautan tombol konfirmasi harus dikonfigurasi sebagai berikut:
```html
{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup
```
Hal ini memungkinkan callback server di `/api/auth/callback` memverifikasi token pendaftaran tanpa bergantung pada fragment URL sisi peramban.

---

## 3. Skema Basis Data: Inventori 10 Tabel Aktif `c1_`

Setelah pembersihan basis data (*dead tables cleanup* per 9 November 2026), skema operasional modul C1 terdiri dari **tepat 10 tabel aktif**. Seluruh tabel non-`c1_` (seperti `auth.*`, `a1_*`, `b1_*`, dll) tetap terjaga utuh.

| No | Nama Tabel | Deskripsi & Peruntukan |
| --- | --- | --- |
| 1 | `c1_document_uploads` | Ledger utama pencatatan berkas yang diunggah (`COMPANY_SALES_REPORT` / `OUTSTANDING_REPORT`) beserta status validasi (`uploaded`, `validated`, `rejected`, `processing`). |
| 2 | `c1_company_sales_staging_rows` | Baris data penjualan tervalidasi yang memuat omset pendapatan (*revenue*) dan rincian biaya operasional riil. |
| 3 | `c1_outstanding_staging_rows` | Baris data piutang tagihan tervalidasi yang memuat nomor invoice, nominal tagihan, dan tanggal jatuh tempo. |
| 4 | `c1_customer` | Master entitas customer serta profil customer baru hasil ingestion berkas upload (`source_type = 'UPLOAD'`). |
| 5 | `c1_document_validation_errors` | Catatan galat validasi baris per baris untuk berkas yang ditolak atau memiliki peringatan. |
| 6 | `c1_document_deletion_audit` | Catatan audit permanen untuk rekaman berkas yang telah dihapus oleh staf. |
| 7 | `c1_macro_metric` | Tabel ringkasan bulanan yang menyimpan total Revenue, Cost, Sales Profit, dan Total Outstanding untuk Sales Overview. |
| 8 | `c1_overdue_alert` | Tabel proyeksi tagihan yang sedang mengalami keterlambatan jatuh tempo aktif. |
| 9 | `c1_assignment` | Buku besar kronologis penugasan staf PIC, pembaruan status tindak lanjut, komitmen janji bayar, dan nominal pembayaran. |
| 10 | `c1_payment_transactions` | Catatan transaksi pembayaran riil customer (termasuk auto-settlement dari modul penagihan). |

### ⚠️ Tabel Mati yang Telah Dihapus (*Dropped Dead Tables*):
1. `c1_mid_feed` – Feeder eskalasi eksternal lawas (dihapus).
2. `c1_customer_monthly_metrics` – Pra-agregasi analitik usang (dihapus, digantikan oleh dynamic RPC).
3. `c1_invoice_detail` – Rincian invoice usang (dihapus, digantikan oleh staging dan payment transactions).
4. `c1_export_file` – Antrean unduhan ekspor lawas (dihapus, digantikan oleh client-side streaming export).
5. `c1_export_request` – Antrean permintaan ekspor lawas (dihapus).

---

## 4. Fungsi & Stored Procedure Basis Data Authoritative

### 1. `c1_refresh_overdue_alerts(p_eval_date date)`
- **Tujuan**: Membangun kembali proyeksi tagihan tertunggak secara authoritative.
- **Logika**:
  - Mengambil tagihan dari `c1_outstanding_staging_rows` yang berasal dari berkas tervalidasi.
  - Menghitung `days_overdue = p_eval_date - due_date`.
  - Mengelompokkan status resiko: `Watchlist` (1-30 hari), `Medium Risk` (31-60 hari), `High Risk` (>60 hari).
  - Mengecualikan tagihan yang telah lunas (berstatus `COMPLETED` di `c1_assignment` atau memiliki pembayaran lunas di `c1_payment_transactions`).
  - Menghapus invoice yang sudah lunas dari tabel `c1_overdue_alert`.

### 2. `c1_get_customer_analytics(p_start_date, p_end_date, p_search, p_branch, p_limit, p_offset)`
- **Tujuan**: Menghitung ringkasan analitik customer dinamis langsung dari baris transaksi tervalidasi.
- **Logika**:
  - Melakukan deduplikasi nama entitas kanonikal dan normalisasi nomor MAWB (misal: `"Perusahaan A 17278941"` dipetakan ke `"Perusahaan A"`).
  - Menghitung Sales Profit, Net Margin %, Total Outstanding, dan Days Sales Outstanding (DSO) secara on-the-fly.
  - Menghitung arah tren pembayaran multi-bulan secara dinamis hingga transaksi pembayaran terbaru (termasuk bulan berjalan).

### 3. `c1_delete_uploaded_document(p_document_id uuid, p_deleted_by uuid)`
- **Tujuan**: Menghapus dokumen upload beserta seluruh dependensinya secara atomik (`SECURITY DEFINER`).
- **Logika**:
  - Mencatat audit penghapusan ke `c1_document_deletion_audit`.
  - Menghapus berkas dari `c1_document_uploads` (otomatis menghapus baris staging via cascade delete).
  - Memanggil `c1_cleanup_unreferenced_upload_customers()` untuk membersihkan customer upload yatim.
  - Menghitung ulang metrik makro bulanan (`c1_macro_metric`) dan merefresh alert overdue.

### 4. `c1_cleanup_unreferenced_upload_customers(p_document_id uuid)`
- **Tujuan**: Membersihkan entitas customer upload (`source_type = 'UPLOAD'`) yang tidak lagi memiliki referensi di baris sales, outstanding, overdue alert, maupun transaksi pembayaran.

### 5. `reset_c1_sales_overview_data()`
- **Tujuan**: Mereset seluruh data ingestion C1 ke kondisi awal secara bersih tanpa dependensi ke tabel mati.

---

## 5. Katalog Lengkap Route Handler API

### A. Modul Autentikasi & Akun
- `POST /api/auth/login`: Autentikasi kredensial pengguna, menetapkan cookie sesi HttpOnly.
- `POST /api/auth/logout`: Membersihkan sesi server dan menghapus cookie autentikasi.
- `POST /api/auth/register`: Mendaftarkan akun karyawan baru dan menetapkan profil CCR awal.
- `GET /api/auth/callback`: Menangani verifikasi token konfirmasi email dari Supabase Auth.
- `GET /api/v1/account/me`: Mengambil profil akun pengguna aktif (nama, email, resolved role, inisial).

### B. Modul Ingestion & Manajemen Dokumen
- `POST /api/v1/documents/upload/preflight`: Parsing dan validasi berkas multipart tanpa persistensi data. Mengembalikan ringkasan baris dan temuan galat.
- `POST /api/v1/documents/upload/finalize`: Memfinalisasi berkas menjadi `validated` (menyimpan ke Storage dan menyisipkan baris staging) atau `rejected` (mencatat audit tanpa menyimpan berkas asli).
- `GET /api/v1/documents`: Mengambil daftar riwayat dokumen dengan filter tipe, status, dan pagination.
- `GET /api/v1/documents/[id]/preview`: Mengambil sampel baris staging dari dokumen tervalidasi.
- `GET /api/v1/documents/[id]/validation-detail`: Mengambil rincian galat baris per baris untuk dokumen yang ditolak.
- `GET /api/v1/documents/[id]/download`: Menghasilkan signed URL unduhan berkas asli dari Storage.
- `DELETE /api/v1/documents/[id]`: Menghapus dokumen, menghapus baris staging, membersihkan customer yatim, dan rollback metrik.

### C. Modul Analitik Makro & Customer
- `GET /api/v1/analytics/macro`: Mengambil kartu metrik ringkasan eksekutif dan deret waktu bulanan zero-filled berdasarkan rentang periode `start_period` dan `end_period`.
- `GET /api/v1/analytics/customers`: Memanggil RPC `c1_get_customer_analytics` dengan parameter pencarian, filter cabang, sorting, dan rentang tanggal.
- `GET /api/v1/customers/[customerId]/invoices`: Mengambil rincian invoice dan status pelunasan riil untuk customer tertentu.

### D. Modul Overdue Alert & Tindak Lanjut Penagihan
- `GET /api/v1/overdue-alerts`: Mengambil daftar tagihan tertunggak aktif, KPI summary, dan filter operasional.
- `POST /api/v1/overdue-alerts`: Menjalankan aksi manajemen (`EVALUATE` untuk memicu evaluasi ulang, `ASSIGN_PIC` untuk menetapkan staf penanggung jawab).
- `GET /api/v1/overdue/[invoiceId]/history`: Mengambil seluruh riwayat kronologis follow-up penagihan untuk invoice tertentu.
- `POST /api/v1/overdue/[invoiceId]/progress`: Menambahkan catatan progres tindak lanjut baru. Jika status diset `COMPLETED`, sistem otomatis memicu alur settlement.
- `PATCH /api/v1/overdue/[invoiceId]/progress`: Menyunting entri progres follow-up terdahulu.
- `DELETE /api/v1/overdue/[invoiceId]/progress`: Menghapus entri follow-up terdahulu. Jika entri yang dihapus berstatus `COMPLETED`, sistem otomatis membalikkan transaksi pelunasan.

---

## 6. Mekanisme Pelunasan (Settlement Flow) & Pembalikan Otomatis (Reversal)

### Alur Pelunasan Tagihan (`recordSettlementPaymentInSupabase`):
1. Ketika staf atau manajer menetapkan status follow-up menjadi `COMPLETED`:
2. Sistem mencari informasi tagihan dan nominal outstanding dari `c1_outstanding_staging_rows`.
3. Menghubungkan ID customer kanonikal dari `c1_customer`.
4. Menyisipkan rekaman pembayaran pada tabel `c1_payment_transactions` dengan referensi unik `SETTLE-{assignmentId}`.
5. Menghapus invoice terkait dari tabel pantauan `c1_overdue_alert`.
6. Tagihan seketika berpindah status menjadi `PAID` di modul Customer Analytics dan transaksi pembayaran langsung tampil pada grafik tren pembayaran.

### Alur Pembalikan Pelunasan Otomatis (`reverseSettlementPaymentInSupabase`):
1. Jika entri follow-up yang berstatus `COMPLETED` dihapus via `DELETE` atau statusnya diubah menjadi status lain via `PATCH`:
2. Sistem menghapus transaksi pelunasan terkait dari `c1_payment_transactions` berdasarkan nomor referensi `SETTLE-{assignmentId}`.
3. Sistem memeriksa apakah masih ada entri `COMPLETED` lain untuk invoice tersebut.
4. Jika tidak ada, sistem menjalankan `evaluateOverdueAlertsInSupabase()` sehingga invoice secara aman dikembalikan ke daftar pantauan alert overdue.

### Pelestarian Riwayat Penugasan:
Batasan foreign key cascade `c1_assignment_invoice_id_fkey` telah dilepas secara resmi pada migrasi `20261109140000_preserve_assignment_history_on_settlement.sql`. Seluruh riwayat log di `c1_assignment` tetap tersimpan utuh dan dapat diaudit kapan saja meskipun invoice telah lunas dan dikeluarkan dari `c1_overdue_alert`.

---

## 7. Arsitektur Ekspor Multi-Format & Surat Peringatan

Sistem mengadopsi pendekatan **Client-Side Direct Streaming Generator** yang memproses data tabel langsung di memori peramban menjadi Blob tanpa membebani penyimpanan server:
- **Excel (.xlsx)**: Menggunakan library `exceljs` untuk menghasilkan file spreadsheet terformat dengan header korporat, borders, dan pemformatan mata uang Rupiah.
- **PDF (.pdf)**: Menggunakan library `jspdf` dan `jspdf-autotable` untuk menghasilkan laporan eksekutif landscape dengan tabel multi-halaman rapi.
- **CSV (.csv)**: Komposisi teks RFC 4180 dengan encoding UTF-8.
- **Surat Peringatan (Warning Letter)**: Generator PDF interaktif berjenjang (`SP-1`, `SP-2`, `SP-3`), dilengkapi rekening Bank Mandiri `1234-5678-9012` a.n. `PT Andima Transportindo`, tanda tangan resmi, serta opsi unduh draf atau surat terbit.

---

## 8. Jaminan Kualitas & Pengujian Otomatis

Seluruh logika backend dilindungi oleh rangkaian pengujian otomatis terisolasi menggunakan mesin PostgreSQL in-memory (`@electric-sql/pglite`):
- **Menjalankan Pengujian**:
  ```powershell
  npm test
  ```
  *Mencakup 58 pengujian otomatis (100% lulus / green) yang menguji seluruh RPC analitik, parser dokumen, deduplikasi customer, pelunasan pembayaran, reversal log, dan pembersihan tabel mati.*
- **Pengecekan Tipe Data**:
  ```powershell
  npm run typecheck
  ```
  *Memastikan kepatuhan TypeScript dengan 0 error kompilasi.*
