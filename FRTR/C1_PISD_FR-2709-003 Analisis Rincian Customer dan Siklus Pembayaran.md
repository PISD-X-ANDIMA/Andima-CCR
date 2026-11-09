# C1_PISD_FR-2709-003: Analisis Rincian Customer dan Siklus Pembayaran

| Field | Value |
| --- | --- |
| **Document ID** | FR-2709-003 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [User Story 8: Analisis Rincian Pelanggan (Customer Breakdown)](https://docmost.ayutrans.id/s/ccr/p/user-story-8-analisis-rincian-pelanggan-customer-breakdown-9NNSnGzP5m) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan kebutuhan fungsional untuk menganalisis performa finansial dan riwayat siklus pembayaran per entitas customer secara mendalam pada modul Customer Analytics.

---

## Description

Sistem harus menyajikan tabel rincian performa keuangan per entitas customer yang dinamis dan terintegrasi, mencakup Sales Profit, Total Cost, Total Outstanding, Days Sales Outstanding (DSO), serta analisis arah tren pembayaran multi-bulan. Sistem mengelompokkan identitas customer secara cerdas (deduplikasi alias dan pembersihan nomor MAWB), menyediakan filter operasional cepat, serta menyediakan halaman detail customer penuh (`/customers/[id]`) untuk penelusuran riwayat invoice dan transaksi pembayaran.

---

## Scope and Users

| Item | Value |
| --- | --- |
| Scope | Tabel agregasi performa seluruh customer aktif (917+ entitas); deduplikasi alias dan nomor MAWB; metrik profit, cost, outstanding, DSO, dan tren pembayaran; halaman detail customer penuh dengan riwayat transaksi pembayaran dan status pelunasan invoice. |
| Actor / user role | Level Management / Supervisor (`MANAGEMENT`) dan Level Admin / Staff (`STAFF`), Sales Executives, Customer Success. |

---

## Functional Requirements

- **FR-CCR-003-01 Breakdown Customer Dinamis & Skalabel**  
  Sistem mengelompokkan data dari Company Sales Report dan Data Outstanding tervalidasi ke dalam entitas customer kanonikal. Sistem tidak membatasi kuota 51 customer, melainkan secara dinamis mendukung seluruh customer aktif dari master maupun hasil ingestion berkas (917+ customer).
- **FR-CCR-003-02 Deduplikasi Identitas dan Normalisasi MAWB**  
  Sistem secara otomatis mendeteksi dan menggabungkan variasi penulisan entitas customer yang sama (seperti penulisan cabang berbeda atau nomor MAWB/airway bill yang tertempel pada nama perusahaan, misalnya `"Perusahaan A 17278941"` dipetakan ke `"Perusahaan A"`).
- **FR-CCR-003-03 Metrik Granular per Customer**  
  Tabel analitik menyajikan metrik komprehensif untuk setiap customer:
  - **Revenue & Operational Cost**: Total omset penjualan dan biaya operasional.
  - **Sales Profit & Margin %**: Keuntungan kotor dan persentase rasio margin laba.
  - **Total Outstanding**: Total saldo tagihan yang masih menunggak.
  - **Days Sales Outstanding (DSO)**: Rata-rata estimasi hari penagihan piutang.
  - **Payment Trend**: Arah siklus pembayaran multi-bulan (`Up`, `Down`, `Stable`, `Inactive`).
- **FR-CCR-003-04 Rentang Waktu Tren Pembayaran Dinamis**  
  Grafik tren pembayaran customer mengadopsi rentang waktu dinamis yang membentang dari periode pembayaran/penjualan paling awal hingga bulan pembayaran terbaru (termasuk pembayaran pelunasan bulan berjalan seperti November 2026), tanpa terkunci statis pada bulan sales terakhir.
- **FR-CCR-003-05 Pencarian, Filter Cabang, dan Sorting**  
  Tabel mendukung pencarian instan nama atau kode customer, pemfilteran berdasarkan kantor cabang (Jakarta, Semarang, Surabaya, Balikpapan, atau Semua Cabang), serta pengurutan (*sorting*) berdasarkan kolom profit, nominal outstanding, maupun DSO.
- **FR-CCR-003-06 Halaman Detail Customer Penuh (`/customers/[id]`)**  
  Setiap baris customer dapat diklik untuk membuka halaman rincian penuh yang memuat:
  - Rangkuman profil dan kartu KPI customer.
  - Modal pratinjau detail kode customer yang aksesibel.
  - Tabel rincian invoice beserta status pelunasan (Paid / Unpaid / Pending). Invoice yang telah lunas menampilkan sisa tagihan Rp 0 dan badge hijau `PAID`.
  - Riwayat transaksi pembayaran terperinci yang mencatat nominal, tanggal pembayaran, referensi transaksi, dan petugas pencatat.

---

## Business Rules

1. Customer analytics dihitung langsung secara dinamis melalui RPC PostgreSQL teroptimasi (`c1_get_customer_analytics`), tanpa bergantung pada tabel pra-agregasi usang.
2. Ketika invoice dilunasi melalui modul Overdue Alert, pelunasan tersebut langsung tercatat di `c1_payment_transactions` dan seketika memperbarui grafik Tren Pembayaran customer terkait.
3. Filter pencarian dan sorting bekerja secara server-side untuk memastikan performa tinggi pada volume ribuan transaksi.

---

## API Endpoint Contract

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/analytics/customers | Mengambil daftar rincian analitik customer dengan filter cabang, pencarian, sorting, dan pagination. | Staff & Management |
| GET | /api/v1/customers/{customerId}/invoices | Mengambil daftar rincian invoice dan status pelunasan untuk customer tertentu. | Staff & Management |

---

## Acceptance Criteria

1. Tabel analitik menampilkan seluruh customer aktif secara dinamis dengan metrik Sales Profit, Cost, Outstanding, DSO, dan Payment Trend.
2. Nama perusahaan dengan variasi nomor MAWB berhasil digabungkan ke dalam satu entitas kanonikal.
3. Grafik tren pembayaran menampilkan histori pembayaran multi-bulan secara dinamis hingga bulan pembayaran transaksi terbaru.
4. Filter pencarian, filter kantor cabang, dan pengurutan kolom berfungsi responsif.
5. Mengklik customer membuka halaman detail penuh `/customers/[id]` yang menyajikan daftar invoice dan histori pembayaran transaksi secara akurat.

---

## Source Traceability

| Source | Requirements Coverage |
| --- | --- |
| [User Story 8: Analisis Rincian Pelanggan (Customer Breakdown)](https://docmost.ayutrans.id/s/ccr/p/user-story-8-analisis-rincian-pelanggan-customer-breakdown-9NNSnGzP5m) | Customer breakdown, metrik keuangan per klien, filter cabang, dan detail invoice. |
| [Problem Statement](https://docmost.ayutrans.id/s/ccr/p/problem-statement-NrsepJHfgy) | Ketiadaan visibilitas performa per klien, DSO, dan analisis tren siklus pembayaran. |
