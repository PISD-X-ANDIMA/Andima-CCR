# C1_PISD_TR-2709-004: Overdue Alert MID Feed and Assignment

| Field | Value |
| --- | --- |
| **Document ID** | TR-2709-004 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [C1_PISD_FR-2709-004: Deteksi Dini Overdue Alert dan Assignment](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-004-deteksi-dini-overdue-alert-dan-assignment-Ujab6Rj70Z) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan arsitektur teknis deteksi piutang tertunggak otomatis, fungsi evaluasi basis data `c1_refresh_overdue_alerts`, skema penugasan staf PIC, alur pelunasan otomatis, dan pembersihan tabel feed eksternal lawas.

---

## FR-to-TR Relationship  

| Supported FR | Technical Relationship |
| --- | --- |
| [C1_PISD_FR-2709-004: Deteksi Dini Overdue Alert dan Assignment](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-004-deteksi-dini-overdue-alert-dan-assignment-Ujab6Rj70Z) | Menyediakan fungsi evaluasi otomatis `c1_refresh_overdue_alerts`, klasifikasi aging bucket, mutasi assignment PIC, alur pelunasan atomik, dan pelestarian riwayat tindak lanjut. |

---

## Architecture & Technology

| Area | Requirements |
| --- | --- |
| Frontend | React, Next.js App Router, Tailwind CSS, Dialog Modal, Toast Notifications. |
| Backend | Next.js API Routes (`app/api/v1/overdue-alerts/route.ts` dan `lib/supabaseOverdueApi.ts`). |
| Database Engine | PostgreSQL Stored Procedure pada Supabase untuk proyeksi overdue authoritative, diperbarui saat ingestion berkas atau on-demand. |
| Schema Optimization | Pembersihan tabel mati `c1_mid_feed` dan pelepasan cascade foreign key `c1_assignment_invoice_id_fkey` agar riwayat penugasan tidak terhapus saat tagihan lunas. |

---

## Logical Data Model

| Entity / Table | Columns & Key Constraints | Description |
| --- | --- | --- |
| `c1_overdue_alert` | `alert_id` (uuid pk), `invoice_id` (text unique), `customer_id` (uuid), `c1_customer_id` (uuid), `due_date` (date), `evaluation_date` (date), `overdue_alert` (boolean), `days_overdue` (int), `alert_status` (text: 'Watchlist'/'Medium Risk'/'High Risk'/'Negotiation'), `updated_at` (timestamptz) | Tabel proyeksi tagihan yang sedang mengalami penunggakan aktif. |
| `c1_assignment` | `assignment_id` (uuid pk), `invoice_id` (text not null), `assigned_to` (text), `assigned_by` (uuid), `assigned_at` (timestamptz), `follow_up_status` (text), `follow_up_action` (text), `promise_date` (date), `notes` (text), `attachment_url` (text), `payment_amount` (numeric), `updated_by` (uuid), `created_at` (timestamptz) | Buku besar penugasan PIC dan rekaman progres penagihan. |
| `c1_payment_transactions` | `payment_id` (uuid pk), `invoice_number` (text), `customer_id` (uuid), `amount` (numeric), `payment_date` (date), `reference_no` (text), `entered_by` (uuid) | Transaksi pembayaran yang otomatis tercatat saat status penagihan `COMPLETED`. |

*Catatan: Tabel `c1_mid_feed` telah dihapus secara resmi dari skema basis data.*

---

## Technical Specifications: `c1_refresh_overdue_alerts(p_eval_date date)`

Fungsi PostgreSQL teroptimasi `c1_refresh_overdue_alerts` melakukan proses berikut:
1. Mengambil baris tagihan terbaru dari `c1_outstanding_staging_rows` yang berasal dari dokumen tervalidasi (`c1_document_uploads.validation_status = 'validated'`).
2. Menghitung `days_overdue = p_eval_date - due_date`.
3. Menetapkan status resiko Title Case:
   - `days_overdue > 60` -> `High Risk`
   - `days_overdue > 30` -> `Medium Risk`
   - `days_overdue > 0` -> `Watchlist`
4. **Pengecualian Invoice Lunas**:
   Secara eksplisit mengecualikan tagihan yang:
   - Memiliki riwayat tindak lanjut terbaru di `c1_assignment` dengan `follow_up_status = 'COMPLETED'`.
   - Telah memiliki akumulasi pembayaran di `c1_payment_transactions` yang memenuhi nilai tagihan.
5. Menghapus invoice yang sudah lunas atau saldo outstanding-nya nol dari tabel `c1_overdue_alert`.
6. Melakukan `upsert` pada tabel `c1_overdue_alert` berdasarkan `invoice_id`.

---

## API Contract: `app/api/v1/overdue-alerts/route.ts`

### 1. `GET /api/v1/overdue-alerts`
- **Query Params**: `branch`, `search`, `status`, `agingBucket`, `onlyOverdue30`.
- **Response**: `{ kpiSummary: OverdueKpiSummary, totalItems: number, invoices: OverdueInvoiceRow[], fromDb: boolean }`.
- **Server-Timing Headers**: Mengembalikan metrik durasi autentikasi dan kueri basis data pada header respons HTTP.

### 2. `POST /api/v1/overdue-alerts`
- **Actions**:
  - `EVALUATE`: Memanggil `evaluateOverdueAlertsInSupabase()` untuk menyegarkan proyeksi keterlambatan.
  - `ASSIGN_PIC`: Menerima `{ invoiceId, assignedTo, notes }` untuk menambahkan penugasan pada `c1_assignment`.
  - `BATCH_MID_ESCALATION`: Mengembalikan `{ success: true, count: number, deprecated: true }` tanpa menulis ke tabel usang.

---

## Testing & Verification

1. **Overdue Refresh Test (`tests/api-database.test.mjs`)**:
   - Memverifikasi refresh alert overdue hanya mengambil dokumen tervalidasi.
   - Memverifikasi pembersihan alert basi saat tagihan baru masuk.
   - Memverifikasi kalkulasi hari jatuh tempo dan klasifikasi status resiko Title Case.
2. **Settlement & History Test (`tests/overdue-polish.test.mjs`)**:
   - Memvalidasi invoice yang diberi status `COMPLETED` otomatis terhapus dari `c1_overdue_alert`.
   - Memvalidasi pembayaran tercatat di `c1_payment_transactions`.
   - Memvalidasi bahwa riwayat penugasan di `c1_assignment` tetap utuh.
