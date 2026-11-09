# C1_PISD_TR-2709-002: Macro Visualization of Sales, Cost, and Outstanding

| Field | Value |
| --- | --- |
| **Document ID** | TR-2709-002 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [C1_PISD_FR-2709-002: Visualisasi Makro Sales Cost dan Outstanding](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-002-visualisasi-makro-sales-cost-dan-outstanding-o8Rd0V0QWp) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan kebutuhan teknis untuk pemrosesan data agregasi makro penjualan, pengeluaran biaya operasional, dan saldo piutang tertunggak pada dashboard Sales Overview.

---

## FR-to-TR Relationship  

| Supported FR | Technical Relationship |
| --- | --- |
| [C1_PISD_FR-2709-002: Visualisasi Makro Sales Cost dan Outstanding](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-002-visualisasi-makro-sales-cost-dan-outstanding-o8Rd0V0QWp) | Menyediakan query agregasi basis data, endpoint API ringkasan makro, penyusunan deret waktu bulanan zero-filled, dan kalkulasi rasio margin. |

---

## Architecture & Technology

| Area | Requirements |
| --- | --- |
| Frontend | React, Next.js App Router, Tailwind CSS, Recharts untuk rendering kurva time-series responsif, dan Lucide Icons. |
| Backend | Next.js API Route Handler (`app/api/v1/analytics/macro/route.ts`). Mengambil baris metrik teragregasi dan memetakan rentang bulan. |
| Database | Tabel `c1_macro_metric` pada Supabase PostgreSQL, diperbarui secara inkremental oleh transaksi validasi berkas. |
| Performance | Latensi kueri agregasi di bawah 100ms dengan indeks primer pada `period_month`. |

---

## Logical Data Model

| Entity / Table | Columns & Constraints | Description |
| --- | --- | --- |
| `c1_macro_metric` | `period_month` (date pk), `revenue` (numeric default 0), `cost` (numeric default 0), `total_outstanding` (numeric default 0), `validation_status` (text default 'validated'), `updated_at` (timestamptz default now()) | Tabel ringkasan bulanan yang menyimpan total penjualan, biaya operasional, dan saldo tagihan belum dibayar. |

### Rumus & Kalkulasi Metrik Finansial
- **Sales Profit**: `revenue - cost`
- **Net Margin Ratio (%)**: `(revenue > 0) ? ((revenue - cost) / revenue) * 100 : 0`
- **Total Outstanding**: Nilai akumulasi tagihan belum lunas dari dokumen Outstanding Report berstatus `validated` pada bulan jatuh tempo terkait.

---

## API Contract: `GET /api/v1/analytics/macro`

- **Query Parameters**:
  - `start_period` (string, format: `YYYY-MM`): Bulan awal rentang filter.
  - `end_period` (string, format: `YYYY-MM`): Bulan akhir rentang filter.
- **Logika Pemrosesan Server-Side**:
  1. Melakukan validasi format tanggal dan memastikan user memiliki hak akses CCR (`canUseCcr`).
  2. Mengkueri baris data dari `c1_macro_metric` di mana `period_month >= start_date` dan `period_month <= end_date` serta `validation_status = 'validated'`.
  3. Membentuk array bulanan lengkap dari `start_period` sampai `end_period`.
  4. Menerapkan mekanisme **Zero-Filling**: Bulan yang tidak memiliki catatan pada tabel basis data otomatis diisi dengan objek data bernilai 0 (`revenue: 0, cost: 0, sales_profit: 0, total_outstanding: 0, net_margin_ratio: 0`).
  5. Mengembalikan header `Cache-Control: no-store, max-age=0` untuk memastikan data selalu segar.
- **Contoh Struktur Respons JSON**:
```json
{
  "metrics": {
    "revenue": 1500000000,
    "cost": 1100000000,
    "salesProfit": 400000000,
    "totalOutstanding": 350000000,
    "netMarginRatio": 26.67
  },
  "series": [
    {
      "period": "2026-05",
      "revenue": 450000000,
      "cost": 330000000,
      "salesProfit": 120000000,
      "totalOutstanding": 100000000,
      "netMarginRatio": 26.67
    },
    {
      "period": "2026-06",
      "revenue": 520000000,
      "cost": 380000000,
      "salesProfit": 140000000,
      "totalOutstanding": 120000000,
      "netMarginRatio": 26.92
    }
  ],
  "startPeriod": "2026-05",
  "endPeriod": "2026-06"
}
```

---

## Testing & Verification

1. **Unit & Database Testing (`tests/api-database.test.mjs`)**:
   - Memverifikasi agregasi pendapatan dan biaya operasional per bulan.
   - Memverifikasi penanganan rentang tanggal multi-bulan dan zero-filling pada bulan kosong.
   - Memverifikasi kalkulasi ulang metrik saat berkas dihapus tanpa meninggalkan data yatim.
2. **Typecheck (`npm run typecheck`)**:
   - Memastikan tipe data antarmuka frontend dan payload backend selaras tanpa galat kompilasi.
