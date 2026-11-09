# C1_PISD_FR-2709-005: Ekspor Ringkasan Analitik

| Field | Value |
| --- | --- |
| **Document ID** | FR-2709-005 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [User Story 4: Deteksi Dini Keterlambatan Pembayaran (Overdue Alert > 1 Bulan)](https://docmost.ayutrans.id/s/ccr/p/user-story-4-deteksi-dini-keterlambatan-pembayaran-overdue-alert-1-UzYqhuoraZ) |
| **Priority** | P1 - Operational Feature |

Dokumen ini mendefinisikan kebutuhan fungsional untuk mengekspor data ringkasan analitik, metrik keuangan, serta daftar piutang ke dalam berbagai format dokumen standar (Excel, PDF, CSV) langsung dari antarmuka peramban (*client-side direct generation*).

---

## Description

Sistem harus menyediakan kemampuan ekspor instan multi-format yang memungkinkan pengguna mengunduh laporan ringkasan makro penjualan, performa analitik customer, maupun data overdue dalam format Excel (`.xlsx`), PDF (`.pdf`), dan CSV (`.csv`) sesuai dengan filter periode atau parameter pencarian yang sedang aktif. Proses pembuatan dokumen dijalankan secara efisien di sisi klien tanpa membebani antrean server (*serverless streaming export*).

---

## Scope and Users

| Item | Value |
| --- | --- |
| Scope | Generator dokumen multi-format (Excel berformat rapi, PDF landscape berstandar laporan eksekutif, dan CSV flat UTF-8); modal pemilihan format; filter periode dan scope ekspor; ketersediaan pada modul Sales Overview dan Customer Analytics. |
| Actor / user role | Level Management / Supervisor (`MANAGEMENT`) dan Level Admin / Staff (`STAFF`). |

---

## Functional Requirements

- **FR-CCR-005-01 Ekspor Ringkasan Multi-Format**  
  Sistem menyediakan tombol aksi ekspor pada dasbor Sales Overview dan Customer Analytics yang membuka modal opsi format:
  1. **Excel (.xlsx)**: Dihasilkan via library ExcelJS dengan styling korporat rapi, garis batas tabel (*borders*), format mata uang Rupiah (`Rp #,##0`), dan judul metadata periode.
  2. **PDF (.pdf)**: Dihasilkan via library jsPDF dan jspdf-autotable dengan orientasi mendatar (*landscape*), kartu ringkasan KPI, tabel data tabular, dan footer penanda waktu cetak (*timestamp*).
  3. **CSV (.csv)**: Dihasilkan sebagai string teks berstandar RFC 4180 dengan encoding UTF-8 untuk kebutuhan integrasi data spreadsheet mentah.
- **FR-CCR-005-02 Preservasi Filter Aktif**  
  Isi berkas ekspor secara konsisten mencerminkan filter rentang periode, cabang, atau kata kunci pencarian yang sedang aktif dipilih oleh pengguna.
- **FR-CCR-005-03 Arsitektur Ekspor Client-Side Tanpa Antrean Server**  
  Ekspor berkas diproses secara langsung pada peramban web (*client-side buffer to Blob*) sehingga tidak memerlukan penyimpanan file fisik di server maupun antrean tabel basis data lawas (`c1_export_request` dan `c1_export_file` telah dibersihkan dari basis data).
- **FR-CCR-005-04 Penamaan Berkas Otomatis & Terstandar**  
  Nama berkas unduhan disusun secara otomatis memuat nama modul, filter periode, dan cap waktu, misalnya `Sales_Overview_Report_2026-07.xlsx` atau `Customer_Analytics_Report_2026-11-09.pdf`.

---

## Business Rules

1. Seluruh pengguna terautentikasi dengan akses ke modul terkait berhak melakukan ekspor data yang tampil pada layar kerjanya.
2. Jika filter aktif tidak menghasilkan baris data, sistem memberikan peringatan informatif dan mencegah pembuatan berkas kosong.

---

## Acceptance Criteria

1. Pengguna dapat memilih format ekspor Excel (.xlsx), PDF (.pdf), atau CSV (.csv) melalui dialog modal ekspor.
2. Berkas Excel yang diunduh memiliki pemformatan sel, warna header, dan format nominal mata uang yang terstruktur rapi.
3. Berkas PDF yang diunduh berformat landscape, memiliki header metadata laporan, dan rapi dalam batas halaman.
4. Data yang diekspor presisi sesuai dengan data tabel dan filter periode yang sedang aktif.
5. Proses pengunduhan berjalan instan di peramban tanpa menimbulkan beban storage pada server.

---

## Source Traceability

| Source | Requirements Coverage |
| --- | --- |
| [C1_PISD_FR-2709-002: Visualisasi Makro Sales Cost dan Outstanding](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-002-visualisasi-makro-sales-cost-dan-outstanding-o8Rd0V0QWp) | Sumber data ringkasan makro penjualan untuk ekspor laporan eksekutif. |
| [Problem Statement](https://docmost.ayutrans.id/s/ccr/p/problem-statement-NrsepJHfgy) | Kebutuhan pelaporan offline bagi pemangku kepentingan manajemen. |
