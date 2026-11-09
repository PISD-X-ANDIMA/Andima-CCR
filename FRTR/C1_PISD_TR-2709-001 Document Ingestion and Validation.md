# C1_PISD_TR-2709-001: Document Ingestion and Validation

| Field | Value |
| --- | --- |
| **Document ID** | TR-2709-001 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [C1_PISD_FR-2709-001: Unggah dan Validasi Dokumen Mandiri](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-001-unggah-dan-validasi-dokumen-mandiri-4UQw0y3W5i) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan arsitektur teknis, skema basis data, kontrak antarmuka API, dan alur validasi preflight untuk ingestion berkas Company Sales Report dan Data Outstanding.

---

## FR-to-TR Relationship  

| Supported FR | Technical Relationship |
| --- | --- |
| [C1_PISD_FR-2709-001: Unggah dan Validasi Dokumen Mandiri](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-001-unggah-dan-validasi-dokumen-mandiri-4UQw0y3W5i) | Menyediakan pipeline parsing multipart, validasi preflight tanpa persistensi, resolusi customer otomatis, staging data, dan fungsi penghapusan dokumen atomik. |

---

## Architecture & Technology

| Area | Requirements |
| --- | --- |
| Frontend | Next.js 14 App Router, React, Tailwind CSS, Lucide Icons. |
| Backend | Next.js Route Handlers (Node.js runtime server-side). Parsing berkas menggunakan `xlsx` dan parser PDF text-based. Validasi integritas baris dijalankan sepenuhnya di sisi server. |
| Database | Supabase PostgreSQL untuk penyimpanan tabel operasional staging dan audit. |
| Storage | Supabase Storage bucket `c1_documents` untuk arsip berkas asli yang tervalidasi. |
| Authentication & Authorization | Supabase Auth dengan HttpOnly session cookies dan verifikasi profil CCR (`canUpload` untuk aksi upload/delete, `canUseCcr` untuk review). |

---

## Logical Data Model

Berikut adalah entitas basis data aktif yang digunakan dalam alur ingestion dokumen:

| Table / Entity | Columns & Key Constraints | Description |
| --- | --- | --- |
| `c1_document_uploads` | `id` (uuid pk), `file_name` (text), `document_type` (text: 'COMPANY_SALES_REPORT'/'OUTSTANDING_REPORT'), `validation_status` (text: 'uploaded'/'validated'/'rejected'/'processing'), `uploader_user_id` (uuid), `storage_bucket` (text), `storage_path` (text), `created_at` (timestamptz) | Ledger utama pencatatan berkas yang diunggah. |
| `c1_company_sales_staging_rows` | `id` (uuid pk), `document_id` (uuid fk -> c1_document_uploads on delete cascade), `row_number` (int), `period_month` (date), `customer_name` (text), `customer_id` (uuid), `c1_customer_id` (uuid), `revenue` (numeric), `trucking_cost` (numeric), `handling_cost` (numeric), `storage_cost` (numeric), `other_operational_cost` (numeric), `total_cost` (numeric) | Baris data penjualan tervalidasi. |
| `c1_outstanding_staging_rows` | `id` (uuid pk), `document_id` (uuid fk -> c1_document_uploads on delete cascade), `row_number` (int), `invoice_number` (text), `customer_name` (text), `customer_id` (uuid), `c1_customer_id` (uuid), `outstanding_amount` (numeric), `due_date` (date), `bulk_close_status` (text) | Baris data piutang tagihan tervalidasi. |
| `c1_document_validation_errors` | `id` (uuid pk), `document_id` (uuid fk -> c1_document_uploads on delete cascade), `row_number` (int), `field_name` (text), `error_code` (text), `error_message` (text), `raw_value` (text) | Rincian temuan galat validasi per baris. |
| `c1_document_deletion_audit` | `audit_id` (uuid pk), `document_id` (uuid), `file_name` (text), `document_type` (text), `validation_status` (text), `uploader_user_id` (uuid), `deleted_by` (uuid), `storage_bucket` (text), `storage_path` (text), `deleted_at` (timestamptz default now()) | Catatan audit permanen untuk berkas yang telah dihapus. |
| `c1_customer` | `customer_id` (uuid pk), `customer_code` (text), `customer_name` (text), `source_type` (text: 'MASTER'/'UPLOAD'), `source_document_id` (uuid) | Master data customer dan identitas hasil ingestion berkas. |

---

## API and Integration Requirements

| Method | Endpoint | Payload & Headers | Response Contract |
| --- | --- | --- | --- |
| POST | /api/v1/documents/upload/preflight | `multipart/form-data`: `file`, `documentType` | `{ success: boolean, extractedRows: number, errors: ValidationError[], canFinalize: boolean }` |
| POST | /api/v1/documents/upload/finalize | `application/json`: `{ documentType, fileName, status: 'validated'\|'rejected', rows, errors, fileData }` | `{ success: boolean, documentId: string, status: string, message: string }` |
| GET | /api/v1/documents | Query: `page`, `pageSize`, `type`, `status` | `{ documents: DocumentRow[], totalCount: number, page: number }` |
| GET | /api/v1/documents/{id}/preview | Param: `id` | `{ document: DocumentRow, rows: StagingRow[], totalRows: number }` |
| GET | /api/v1/documents/{id}/validation-detail | Param: `id` | `{ document: DocumentRow, errors: ValidationError[], totalErrors: number }` |
| GET | /api/v1/documents/{id}/download | Param: `id` | `{ downloadUrl: string, fileName: string }` |
| DELETE | /api/v1/documents/{id} | Param: `id`, Origin header check | `{ success: boolean, auditId: string, message: string }` |

---

## Database Functions & Atomic Procedures

### 1. `c1_delete_uploaded_document(p_document_id uuid, p_deleted_by uuid)`
Fungsi basis data PL/pgSQL teroptimasi dengan `SECURITY DEFINER` yang:
1. Memeriksa keberadaan berkas dan memastikan status bukan `processing`.
2. Mencatat metadata berkas ke tabel `c1_document_deletion_audit`.
3. Menghapus baris berkas pada `c1_document_uploads` (otomatis menghapus baris staging terkait melalui foreign key `ON DELETE CASCADE`).
4. Memanggil evaluasi ulang overdue alert jika berkas yang dihapus bertipe `OUTSTANDING_REPORT`.
5. Membersihkan data entitas customer berstatus `UPLOAD` yang tidak lagi memiliki transaksi di tabel staging manapun maupun di tabel pelunasan pembayaran (`c1_cleanup_unreferenced_upload_customers`).
6. Mengkalkulasi ulang data metrik makro bulanan (`c1_macro_metric`) agar dashboard langsung konsisten.

### 2. `c1_cleanup_unreferenced_upload_customers(p_document_id uuid)`
Menghapus customer baru dari `c1_customer` yang berasal dari dokumen terkait (`source_type = 'UPLOAD'`) jika tidak lagi direferensikan pada sales staging, outstanding staging, overdue alert, maupun payment transactions.

---

## Security & Verification Requirements

- Seluruh mutasi dokumen memeriksa header `Origin` untuk mencegah serangan CSRF.
- Sesi pengguna diverifikasi secara server-side menggunakan cookie HttpOnly. Hak upload dan hapus dibatasi khusus pengguna dengan `canUpload === true` (level Staff).
- File CSV ditolak langsung pada lapisan pra-validasi sebelum dibaca ke memori.
- Eksekusi pengujian otomatis dilakukan melalui PostgreSQL terisolasi (PGlite):
  - `npm test` mencakup pengujian parsing format, validasi baris, penolakan CSV, dan penghapusan atomik dokumen.
