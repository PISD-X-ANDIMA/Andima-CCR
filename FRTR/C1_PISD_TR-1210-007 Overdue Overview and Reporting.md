# C1_PISD_TR-1210-007: Overdue Overview and Reporting

| Field | Value |
| --- | --- |
| **Document ID** | TR-1210-007 |
| **Date** | 12-10-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [C1_PISD_FR-1210-007: Overdue Overview and Reporting](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-1210-007-overdue-overview-and-reporting-WejJucBthC) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan kebutuhan teknis untuk agregasi metrik KPI keterlambatan pembayaran, query penyaringan multi-dimensi, kontrol otorisasi berbasis peran (RBAC), serta metrik performa antarmuka pada modul Overdue Alert.

---

## FR-to-TR Relationship  

| Supported FR | Technical Relationship |
| --- | --- |
| [C1_PISD_FR-1210-007: Overdue Overview and Reporting](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-1210-007-overdue-overview-and-reporting-WejJucBthC) | Menyediakan query agregasi KPI overdue, filter operasional server-side, kontrol seleksi baris checklist, dan integrasi modal pratinjau invoice. |

---

## Architecture & Technology

| Area | Requirements |
| --- | --- |
| Frontend | React, Next.js 14 App Router, Tailwind CSS, Lucide Icons, Checkbox selection state, Dynamic Action Buttons. |
| Backend | Next.js API Route Handler (`app/api/v1/overdue-alerts/route.ts`). |
| Database | Supabase PostgreSQL: `c1_overdue_alert`, `c1_assignment`, `c1_customer`, dan staging data. |
| Performance Headers | Header HTTP `Server-Timing` untuk memantau durasi waktu autentikasi dan kueri basis data. |

---

## Logical Data Aggregation & Query Logic

Kueri pada endpoint `GET /api/v1/overdue-alerts` melakukan alur:
1. **Autentikasi & RBAC**:
   - Memeriksa sesi pengguna via `requireSession()`.
   - Mengambil profil CCR pengguna melalui `getCcrProfile()`.
   - Jika role pengguna adalah `STAFF`, daftar invoice difilter sehingga staf hanya melihat invoice yang ditugaskan kepada dirinya (`pic_assigned === profile.employee_id || pic_assigned === profile.full_name`).
   - Jika role pengguna adalah `MANAGEMENT`, pengguna dapat melihat seluruh invoice overdue perusahaan.
2. **Kueri Data Terpadu**:
   - Mengambil invoice aktif dari `c1_overdue_alert`.
   - Menggabungkan data penugasan terbaru dari `c1_assignment`.
   - Melakukan resolusi nama entitas customer dan cabang dari `c1_customer` dengan fallback ke nama pada staging report.
3. **Penyaringan Server-Side**:
   - Branch: Pencocokan cabang atau "All Branches".
   - Search: Pencocokan teks pada `invoice_number`, `customer_name`, atau `npwp`.
   - Status: Pencocokan status resiko Title Case (`High Risk`, `Medium Risk`, `Watchlist`, `Negotiation`).
   - Aging Bucket:
     - `1 - 30 Days`: `days_overdue >= 1 and days_overdue <= 30`
     - `31 - 60 Days`: `days_overdue >= 31 and days_overdue <= 60`
     - `> 60 Days`: `days_overdue > 60`
4. **Kalkulasi KPI Summary (`calculateOverdueKpi`)**:
   - `totalInvoices`: Jumlah total lembar tagihan tertunggak hasil filter.
   - `totalAmount`: Akumulasi nominal saldo terutang.
   - `highRiskAmount`: Akumulasi tagihan dengan status `High Risk` (`days_overdue > 60`).
   - `activeCases`: Jumlah customer unik yang memiliki tagihan overdue.

---

## Response Structure

```json
{
  "kpiSummary": {
    "totalInvoices": 306,
    "totalAmount": 4589200000,
    "highRiskAmount": 1280000000,
    "activeCases": 42
  },
  "totalItems": 306,
  "invoices": [
    {
      "id": "INV-2026-001",
      "invoice_number": "INV-2026-001",
      "customer_id": "c7a8b9c0-...",
      "customer_name": "PT Jaya Abadi Transport",
      "branch": "Jakarta",
      "npwp": "01.234.567.8-012.000",
      "days_overdue": 45,
      "risk_status": "Medium Risk",
      "total_amount": 15000000,
      "outstanding_amount": 15000000,
      "pic_assigned": "Kak Ismi",
      "due_date": "2026-09-25",
      "issued_date": "2026-08-25"
    }
  ],
  "fromDb": true
}
```

---

## Testing & Verification

1. **Automated Route Test (`tests/api-database.test.mjs`)**:
   - Memvalidasi pembatasan akses berdasarkan role CCR (`STAFF` vs `MANAGEMENT`).
   - Memvalidasi penyaringan aging bucket dan status resiko.
   - Memvalidasi kalkulasi ringkasan KPI.
2. **UI Polish Test (`tests/overdue-polish.test.mjs`)**:
   - Memvalidasi konsistensi label Title Case status resiko.
   - Memvalidasi aktivasi tombol checklist saat baris tabel dipilih.
   - Memvalidasi tata letak lebar formulir dan tombol navigasi Back.
