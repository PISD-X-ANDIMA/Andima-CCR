# Catatan Rilis Modul C1 (CCR)

Daftar rilis sistem Credit Control & Recovery (CCR) PT Andima Transportindo:
- [Release Notes C1 - 9 November 2026](#release-notes-c1---9-november-2026) *(Rilis Terbaru)*
- [Release Notes C1 - 16 Oktober 2026](#release-notes-c1---2026-10-16)

---

# Release Notes C1 - 9 November 2026

## Informasi Release

- **Branch:** `feat/C1-bugfix`
- **Tanggal:** 9 November 2026
- **Area:** Database Cleanup, Overdue Alert Settlement & History Preservation, Follow-up Log Editing & Deletion with Reversal, Customer Analytics Dynamic Trends & Deduplication, Client-Side Multi-Format Export, System-Wide English Localization.
- **Status:** Production-Ready & Fully Verified (58 Automated Tests Passing, 0 Typecheck Errors).
- **Dokumen Terpisah:** [release-notes-2026-11-09.md](./release-notes-2026-11-09.md)

## Ringkasan Eksekutif

Rilis ini menyelesaikan pembersihan besar pada skema basis data C1 (*Dead Tables Cleanup*), mengintegrasikan alur pelunasan tagihan tertunggak secara otomatis dengan grafik tren pembayaran Customer Analytics, menyediakan fitur penyuntingan dan penghapusan riwayat penagihan dengan pembalikan transaksi otomatis (*automatic payment reversal*), melepaskan batasan cascade foreign key untuk menjamin keabadian riwayat audit penugasan, menyempurnakan deduplikasi nama perusahaan dan nomor MAWB, serta menerapkan lokalisasi Bahasa Inggris baku di seluruh antarmuka sistem.

## Fitur Utama & Pembaruan

### 1. Pembersihan Basis Data C1 (Dead Tables Cleanup & Decoupling)
- Menghapus 5 tabel usang dengan `CASCADE`: `c1_mid_feed`, `c1_customer_monthly_metrics`, `c1_invoice_detail`, `c1_export_file`, dan `c1_export_request`.
- Mempertahankan 10 tabel operasional aktif tanpa menyentuh tabel non-`c1_`.
- Mendekopel stored procedures dan kode backend dari dependensi tabel mati.

### 2. Alur Pelunasan Tagihan Overdue & Sinkronisasi Tren Pembayaran
- Memberi status `COMPLETED` otomatis mencatat pembayaran ke `c1_payment_transactions` dan menghapus invoice dari `c1_overdue_alert`.
- Pembayaran langsung tercermin di grafik Tren Pembayaran Customer Analytics bulan berjalan.

### 3. Penyuntingan & Penghapusan Riwayat Follow-Up (Edit & Delete Log)
- Menambahkan tombol "Edit Log" dan "Delete Log" pada kartu riwayat penagihan.
- Menghapus atau mengubah log `COMPLETED` secara otomatis membalikkan pembayaran pelunasan dan mengevaluasi ulang status overdue invoice.

### 4. Pelestarian Riwayat Penugasan (FK Decoupling)
- Pelepasan cascade FK `c1_assignment_invoice_id_fkey` menjamin riwayat penugasan dan audit tetap tersimpan permanen saat tagihan lunas.

### 5. Jendela Tren Pembayaran Dinamis & Deduplikasi Identitas Customer
- Perhitungan seri waktu pembayaran dinamis mencakup transaksi bulan berjalan (misal: November 2026).
- Pembersihan nomor MAWB tertanam pada nama customer dan penggabungan entitas kanonikal.

### 6. Lokalisasi Bahasa Inggris Menyeluruh (System-Wide English)
- Seluruh antarmuka, label status resiko Title Case (`High Risk`, `Medium Risk`, `Watchlist`, `Negotiation`), dan pesan status menggunakan Bahasa Inggris baku.
- Catatan bebas tindak lanjut staf tetap mempertahankan bahasa input asli pengguna.

### 7. Ekspor Streaming Multi-Format & Generator Surat Peringatan
- Ekspor instan Excel (.xlsx), PDF (.pdf), dan CSV langsung dari peramban.
- Generator Surat Peringatan resmi multi-halaman berjenjang (`SP-1`, `SP-2`, `SP-3`) dengan rekening Bank Mandiri PT Andima Transportindo.

---

# Release Notes C1 - 2026-10-16

## Informasi Release

- **Branch:** `feat/c1-mergefeatc1`
- **Commit dasar:** `2084b25` (`Feat: Implementing Assignment Overude`)
- **Tanggal:** 16 Oktober 2026
- **Area:** Sales Overview, Document Upload, Overdue Alert, Customer Analytics, Warning Letter, authentication, dan deployment.
- **Status:** Siap untuk preview dan review. Perbaikan konfigurasi Preview pada bagian deployment masih berupa perubahan lokal yang belum di-commit.

Preview deployment terbaru: `https://andima-jpgyuwflh-stevanus-projects-4471719.vercel.app`

Vercel Preview Protection aktif; akses browser memerlukan akun yang memiliki akses ke project.

## Ringkasan

Release ini menyatukan ingest dokumen, analytics C1, proyeksi overdue, assignment PIC, analisis customer, dan pembuatan surat peringatan. Dashboard hanya menghitung staging tervalidasi dan browser berkomunikasi melalui API server-side.

## Fitur Utama

### Sales Overview

- Macro metrics revenue, cost, profit, outstanding, dan margin berdasarkan rentang periode.
- Filter rolling `1`, `3`, `6`, `12 Bulan` serta rentang custom.
- Series bulanan zero-filled dan chart responsive untuk Revenue, Cost, serta Total Outstanding.
- Loading, empty, error state, tooltip currency, legend, active dot, dan refresh setelah upload.
- Tabel dokumen terbaru, preview staging, dan export ringkasan analytics CSV.

### Document Upload

- Upload `COMPANY_SALES_REPORT` dan `OUTSTANDING_REPORT` untuk `.xlsx`, `.xls`, `.csv`, dan PDF text-based.
- Validasi server-side untuk schema, customer, invoice, nominal, periode, tanggal, dan ukuran file.
- Nama customer dari file dipertahankan setelah trim walaupun tidak cocok dengan master.
- Customer non-empty yang tidak ditemukan otomatis dibuat di `c1_customer` dengan provenance `UPLOAD` dan deduplikasi nama/kode.
- Row unmatched tetap valid, disimpan di staging, dan dilaporkan melalui warning `UNKNOWN_CUSTOMER` serta `unmatchedCustomerCount`.

### Overdue Alert

- `c1_refresh_overdue_alerts(date)` menjadi proyeksi overdue authoritative dari outstanding tervalidasi.
- Invoice terbaru dipilih berdasarkan normalized invoice number; alert stale atau outstanding nol dibersihkan.
- Nama customer upload, customer ID legacy, dan `c1_customer_id` dipertahankan.
- Sales Overview dan halaman Overdue Alert memakai sumber proyeksi yang sama.
- Filter branch/status/aging/search, pagination, default `>30 hari`, assignment staff dropdown, checklist selection, history, dan refresh tetap tersedia.
- KPI overdue mencakup total active customer, high-risk outstanding, dan top contributing customer.

### Customer Analytics

- Filtering, sorting, pagination, dan agregasi menggunakan RPC C1 terindeks.
- KPI global tetap tersedia ketika filter menghasilkan daftar customer kosong.
- Tidak ada auto-selection; empty state tampil sebelum customer dipilih.
- Klik row memilih customer dan mengaktifkan checklist; pilihan sebelumnya di-reset.
- Kolom alamat serta ringkasan job/aktivitas dihapus; skeleton ditambahkan pada KPI, filter, tabel, pagination, dan detail drawer.

### Warning Letter

- Mapping otomatis: `1-29 hari` belum eligible, `30-59` `SP-1`, `60-90` `SP-2`, dan `>90` `SP-3`.
- Level, nomor registrasi, PIC, dan catatan internal read-only; tanggal terbit/deadline memakai kalender.
- Isi surat memuat rekening dummy Bank Mandiri `1234-5678-9012` a.n. `PT Andima Transportindo`.
- Tanda tangan disederhanakan menjadi `Hormat kami`, PIC, `Credit Controller`, dan `PT Andima Transportindo`.
- `Simpan Draf` mengunduh `Draft-SP-{invoice}.pdf`; `Kirim SP Sekarang` mengunduh `Surat-Peringatan-{level}-{invoice}.pdf`.

## Backend, API, dan Database

Endpoint penting:

- `GET /api/v1/analytics/macro`
- `GET /api/v1/analytics/macro/export`
- `GET /api/v1/customers/analytics`
- `POST /api/v1/documents/upload`
- `GET /api/v1/documents/recent`
- `GET /api/v1/documents/{id}/preview`
- `GET /api/v1/overdue`
- `POST /api/v1/overdue/evaluate`
- `GET /api/v1/overdue/staff`

Semua endpoint melakukan authorization CCR terlebih dahulu, memakai admin/service-role client hanya di server, mengembalikan `Cache-Control: no-store, max-age=0`, dan menyertakan `Server-Timing` jika relevan. Error konfigurasi atau response kosong dikembalikan sebagai JSON yang dapat ditangani client.

RPC utama:

- `c1_get_sales_overview_analytics`
- `c1_get_customer_analytics`
- `c1_refresh_overdue_alerts`

Migration utama meliputi optimasi analytics/overdue, dokumen Sales Overview, reset dependency, index customer reference, refresh overdue, preservasi identity, backfill alert, dan perbaikan KPI customer analytics (`20261015000000` sampai `20261018000000`).

`c1_customer_id` menjaga relasi customer hasil upload tanpa memutus relasi legacy. Index mendukung period, document validation, invoice/date, customer reference, branch, latest metrics, dan invoice payment status.

## Security dan Deployment

- `SUPABASE_SERVICE_ROLE_KEY` atau `SUPABASE_SECRET_KEY` hanya digunakan oleh helper server admin.
- Tidak ada koneksi database langsung dari frontend dan tidak ada service-role credential di browser.
- `.vercelignore` mengecualikan `.env*`, `.vercel`, `.next`, `node_modules`, dan log dari upload deployment.
- `pnpm dev` memakai `next dev --webpack` untuk menghindari panic HMR Turbopack; `pnpm dev:turbo` tetap tersedia.
- `readJsonResponse` menangani response Preview yang kosong/non-JSON agar tidak terjadi `Unexpected end of JSON input`.

## Verifikasi

- `pnpm test`: 21/21 test berhasil.
- `pnpm typecheck`: berhasil.
- `pnpm build`: berhasil pada Preview deployment.
- Smoke test endpoint tanpa session mengembalikan JSON `UNAUTHENTICATED`.
- `GET /api/auth/register` pada Preview berhasil mengambil position dan department.

Sebelum production, terapkan migration pada Supabase target dan lakukan smoke test authenticated untuk upload kedua jenis report, refresh dashboard, Customer Analytics, Overdue Alert, assignment PIC, dan download PDF warning letter.

## Known Limitations

- OCR PDF scan/image-only belum tersedia; PDF memerlukan text layer.
- Target latency `P95 <= 200 ms` bergantung dataset, region, cold start, dan jaringan.
- Preview Protection Vercel membatasi akses browser kepada anggota project.
- Pengiriman surat masih berupa download PDF lokal, belum email atau kanal eksternal.
- Rekening pembayaran masih dummy dan harus diganti sebelum production.
- Benchmark authenticated production dan verifikasi migration remote masih perlu dilakukan pada environment target.

## Checklist Release

- [ ] Environment Preview/Production memiliki URL dan publishable key Supabase.
- [ ] Environment server memiliki `SUPABASE_SERVICE_ROLE_KEY` atau `SUPABASE_SECRET_KEY`.
- [ ] Migration C1 dan RPC sudah diterapkan pada target.
- [ ] Upload sales report dan outstanding report muncul di dashboard terkait.
- [ ] Customer unmatched tersimpan di `c1_customer` tanpa duplikasi.
- [ ] Customer Analytics menampilkan KPI, empty state, selection, dan skeleton.
- [ ] Assignment PIC memakai staff dropdown dan tersimpan setelah refresh.
- [ ] Invoice 1-29 hari tidak dapat menerbitkan SP.
- [ ] Draft dan surat terkirim dapat diunduh sebagai PDF dengan nama file benar.
- [ ] `pnpm test`, `pnpm typecheck`, dan build Preview berhasil.
