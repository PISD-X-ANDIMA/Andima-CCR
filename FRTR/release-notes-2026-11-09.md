# Release Notes C1 - 9 November 2026

## Informasi Release

- **Branch:** `feat/C1-bugfix`
- **Tanggal:** 9 November 2026
- **Area:** Database Cleanup, Overdue Alert Settlement & History Preservation, Follow-up Log Editing & Deletion with Reversal, Customer Analytics Dynamic Trends & Deduplication, Client-Side Multi-Format Export, System-Wide English Localization.
- **Status:** Production-Ready & Fully Verified (58 Automated Tests Passing, 0 Typecheck Errors).

---

## Ringkasan Eksekutif

Rilis ini menyelesaikan pembersihan besar pada skema basis data C1 (*Dead Tables Cleanup*), mengintegrasikan alur pelunasan tagihan tertunggak secara otomatis dengan grafik tren pembayaran Customer Analytics, menyediakan fitur penyuntingan dan penghapusan riwayat penagihan dengan pembalikan transaksi otomatis (*automatic payment reversal*), melepaskan batasan cascade foreign key untuk menjamin keabadian riwayat audit penugasan, menyempurnakan deduplikasi nama perusahaan dan nomor MAWB, serta menerapkan lokalisasi Bahasa Inggris baku di seluruh antarmuka sistem.

---

## Rincian Fitur Utama & Pembaruan

### 1. Pembersihan Basis Data C1 (Dead Tables Cleanup & Decoupling)
- **Eliminasi 5 Tabel Mati**: Menghapus secara permanen 5 tabel usang yang tidak lagi digunakan dengan perintah `DROP TABLE IF EXISTS ... CASCADE`:
  1. `c1_mid_feed` (Feeder eskalasi MID lawas)
  2. `c1_customer_monthly_metrics` (Tabel pra-agregasi usang)
  3. `c1_invoice_detail` (Tabel tracking invoice lawas)
  4. `c1_export_file` (Antrean ekspor server lawas)
  5. `c1_export_request` (Antrean request ekspor lawas)
- **Preservasi 10 Tabel Aktif**: Memastikan 10 tabel operasional aktif (`c1_document_uploads`, `c1_company_sales_staging_rows`, `c1_outstanding_staging_rows`, `c1_customer`, `c1_document_validation_errors`, `c1_document_deletion_audit`, `c1_macro_metric`, `c1_overdue_alert`, `c1_assignment`, `c1_payment_transactions`) tetap utuh tanpa menyentuh tabel non-`c1_`.
- **Dekopling Prosedur Basis Data**: Memperbarui fungsi `reset_c1_sales_overview_data()`, `c1_cleanup_unreferenced_upload_customers()`, dan `c1_delete_uploaded_document()` agar terbebas dari dependensi terhadap tabel mati.
- **Dekopling Backend API**: Memperbarui fungsi `triggerBatchMidFeedEscalationInSupabase` dan `requestExportFileInSupabase` pada `lib/supabaseOverdueApi.ts` sehingga tidak lagi melakukan kueri ke tabel yang telah dihapus.

### 2. Alur Pelunasan Tagihan Overdue & Sinkronisasi Tren Pembayaran (Settlement Flow)
- **Pencatatan Otomatis ke Customer Analytics**: Ketika status follow-up invoice diset menjadi `COMPLETED`:
  - Sistem secara otomatis mencatat transaksi pembayaran ke tabel `c1_payment_transactions` dengan referensi unik `SETTLE-{assignmentId}`.
  - Nilai pembayaran langsung mengalir ke RPC `c1_get_customer_analytics` dan seketika memperbarui grafik **Customer Payment Trend** untuk customer terkait pada bulan berjalan.
  - Pada halaman detail customer (`/customers/[id]`), invoice terkait otomatis berganti status menjadi `PAID` dengan sisa saldo Rp 0.
- **Pengeluaran Otomatis dari Daftar Overdue**:
  - Invoice yang telah berstatus `COMPLETED` otomatis dihapus dari tabel pantauan `c1_overdue_alert`.
  - Fungsi authoritative basis data `c1_refresh_overdue_alerts(date)` diperbarui untuk mengecualikan invoice yang telah diselesaikan.
  - Pengguna diarahkan kembali ke halaman Overdue Alert dengan notifikasi toast sukses.

### 3. Fitur Penyuntingan & Penghapusan Riwayat Follow-Up (Edit & Delete Log)
- **Tombol Aksi pada Timeline Riwayat**: Menambahkan tombol "Edit Log" (ikon pensil biru) dan tombol "Delete Log" (ikon tempat sampah merah) pada setiap kartu riwayat di halaman Edit Overdue (`/overdue-alert/edit/[id]`).
- **Modal Konfirmasi Penghapusan Aman**: Mengklik "Delete Log" memunculkan dialog modal berlatar belakang blur (*backdrop blur*) yang merinci informasi tanggal penugasan, status, dan peringatan dampak penghapusan.
- **Pembalikan Pelunasan Otomatis (Payment Reversal)**:
  - Disediakan endpoint `DELETE /api/v1/overdue/[invoiceId]/progress`.
  - Jika entri follow-up yang dihapus atau diedit sebelumnya berstatus `COMPLETED`, sistem secara otomatis membatalkan/menghapus rekaman pembayaran terkait dari `c1_payment_transactions`.
  - Sistem mengevaluasi ulang status keterlambatan sehingga invoice secara aman kembali aktif pada daftar alert overdue jika tagihan belum lunas.

