# C1_PISD_FR-2709-004: Deteksi Dini Overdue Alert dan Assignment

| Field | Value |
| --- | --- |
| **Document ID** | FR-2709-004 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [User Story 4: Deteksi Dini Keterlambatan Pembayaran (Overdue Alert > 1 Bulan)](https://docmost.ayutrans.id/s/ccr/p/user-story-4-deteksi-dini-keterlambatan-pembayaran-overdue-alert-1-UzYqhuoraZ) |
| **Priority** | P0 - Must Have |

Dokumen ini mendefinisikan kebutuhan fungsional untuk mendeteksi piutang tertunggak secara otomatis, mengklasifikasikan tingkat resiko keterlambatan, memfasilitasi penugasan Person in Charge (PIC), serta mengintegrasikan pelunasan tagihan secara otomatis dengan modul Customer Analytics.

---

## Description

Sistem harus secara otomatis mengevaluasi keterlambatan jatuh tempo invoice dari data tagihan outstanding tervalidasi, menetapkan klasifikasi status resiko berbasis rentang hari (*aging buckets*), menyediakan antarmuka penugasan PIC penagihan, serta menyediakan alur pelunasan tagihan (*settlement flow*) di mana invoice yang telah berstatus `COMPLETED` otomatis dikeluarkan dari daftar alert aktif dan tercatat sebagai histori pelunasan pada Customer Analytics.

---

## Scope and Users

| Item | Value |
| --- | --- |
| Scope | Evaluasi keterlambatan otomatis pasca-ingestion dokumen; klasifikasi status resiko Title Case (`Watchlist`, `Medium Risk`, `High Risk`); penugasan PIC; alur pelunasan otomatis; pelestarian riwayat tindak lanjut; penonaktifan tabel feed lawas. |
| Actor / user role | Tim Billing, Accounting Manager, Management / Supervisor (`MANAGEMENT`), dan Staf Penagihan (`STAFF`). |

---

## Functional Requirements

- **FR-CCR-004-01 Evaluasi Tanggal Jatuh Tempo Otomatis**  
  Sistem mengevaluasi selisih tanggal evaluasi/hari berjalan terhadap `due_date` invoice secara otomatis pasca-finalisasi dokumen outstanding melalui fungsi basis data `c1_refresh_overdue_alerts(date)`.
- **FR-CCR-004-02 Klasifikasi Aging Bucket dan Status Resiko Title Case**  
  Sistem mengelompokkan invoice tertunggak ke dalam tiga bucket aging utama dengan label status Title Case baku:
  1. **1 - 30 Days**: Status `Watchlist`.
  2. **31 - 60 Days**: Status `Medium Risk`.
  3. **> 60 Days**: Status `High Risk` (status lawas *"Legal Escalation"* telah dihapus dan dilebur ke dalam High Risk).
- **FR-CCR-004-03 Penanda Visual Semantik dan Filter Cepat**  
  Antarmuka menampilkan badge visual warna semantik pada tabel alert overdue dan menyediakan filter cepat berdasarkan aging bucket, kantor cabang, dan status resiko.
- **FR-CCR-004-04 Penugasan Staf PIC (Assignment)**  
  Pengguna level Management dapat menetapkan personel staf PIC penagihan untuk invoice yang tertunggak melalui modal dialog penugasan. Sistem mencatat penugasi, staf target, waktu penugasan, dan catatan awal.
- **FR-CCR-004-05 Alur Pelunasan Tagihan Otomatis (Settlement Flow)**  
  Ketika invoice diselesaikan dan diberi status `COMPLETED`:
  - Invoice secara instan dikeluarkan (*dihapus*) dari daftar pantauan aktif `c1_overdue_alert`.
  - Sistem secara otomatis membuat rekaman transaksi pembayaran pada `c1_payment_transactions` dengan referensi `SETTLE-{assignmentId}`.
  - Pembayaran tersebut langsung mengalir dan tercermin pada grafik Tren Pembayaran Customer Analytics bulan berjalan.
- **FR-CCR-004-06 Pelestarian Riwayat Penugasan (FK Decoupling)**  
  Riwayat log penugasan pada `c1_assignment` tetap tersimpan secara permanen untuk kebutuhan audit dan peninjauan historis, meskipun invoice telah lunas dan dikeluarkan dari tabel alert aktif.
- **FR-CCR-004-07 Deprekasi Integrasi Feed Eksternal**  
  Tabel perantara `c1_mid_feed` telah dihapus (*dead table cleanup*). Seluruh proses monitoring, eskalasi, dan tindak lanjut piutang tertunggak dijalankan secara terpusat di dalam modul CCR.

---

## Business Rules

1. Invoice yang belum melewati tanggal jatuh tempo (`days_overdue <= 0`) tidak dimasukkan ke dalam daftar alert overdue.
2. Invoice yang sudah memiliki status tindak lanjut `COMPLETED` atau pembayaran penuh otomatis dikecualikan dari proyeksi alert overdue.
3. Hak penetapan PIC penagihan hanya dimiliki oleh pengguna dengan hak kelola (`MANAGEMENT`).

---

## API Endpoint Contract

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/overdue-alerts | Mengambil daftar invoice overdue aktif, KPI summary, dan filter operasional. | Staff & Management |
| POST | /api/v1/overdue-alerts | Mengeksekusi aksi manajemen overdue (`EVALUATE` untuk memicu evaluasi ulang, atau `ASSIGN_PIC` untuk menetapkan staf PIC). | Management (`MANAGEMENT`) |

---

## Acceptance Criteria

1. Sistem mendeteksi seluruh invoice outstanding yang menunggak dan menetapkan status resiko Title Case (`Watchlist`, `Medium Risk`, `High Risk`) secara konsisten.
2. Pengguna `MANAGEMENT` dapat menetapkan PIC penagihan untuk invoice tertunggak.
3. Memberi status `COMPLETED` pada invoice seketika menghapus invoice dari daftar alert overdue dan mencatat pembayaran di `c1_payment_transactions`.
4. Transaksi pelunasan langsung tampil pada grafik Tren Pembayaran Customer Analytics untuk customer terkait.
5. Riwayat penugasan tetap dapat dilihat pada riwayat historis meskipun invoice sudah lunas.

---

## Source Traceability

| Source | Requirements Coverage |
| --- | --- |
| [User Story 4: Deteksi Dini Keterlambatan Pembayaran](https://docmost.ayutrans.id/s/ccr/p/user-story-4-deteksi-dini-keterlambatan-pembayaran-overdue-alert-1-UzYqhuoraZ) | Evaluasi due date, aging bucket, visual badge, penugasan PIC, dan alur tindak lanjut. |
| [Problem Statement](https://docmost.ayutrans.id/s/ccr/p/problem-statement-NrsepJHfgy) | Ketiadaan deteksi dini piutang macet dan pelacakan penagihan penanggung jawab. |
