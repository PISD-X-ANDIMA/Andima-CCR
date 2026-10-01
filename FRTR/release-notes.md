# Release Notes C1

## Informasi Release

- **Branch:** `feat/c1-mergefeatc1`
- **Commit terakhir:** `24f6b28`
- **Area:** C1 Sales Overview, Document Upload & Validation, Overdue Alert, Customer Analytics, authentication, dan Supabase database.
- **Status:** Siap untuk review dan verifikasi deployment sesuai checklist di bawah.

Catatan ini merangkum perubahan yang sudah tercatat pada branch sampai commit terakhir. Perubahan lokal yang belum committed tidak termasuk dalam release notes.

## Fitur Baru

### Sales Overview

- Kartu macro untuk Sales Profit, Cost, Outstanding, dan Net Margin Ratio.
- Grafik Revenue, Cost, dan Outstanding.
- Pemilihan rentang periode bulanan.
- Empty state dan loading state ketika data tervalidasi belum tersedia.
- Akses Sales Overview untuk role `HR`/staff dan `MANAGER`/management.
- Refresh data setelah proses upload tervalidasi.

### Document Upload & Validation

- Upload Company Sales Report dan Outstanding Report.
- Drag-and-drop dan file browser.
- Dukungan `.xlsx`, `.xls`, `.csv`, dan PDF text-based.
- Validasi tipe file, ukuran file, schema, customer, invoice, nominal, periode, dan tanggal.
- Penyimpanan metadata upload, validation errors, staging rows, dan file asli di Storage.
- File gagal tidak diteruskan ke staging atau agregasi metric.
- Dashboard dapat dimuat ulang setelah upload berhasil.

### Overdue Alert

- Daftar invoice overdue.
- Filter cabang, status, aging bucket, dan pencarian.
- Pagination daftar alert.
- Assignment PIC.
- Batch escalation ke MID feed.
- Warning letter generator.

### Customer Analytics

- Ringkasan KPI customer.
- Data invoice dan statement of account.
- Inspection drawer untuk detail customer.
- Pagination, filter, dan sorting data customer.

### Authentication dan Account Provisioning

- Login dengan Supabase Auth.
- Registration dan email confirmation.
- Provisioning employee profile.
- Mapping application role berdasarkan position.
- Role enum `EMPLOYEE`, `HR`, dan `MANAGER`.

### Shared Application Shell

- Sidebar aplikasi bersama.
- Header dan account information.
- Navigasi halaman C1.
- Layout responsive untuk desktop dan mobile.

## Backend dan Database

### Endpoint

- `GET /api/v1/analytics/macro`
- `POST /api/v1/documents/upload`
- `GET /api/v1/documents/{id}/validation`
- `GET /api/v1/overdue-alerts`
- `POST /api/v1/overdue-alerts`
- `GET /api/v1/customers/analytics`
- `GET /api/v1/customers/{customerId}/invoices`
- `GET /api/v1/customers/{customerId}/statement`
- `POST /api/auth/provision-registration`
- `GET /auth`
- `GET /api/v1/export`

Endpoint upload menerapkan validasi server-side, batas ukuran file 5 MB, authentication, authorization, dan cleanup ketika persistence gagal. Endpoint macro hanya membaca metric berstatus tervalidasi dan menghitung:

```text
sales_profit = revenue - cost
```

### Tabel dan storage utama

- `c1_macro_metric`
- `c1_document_uploads`
- `c1_document_validation_errors`
- `c1_company_sales_staging_rows`
- `c1_outstanding_staging_rows`
- `c1_overdue_alert`
- `c1_assignment`
- `c1_mid_feed`
- `c1_export_request`
- `c1_export_file`
- `d3_user_access`
- `d3_employee`
- `d3_positions`
- `d3_departments`
- `a1_company_list`
- Private Storage bucket `c1-document-uploads`

### Security dan persistence

- RLS diterapkan pada metric, metadata upload, staging, validation errors, dan Storage.
- Role access menggunakan enum `EMPLOYEE`, `HR`, dan `MANAGER`.
- Role ditentukan berdasarkan mapping position pada provisioning.
- File divalidasi sebelum persistence valid dilakukan.
- File rejected tidak masuk staging atau agregasi macro.
- Kegagalan Storage atau staging memicu cleanup untuk mencegah orphan data.
- Agregasi ke `c1_macro_metric` dijalankan setelah seluruh row dokumen tervalidasi.

## Perubahan Teknis

- Parser PDF text-based diperbaiki dengan konfigurasi worker PDF.js yang sesuai runtime Next.js.
- Kolom `Company` dinormalisasi sebagai `customer` untuk Sales Report dan Outstanding Report.
- Parsing angka Rupiah dan variasi header dokumen diperkuat.
- Customer matching dilakukan terhadap `a1_company_list`.
- Data overdue disamakan antara Sales Overview dan Overdue Alert melalui adapter bersama.
- Duplicate React key pada daftar alert diperbaiki.
- Import sidebar diseragamkan agar sesuai kapitalisasi nama file.
- Header dan layout antar halaman diselaraskan.
- Pagination, skeleton loading, empty state, dan tooltip formula macro diperbaiki.
- Chart Sales Overview menampilkan Revenue, Cost, dan Outstanding.

## Database dan Deployment

Migration C1 yang relevan meliputi:

- `20261001000000_create_macro_metric.sql`
- `20261002000000_create_document_ingestion.sql`
- `20261002010000_allow_c1_document_cleanup.sql`
- `20261002020000_align_sales_overview_roles.sql`
- `20261002030000_seed_c1_sales_overview_demo_data.sql`
- `20261002040000_enforce_c1_upload_roles.sql`

Environment variable yang dibutuhkan:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` untuk operasi Admin API server-side

`SUPABASE_SERVICE_ROLE_KEY` tidak boleh diekspos ke browser atau di-commit ke repository. File `.env*` juga tidak boleh dipush.

Perintah deployment dan verifikasi:

```bash
npm install
npm run typecheck
npm run lint
npx supabase db push
npx supabase migration list
npm run build
```

## Known Limitations

- OCR untuk PDF scan/image-only belum tersedia.
- PDF harus memiliki text layer yang dapat diekstrak.
- Export belum sepenuhnya aktif pada beberapa area UI.
- Latency upload bergantung pada environment Supabase dan belum menjadi SLA tetap.
- Repository masih memiliki lint error legacy di luar area perubahan C1.
- Data demo/fixture masih menjadi fallback pada modul tertentu ketika data database belum tersedia.
- Automated integration test endpoint belum lengkap.

## Verification Checklist

- [ ] Login dan email confirmation berhasil.
- [ ] Role HR dapat upload dan melihat Sales Overview.
- [ ] Role Manager dapat melihat Sales Overview tanpa kontrol upload.
- [ ] Role Employee ditolak dari endpoint yang dibatasi.
- [ ] Company Sales Report valid berhasil diproses.
- [ ] Outstanding Report valid berhasil diproses.
- [ ] File invalid tidak masuk Storage atau staging.
- [ ] Dashboard berubah setelah upload valid.
- [ ] Data overdue konsisten di Sales Overview dan Overdue Alert.
- [ ] Customer Analytics memuat KPI, invoice, dan statement.
- [ ] `npm run typecheck` berhasil.
- [ ] `npm run lint` sudah ditinjau.
- [ ] `npm run build` berhasil.
- [ ] Migration Supabase sudah diterapkan.