### 4. Pelestarian Riwayat Audit Penugasan (Foreign Key Decoupling)
- **Pelepasan Batasan Cascade FK**: Migrasi `20261109140000_preserve_assignment_history_on_settlement.sql` secara resmi melepaskan batasan foreign key `c1_assignment_invoice_id_fkey` yang sebelumnya memiliki aturan `ON DELETE CASCADE` ke `c1_overdue_alert(invoice_id)`.
- **Dampak Positif**: Riwayat penugasan, janji bayar, dan audit staf di tabel `c1_assignment` tetap tersimpan permanen dan tidak terhapus ketika tagihan dinyatakan lunas dan dieliminasi dari `c1_overdue_alert`.

### 5. Jendela Tren Pembayaran Dinamis & Deduplikasi Identitas Customer
- **Jendela Waktu Pembayaran Dinamis**: Migrasi `20261109130000_update_customer_analytics_payment_periods.sql` memperbarui perhitungan seri waktu `payment_periods` pada `c1_get_customer_analytics` agar menggunakan `greatest(max(sales), max(payments))` dan `least(min(sales), min(payments))`. Transaksi pembayaran yang tercatat pada bulan berjalan (misalnya November 2026) kini tampil presisi pada grafik tren multi-bulan.
- **Normalisasi Nomor MAWB**: Migrasi `20261105000000_deduplicate_company_mawb_names.sql` secara cerdas membersihkan penomoran airway bill yang tertempel pada nama perusahaan, menggabungkan entitas alias ke profil kanonikal.

### 6. Lokalisasi Bahasa Inggris Menyeluruh (System-Wide English)
- **Standardisasi Tampilan Antarmuka**: Seluruh teks antarmuka, judul kartu metrik, header tabel, tombol aksi, filter dropdown, dan modal dialog diseragamkan ke dalam Bahasa Inggris baku.
- **Label Status Resiko Title Case**: Status resiko diselaraskan menjadi Title Case (`High Risk`, `Medium Risk`, `Watchlist`, `Negotiation`) dan status lawas "Legal Escalation" dieliminasi.
- **Preservasi Catatan Pengguna**: Inputan teks bebas dari pengguna (seperti catatan tindak lanjut penagihan/notes) tetap dipertahankan dalam bahasa asli yang dimasukkan oleh staf tanpa alterasi.

### 7. Ekspor Streaming Multi-Format & Generator Surat Peringatan
- **Client-Side Direct Streaming Generator**: Menyediakan ekspor instan berformat Excel (`.xlsx` via ExcelJS), PDF (`.pdf` via jsPDF), dan CSV (`.csv`) pada modul Sales Overview dan Customer Analytics tanpa ketergantungan antrean server.
- **Generator Surat Peringatan (Warning Letter)**: Dialog modal interaktif berjenjang (`SP-1`, `SP-2`, `SP-3`) dengan pratinjau PDF multi-halaman, nomor rekening resmi Bank Mandiri `1234-5678-9012` a.n. `PT Andima Transportindo`, penanggalan kalender dinamis, dan penandatangan Credit Controller.

---

## Verifikasi Kualitas & Hasil Pengujian

- **Automated Test Suite**:
  - Perintah: `npm test`
  - Hasil: **58 lulus, 0 gagal (100% green)**
  - Pengujian mencakup:
    - `tests/c1-tables-cleanup.test.mjs`: Verifikasi migrasi pembersihan 5 dead tables dan dekopling backend.
    - `tests/analytics-rpc.test.mjs`: Verifikasi agregasi analitik C1, deduplikasi nama perusahaan, dan tren pembayaran dinamis.
    - `tests/api-database.test.mjs`: Verifikasi ingestion dokumen, validasi preflight, rollback metrik makro, dan penolakan CSV.
    - `tests/overdue-polish.test.mjs`: Verifikasi pelunasan overdue, reversal pembayaran otomatis, status Title Case, dan generator SP.
- **Pengecekan Kompilasi TypeScript**:
  - Perintah: `npm run typecheck`
  - Hasil: **0 galat kompilasi (clean build)**.
- **Verifikasi Basis Data Remote**:
  - Terverifikasi langsung pada proyek Supabase produksi (`ufjbbwqaztgkqmpdmcyv`) bahwa tepat 10 tabel aktif `c1_` beroperasi normal dan seluruh tabel non-`c1_` tidak terganggu.

