# C1_PISD_FR-2709-001: Unggah dan Validasi Dokumen Mandiri

| Field | Value |
| --- | --- |
| **Document ID** | FR-2709-001 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [User Story 1: Antarmuka Pengunggahan Berkas Mandiri](https://docmost.ayutrans.id/s/ccr/p/user-story-1-antarmuka-pengunggahan-berkas-mandiri-qheex47vmh) [User Story 2: Validasi Mandiri Struktur Skema Berkas](https://docmost.ayutrans.id/s/ccr/p/user-story-2-validasi-mandiri-struktur-skema-berkas-ejmXxCewUo) [User Story 3: Pemrosesan Berkas Laporan Penjualan (Company Sales Report)](https://docmost.ayutrans.id/s/ccr/p/user-story-3-pemrosesan-berkas-laporan-penjualan-company-sales-repor-UZENbehPET) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan kebutuhan fungsional untuk mengunggah, memvalidasi, mengelola, serta menghapus dokumen Company Sales Report dan Data Outstanding secara mandiri pada modul CCR.

---

## Description

Sistem menyediakan area pengunggahan dokumen mandiri untuk berkas Company Sales Report dan Data Outstanding, menjalankan validasi integritas struktur kolom melalui mekanisme validasi preflight, menyimpan data tervalidasi ke staging layer, menyelesaikan identitas customer baru secara otomatis, serta menyediakan manajemen dokumen mandiri (pratinjau, pengunduhan, dan penghapusan dokumen beserta rollback metrik secara atomik).

---

## Scope and Users

| Item | Value |
| --- | --- |
| Scope | Upload berkas spreadsheet (.xlsx, .xls) dan PDF text-based; validasi preflight; finalisasi berkas tervalidasi atau ditolak; penyimpanan ke staging layer; pembuatan customer upload otomatis; serta penghapusan berkas mandiri beserta cascade rollback. |
| Actor / user role | Finance, Accounting & Tax Department; Billing/Cash Management; Role Level Admin/Staff (`STAFF`) untuk aksi upload dan delete; Role Level Management (`MANAGEMENT`) untuk review/monitoring. |

**List of Available Users:**
- **Level Admin / Staff (`STAFF`)**: Accounting Associates / Billing, Cash Management, Tax Associates, Sales Executives, Sales Administration Associates.
- **Level Management / Supervisor (`MANAGEMENT`)**: Director of Finance, Accounting & Digital Transformation, Manager of Accounting, Manager of Customer Success.

---

## Functional Requirements

- **FR-CCR-001-01 Area Pengunggahan Dokumen**  
  Sistem menyediakan area drag-and-drop dan file browser terpadu untuk mengunggah dokumen Company Sales Report (`COMPANY_SALES_REPORT`) dan Data Outstanding (`OUTSTANDING_REPORT`).
- **FR-CCR-001-02 Validasi Format dan Batas Berkas**  
  Sistem menerima berkas spreadsheet berformat `.xlsx`, `.xls`, dan PDF tabel berbasis teks dengan batas ukuran maksimal 10MB. Berkas dengan format `.csv` ditolak secara preflight dengan pesan kesalahan terstruktur.
- **FR-CCR-001-03 Validasi Skema Berkas Preflight**  
  - **Company Sales Report**: Memeriksa kolom periode bulan (`period`), nama customer (`customer`), kode customer opsional, nilai pendapatan (`revenue`), dan rincian komponen biaya operasional (trucking, handling, storage, other costs).
  - **Data Outstanding**: Memeriksa kolom nomor invoice (`invoice`), nama customer (`customer`), kode customer opsional, nominal tagihan (`amount`), dan tanggal jatuh tempo (`due date`).
- **FR-CCR-001-04 Resolusi dan Deduplikasi Customer Otomatis**  
  Sistem memetakan customer berdasarkan kode customer atau nama customer. Apabila nama customer belum terdaftar pada master, sistem secara otomatis mendaftarkan customer baru ke tabel `c1_customer` dengan penanda provenance `source_type = 'UPLOAD'` serta melakukan normalisasi nama (menghapus variasi nomor MAWB tertanam).
- **FR-CCR-001-05 Alur Finalisasi (Validated & Rejected)**  
  - Jika berkas lolos validasi, pengguna memfinalisasi berkas sehingga berkas asli disimpan di bucket storage `c1_documents` dan baris data masuk ke staging layer (`c1_company_sales_staging_rows` atau `c1_outstanding_staging_rows`).
  - Jika berkas memiliki galat validasi, pengguna dapat memfinalisasi sebagai status `rejected` untuk mencatat audit kesalahan tanpa menyimpan berkas biner di Storage, atau membatalkan proses upload.
- **FR-CCR-001-06 Manajemen dan Penghapusan Dokumen Mandiri (Self-Service Deletion)**  
  Pengguna dengan role `STAFF` dapat melihat riwayat dokumen, mengunduh berkas tervalidasi, melihat pratinjau data staging, serta menghapus dokumen yang sudah diproses. Penghapusan dokumen secara atomik menghapus baris staging terkait, membersihkan customer upload yang tidak lagi direferensikan (`c1_cleanup_unreferenced_upload_customers`), mencatat audit penghapusan di `c1_document_deletion_audit`, serta memicu kalkulasi ulang metrik makro (`c1_macro_metric`) dan alert overdue.

---

## Business Rules

1. Berkas dengan format tidak didukung (seperti CSV), melebihi 10MB, kolom wajib kosong, atau skema tabel rusak ditolak dengan visual error banner dan rincian galat baris per baris.
2. Berkas berstatus `processing` tidak dapat dihapus sampai proses selesai.
3. Baris staging dari dokumen yang berstatus `rejected` tidak dimasukkan ke dalam perhitungan analitik maupun deteksi overdue.
4. Sistem tidak melakukan penarikan data langsung (auto-pull) dari ERP, Smart Accounting, atau database eksternal di luar sistem.

---

## API Endpoint Contract

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| POST | /api/v1/documents/upload/preflight | Melakukan parsing dan validasi berkas multipart tanpa persistensi data. | Staff (`STAFF`) |
| POST | /api/v1/documents/upload/finalize | Memfinalisasi dokumen menjadi status `validated` (menyimpan ke Storage & staging) atau `rejected`. | Staff (`STAFF`) |
| GET | /api/v1/documents | Mengambil daftar dokumen upload beserta filter status, pagination, dan metadata. | Staff & Management |
| GET | /api/v1/documents/{id}/preview | Mengambil pratinjau baris staging dari dokumen tervalidasi. | Staff & Management |
| GET | /api/v1/documents/{id}/validation-detail | Mengambil rincian galat validasi baris per baris untuk dokumen berstatus rejected. | Staff & Management |
| GET | /api/v1/documents/{id}/download | Menghasilkan URL unduhan berkas asli dari Supabase Storage. | Staff & Management |
| DELETE | /api/v1/documents/{id} | Menghapus dokumen, baris staging, membersihkan customer upload yatim, dan rollback metrik. | Staff (`STAFF`) |

---

## Acceptance Criteria

1. Pengguna level `STAFF` dapat mengunggah berkas `COMPANY_SALES_REPORT` dan `OUTSTANDING_REPORT` melalui drag-and-drop atau file browser.
2. Sistem menolak berkas non-spreadsheet atau CSV dan berkas berukuran lebih dari 10MB dengan pesan error yang jelas.
3. Validasi preflight menampilkan ringkasan jumlah baris tervalidasi dan rincian temuan galat sebelum pengguna menekan tombol finalisasi.
4. Finalisasi berkas valid menyimpan baris data ke staging layer dan menyimpan berkas asli ke Supabase Storage.
5. Customer baru dari berkas upload otomatis tercatat pada `c1_customer` dengan `source_type = 'UPLOAD'`.
6. Pengguna `STAFF` dapat menghapus dokumen yang telah diunggah; sistem secara atomik menghapus baris staging terkait, membersihkan customer upload yang tidak lagi terpakai, dan merefresh metrik makro.

---

## Source Traceability

| Source | Requirements Coverage |
| --- | --- |
| [User Story 1: Antarmuka Pengunggahan Berkas Mandiri](https://docmost.ayutrans.id/s/ccr/p/user-story-1-antarmuka-pengunggahan-berkas-mandiri-qheex47vmh) | Area upload, format berkas, penanganan ukuran berkas, dan audit rekam jejak. |
| [User Story 2: Validasi Mandiri Struktur Skema Berkas](https://docmost.ayutrans.id/s/ccr/p/user-story-2-validasi-mandiri-struktur-skema-berkas-ejmXxCewUo) | Preflight validation, error reporting per baris, dan penolakan skema rusak. |
| [User Story 3: Pemrosesan Berkas Laporan Penjualan](https://docmost.ayutrans.id/s/ccr/p/user-story-3-pemrosesan-berkas-laporan-penjualan-company-sales-repor-UZENbehPET) | Staging Company Sales Report, pemisahan biaya operasional, dan resolusi customer. |
