# C1_PISD_TR-2709-003: Customer Analytics and Payment Cycle

| Field | Value |
| --- | --- |
| **Document ID** | TR-2709-003 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [C1_PISD_FR-2709-003: Analisis Rincian Customer dan Siklus Pembayaran](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-003-analisis-rincian-customer-dan-siklus-pembayaran-NKu47pZm9y) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan arsitektur teknis basis data, fungsi RPC analitik dinamis, deduplikasi identitas perusahaan, dan integrasi siklus pembayaran pada modul Customer Analytics.

---

## FR-to-TR Relationship  

| Supported FR | Technical Relationship |
| --- | --- |
| [C1_PISD_FR-2709-003: Analisis Rincian Customer dan Siklus Pembayaran](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-003-analisis-rincian-customer-dan-siklus-pembayaran-NKu47pZm9y) | Menyediakan fungsi basis data PostgreSQL RPC `c1_get_customer_analytics`, deduplikasi nama alias, kalkulasi metrik DSO, dan antarmuka riwayat pembayaran invoice. |

---

## Architecture & Technology

| Area | Requirements |
| --- | --- |
| Frontend | React, Next.js App Router, Tailwind CSS, Lucide Icons, Accessible Modal UI. |
| Backend | Next.js API Routes (`app/api/v1/analytics/customers/route.ts` dan `app/api/v1/customers/[customerId]/invoices/route.ts`). |
| Database Engine | PostgreSQL RPC terindeks pada Supabase yang melakukan agregasi dinamis langsung dari baris transaksi tervalidasi dan transaksi pembayaran riil. |
| Optimization | Eliminasi tabel pra-agregasi usang (`c1_customer_monthly_metrics` dan `c1_invoice_detail` telah dibersihkan) demi integritas data langsung dan zero-staleness. |

---

## Logical Data Model

| Entity / Table | Columns & Key Constraints | Description |
| --- | --- | --- |
| `c1_customer` | `customer_id` (uuid pk), `customer_code` (text), `customer_name` (text), `npwp` (text), `branch` (text), `active_status` (boolean), `source_type` (text: 'MASTER'/'UPLOAD') | Master entitas customer dan identitas hasil upload. |
| `c1_company_sales_staging_rows` | `id` (uuid pk), `document_id` (uuid), `period_month` (date), `c1_customer_id` (uuid), `revenue` (numeric), `total_cost` (numeric) | Data penjualan dan biaya operasional per transaksi. |
| `c1_outstanding_staging_rows` | `id` (uuid pk), `document_id` (uuid), `invoice_number` (text), `c1_customer_id` (uuid), `outstanding_amount` (numeric), `due_date` (date), `bulk_close_status` (text) | Data tagihan piutang dan tanggal jatuh tempo. |
| `c1_payment_transactions` | `payment_id` (uuid pk), `invoice_number` (text), `customer_id` (uuid fk -> c1_customer), `amount` (numeric), `payment_date` (date), `reference_no` (text), `entered_by` (uuid), `created_at` (timestamptz) | Catatan pelunasan pembayaran transaksi riil (termasuk auto-settlement dari penagihan). |

---

## Technical Specifications: RPC `c1_get_customer_analytics`

Fungsi PostgreSQL authoritative `public.c1_get_customer_analytics(p_start_date date, p_end_date date, p_search text, p_branch text, p_limit int, p_offset int)` menjalankan alur komputasi:

1. **Deduplikasi Identitas Kanonikal & Pembersihan MAWB**:
   - Menormalkan nama entitas perusahaan dengan memotong spasi dan menghapus penomoran MAWB/AWB yang tertempel di ujung nama (misalnya `"PT ABC 17278941"` dipetakan secara kanonikal ke `"PT ABC"`).
   - Mengelompokkan variasi penulisan entitas anak/cabang ke induk yang sama.
2. **Kalkulasi Metrik Finansial On-The-Fly**:
   - **Sales Profit**: `sum(revenue) - sum(total_cost)`
   - **Net Margin %**: `(Sales Profit / sum(revenue)) * 100`
   - **Total Outstanding**: `sum(outstanding_amount)` dari tagihan belum lunas.
   - **Days Sales Outstanding (DSO)**: `(Total Outstanding / sum(revenue)) * Jumlah_Hari_Periode`
3. **Analisis Tren Pembayaran Dinamis**:
   - Jendela waktu pembayaran tidak dibatasi statis pada bulan penjualan terakhir, melainkan dihitung dinamis:
     - `latest_payment_period = greatest(max(sales_period), max(payment_date))`
     - `earliest_payment_period = least(min(sales_period), min(payment_date))`
   - Menghitung arah tren: `Up` (jika pembayaran bulan terakhir meningkat), `Down` (menurun), `Stable` (konstan), atau `Inactive` (tidak ada pembayaran).
4. **Struktur Payload RPC**:
   Mengembalikan objek JSON terstruktur:
   - `summary`: Ringkasan total customer, total revenue, total profit, total outstanding, rata-rata margin, dan rata-rata DSO.
   - `customers`: Array daftar customer dengan pagination, metrik lengkap, dan array deret riwayat tren pembayaran.

---

## API Contract

### 1. `GET /api/v1/analytics/customers`
- **Query Params**: `branch`, `search`, `page`, `pageSize`, `sortBy`, `sortOrder`, `start_period`, `end_period`.
- **Response**: `{ summary: CustomerKpiSummary, customers: CustomerRow[], totalCount: number, page: number }`.

### 2. `GET /api/v1/customers/{customerId}/invoices`
- **Path Param**: `customerId` (UUID).
- **Logika**: Mengambil daftar invoice tervalidasi dari `c1_outstanding_staging_rows` yang dipetakan ke customer terkait, mencocokkan transaksi pembayaran dari `c1_payment_transactions`, serta menghitung sisa tagihan. Invoice yang lunas menampilkan sisa saldo Rp 0 dan status `PAID`.

---

## Testing & Verification

1. **Unit & RPC Test Suite (`tests/analytics-rpc.test.mjs`)**:
   - Memvalidasi normalisasi nama perusahaan dengan variasi nomor MAWB.
   - Memvalidasi pengelompokan alias customer ke entitas kanonikal.
   - Memvalidasi perhitungan DSO, margin %, dan arah tren pembayaran.
   - Memvalidasi penyertaan transaksi pembayaran bulan berjalan (misal: November 2026) pada grafik tren.
2. **Database Cleanliness**:
   - Memastikan tidak ada kueri ke tabel mati (`c1_customer_monthly_metrics` dan `c1_invoice_detail`).
