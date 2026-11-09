# C1_PISD_TR-1210-006: Overdue Follow-up and Warning

| Field | Value |
| --- | --- |
| **Document ID** | TR-1210-006 |
| **Date** | 12-10-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [C1_PISD_FR-1210-006: Overdue Follow-up, Warning, and Activity Log](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-1210-006-overdue-follow-up-warning-and-activity-log-TSBtfaVpBW) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan arsitektur teknis pencatatan kronologis penagihan, siklus hidup status follow-up, penyuntingan dan penghapusan log riwayat, pembalikan pembayaran otomatis (*automatic payment reversal*), dan generator Surat Peringatan.

---

## FR-to-TR Relationship  

| Supported FR | Technical Relationship |
| --- | --- |
| [C1_PISD_FR-1210-006: Overdue Follow-up, Warning, and Activity Log](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-1210-006-overdue-follow-up-warning-and-activity-log-TSBtfaVpBW) | Menyediakan skema basis data `c1_assignment`, route handler `PATCH` & `DELETE` progres penagihan, alur sinkronisasi transaksi pelunasan, dan generator Surat Peringatan. |

---

## Architecture & Technology

| Area | Requirements |
| --- | --- |
| Frontend | React, Next.js App Router, Tailwind CSS, Dialog Modal dengan backdrop blur, Form validasi inputan, Timeline kronologis. |
| Backend | Route Handlers pada Next.js: `app/api/v1/overdue/[invoiceId]/progress/route.ts` dan `app/api/v1/overdue/[invoiceId]/history/route.ts`. |
| Database | Supabase PostgreSQL: `c1_assignment` dan `c1_payment_transactions`. |
| Relational Decoupling | Pelepasan batasan constraint cascade foreign key (`c1_assignment_invoice_id_fkey`) untuk mencegah terhapusnya riwayat audit penugasan saat tagihan lunas dan dikeluarkan dari tabel alert. |

---

## Logical Data Model

| Entity / Table | Columns & Constraints | Description |
| --- | --- | --- |
| `c1_assignment` | `assignment_id` (uuid pk), `invoice_id` (text not null), `assigned_to` (text not null), `assigned_by` (uuid), `assigned_at` (timestamptz default now()), `follow_up_status` (text: 'ASSIGNED'/'IN_PROGRESS'/'PENDING'/'COMPLETED'), `follow_up_action` (text), `promise_date` (date), `notes` (text), `attachment_url` (text), `payment_amount` (numeric default 0), `updated_by` (uuid), `created_at` (timestamptz default now()) | Tabel terpadu pencatatan penugasan staf PIC, pembaruan status, komitmen janji bayar, dan nominal pelunasan. |
| `c1_payment_transactions` | `payment_id` (uuid pk), `invoice_number` (text not null), `customer_id` (uuid not null), `amount` (numeric not null), `payment_date` (date not null), `reference_no` (text: 'SETTLE-{assignmentId}'), `entered_by` (uuid), `created_at` (timestamptz default now()) | Tabel transaksi pelunasan yang menjadi sumber data grafik pembayaran di modul Customer Analytics. |

---

## API Contract: `app/api/v1/overdue/[invoiceId]/progress/route.ts`

### 1. `POST` - Menambahkan Progres Follow-Up Baru
- **Payload**:
  ```json
  {
    "followUpStatus": "COMPLETED",
    "followUpAction": "Field Visit",
    "promiseDate": "2026-11-15",
    "notes": "Pelunasan penuh via transfer bank",
    "attachmentUrl": null,
    "paymentAmount": 277500,
    "assignedTo": "Kak Ismi"
  }
  ```
- **Logika Settlement Otomatis**:
  Jika `followUpStatus === "COMPLETED"`, sistem memanggil `recordSettlementPaymentInSupabase`:
  - Menyisipkan baris pembayaran ke `c1_payment_transactions` dengan `reference_no = 'SETTLE-' + assignment_id`.
  - Menghapus invoice dari `c1_overdue_alert`.
  - Mengembalikan status HTTP 200 dengan rekaman data terbaru.

### 2. `PATCH` - Menyunting Entri Follow-Up Sebelumnya
- **Payload**: `{ assignmentId, followUpStatus, followUpAction, promiseDate, notes, paymentAmount, assignedTo }`.
- **Logika Sinkronisasi**:
  - Jika status diubah menjadi `COMPLETED`: memperbarui/mencatat transaksi di `c1_payment_transactions` dan menghapus invoice dari alert aktif.
  - Jika status diubah dari `COMPLETED` ke status lain (misal: `IN_PROGRESS`): memanggil `reverseSettlementPaymentInSupabase` untuk membatalkan rekaman pembayaran di `c1_payment_transactions` dan merefresh proyeksi alert overdue.

### 3. `DELETE` - Menghapus Entri Follow-Up
- **Payload**: `{ assignmentId }`.
- **Logika Pembalikan (Reversal)**:
  - Memeriksa apakah entri berstatus `COMPLETED`.
  - Jika `COMPLETED`, sistem menghapus rekaman pembayaran berelasi di `c1_payment_transactions` dan mengevaluasi ulang `c1_refresh_overdue_alerts` agar invoice kembali aktif jika tagihan belum lunas.
  - Menghapus baris entri dari `c1_assignment`.
  - Mengembalikan respons `{ success: true }`.

### 4. `GET /api/v1/overdue/[invoiceId]/history`
- Mengambil array seluruh riwayat penugasan dan follow-up untuk invoice tertentu, diurutkan secara menurun (`assigned_at desc`), dengan deduplikasi mutasi ganda instan.

---

## Testing & Verification

1. **Automated Follow-Up Tests (`tests/overdue-polish.test.mjs`)**:
   - Memvalidasi implementasi handler `PATCH` dan `DELETE` pada route progress.
   - Memvalidasi alur pelunasan otomatis saat status diset `COMPLETED`.
   - Memvalidasi alur reversal saat log `COMPLETED` dihapus.
   - Memvalidasi pelestarian data `c1_assignment` pasca-penghapusan alert overdue.
2. **Security & Session Verification**:
   - Memastikan otorisasi profil CCR (`canUseCcr`) dan validasi sesi server.
