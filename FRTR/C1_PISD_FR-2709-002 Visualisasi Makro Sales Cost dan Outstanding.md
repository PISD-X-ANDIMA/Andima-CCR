# C1_PISD_FR-2709-002: Visualisasi Makro Sales Cost dan Outstanding

| Field | Value |
| --- | --- |
| **Document ID** | FR-2709-002 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [User Story 5: Visualisasi Makro Sales Performance Bulanan](https://docmost.ayutrans.id/s/ccr/p/user-story-5-visualisasi-makro-sales-performance-bulanan-w0zPSOJeyX) [User Story 6: Visualisasi Makro Kebutuhan Cost Bulanan](https://docmost.ayutrans.id/s/ccr/p/user-story-6-visualisasi-makro-kebutuhan-cost-bulanan-7FgsASV5pz) [User Story 7: Visualisasi Makro Total Outstanding Bulan Berjalan](https://docmost.ayutrans.id/s/ccr/p/user-story-7-visualisasi-makro-total-outstanding-bulan-berjalan-SXUHtitHG0) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan kebutuhan fungsional untuk mengolah data unggahan tervalidasi menjadi visualisasi deret waktu bulanan dan kartu metrik makro keuangan perusahaan pada dashboard Sales Overview.

---

## Description

Sistem harus menyajikan ringkasan metrik makro eksekutif dan grafik tren deret waktu multi-bulan yang mencakup Sales Profit, kebutuhan operasional Cost, Total Outstanding, serta Net Margin Ratio. Seluruh data bersumber dari dokumen yang telah lolos validasi kurasi, disajikan dengan penanganan bulan kosong (*zero-filled*), dan otomatis diperbarui saat terjadi perubahan berkas ingestion.

---

## Scope and Users

| Item | Value |
| --- | --- |
| Scope | Kartu ringkasan metrik makro (Revenue, Cost, Sales Profit, Total Outstanding, Net Margin Ratio); visualisasi grafik deret waktu multi-bulan zero-filled; filter rentang rolling dan kustom; reaktivitas data pasca-ingestion. |
| Actor / user role | Finance & Accounting Department; Level Management / Supervisor (`MANAGEMENT`) dan Level Admin / Staff (`STAFF`) dengan hak baca (*read-only visual*). |

---

## Functional Requirements

- **FR-CCR-002-01 Kartu Metrik Makro Eksekutif**  
  Sistem menampilkan lima metrik utama pada dasbor ringkasan:
  1. **Revenue**: Total pendapatan kotor dari Company Sales Report tervalidasi.
  2. **Cost**: Akumulasi biaya operasional (trucking, handling, storage, dll).
  3. **Sales Profit**: Nilai keuntungan operasional bersih (`Revenue - Cost`).
  4. **Total Outstanding**: Nilai piutang tagihan yang belum terbayar dari Outstanding Report tervalidasi.
  5. **Net Margin Ratio**: Rasio margin laba bersih terhadap pendapatan (`(Sales Profit / Revenue) * 100`).
- **FR-CCR-002-02 Grafik Tren Deret Waktu (Time-Series Charts)**  
  Sistem menyajikan grafik tren deret waktu bulanan yang responsif untuk membandingkan pergerakan Revenue, Cost, dan Total Outstanding antarbulan.
- **FR-CCR-002-03 Penanganan Bulan Kosong (Zero-Filled Series)**  
  Bulan dalam rentang periode yang tidak memiliki data transaksi otomatis diisi dengan nilai nol (*zero-filled*), sehingga kontinuitas kurva visual grafik tetap terjaga dan akurat.
- **FR-CCR-002-04 Filter Periode Fleksibel (Rolling & Custom)**  
  Sistem menyediakan kontrol pemilihan periode:
  - Preset rolling: `1 Bulan`, `3 Bulan`, `6 Bulan`, dan `12 Bulan` terakhir.
  - Rentang kustom: Pemilihan bulan mulai (`start_period`) dan bulan akhir (`end_period`) secara bebas.
- **FR-CCR-002-05 Sinkronisasi dan Reaktivitas Data**  
  Dasbor metrik makro otomatis memuat ulang data terbaru tanpa perlu me-reload halaman ketika dokumen sales atau outstanding selesai difinalisasi atau dihapus.

---

## Business Rules

1. Data metrik makro hanya dikalkulasi dari baris staging yang memiliki status dokumen `validated`.
2. Jika tidak ada data tervalidasi pada periode yang dipilih, sistem menampilkan tampilan kosong informatif (*empty state*) tanpa memunculkan galat aplikasi.
3. Seluruh kalkulasi agregasi dan rumus keuangan dijalankan di sisi server (*server-side authoritative*) dan tidak mempercayai komputasi dari sisi browser.

---

## API Endpoint Contract

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/analytics/macro | Mengambil kartu metrik dan data deret waktu bulanan berdasarkan rentang `start_period` dan `end_period`. | Staff & Management |

*Catatan: Endpoint telah diimplementasikan penuh dan mengembalikan payload JSON terpadu yang memuat `metrics` dan `series`.*

---

## Acceptance Criteria

1. Sistem menampilkan kartu metrik Revenue, Cost, Sales Profit, Total Outstanding, dan Net Margin Ratio secara akurat sesuai periode aktif.
2. Grafik tren deret waktu bulanan merender kurva performa keuangan dengan tooltip mata uang dan interaksi visual yang jelas.
3. Kontrol filter periode mendukung rolling 1, 3, 6, 12 bulan dan rentang kustom bulan awal hingga bulan akhir.
4. Bulan dalam rentang yang tidak memiliki data transaksi terisi dengan nilai 0 (*zero-filled*).
5. Dasbor secara reaktif merefresh nilai metrik saat ada proses upload berkas baru tervalidasi atau penghapusan berkas.

---

## Source Traceability

| Source | Requirements Coverage |
| --- | --- |
| [User Story 5: Visualisasi Makro Sales Performance Bulanan](https://docmost.ayutrans.id/s/ccr/p/user-story-5-visualisasi-makro-sales-performance-bulanan-w0zPSOJeyX) | Kartu ringkasan Sales Profit, grafik pendapatan bulanan, dan filter periode multi-bulan. |
| [User Story 6: Visualisasi Makro Kebutuhan Cost Bulanan](https://docmost.ayutrans.id/s/ccr/p/user-story-6-visualisasi-makro-kebutuhan-cost-bulanan-7FgsASV5pz) | Pemisahan komponen biaya operasional dan visualisasi tren pengeluaran. |
| [User Story 7: Visualisasi Makro Total Outstanding Bulan Berjalan](https://docmost.ayutrans.id/s/ccr/p/user-story-7-visualisasi-makro-total-outstanding-bulan-berjalan-SXUHtitHG0) | Akumulasi tagihan piutang belum terbayar dan perbandingan multi-bulan. |
