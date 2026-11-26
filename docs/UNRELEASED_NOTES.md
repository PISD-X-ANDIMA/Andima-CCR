# Catatan Internal & Unreleased (Unreleased Notes)
## Modul C1: Credit Control & Recovery (CCR) - PT Andima Transportindo

> **Status Dokumen**: *Internal Engineering & Architectural Reference*  
> **Klasifikasi**: *Confidential - Restricted to Engineering & System Architecture Teams*  
> **Tanggal Pembaruan**: 26 November 2026  
> **Tujuan Dokumen**: Mencatat perubahan arsitektur data internal, migrasi skema tabel, integrasi data lintas modul (MID), dan decoupling struktural yang sengaja tidak dicantumkan pada Catatan Rilis publik (Release Notes v1.1.0).

---

## 1. Latar Belakang & Alasan Pemisahan Catatan

Beberapa pembaruan teknis pada siklus pengembangan ini melibatkan perubahan skema basis data inti, standardisasi entitas master, serta penyiapan tabel staging untuk konsumsi modul pihak ketiga (Management Information Dashboard / MID).

Perubahan-perubahan ini tidak dicantumkan pada Release Notes publik karena:
1. Bersifat transparan bagi pengguna akhir (end-user) dan tidak mengubah alur operasional di tingkat antarmuka publik.
2. Melibatkan migrasi skema internal antar modul yang dikelola secara terpusat oleh tim rekayasa data.
3. Fitur konsumen data (seperti dashboard MID) masih berada pada tahap integrasi backend dan belum dirilis untuk penggunaan operasional terbuka.

---

## 2. Rincian Pembaruan Internal & Arsitektur

### 2.1 Migrasi Master Pelanggan C1 ke Tabel Terpusat (`public.c1_customer` ke `public.a1_customers`)

- **Konteks Masalah**:
  - Sebelumnya, modul C1 mengelola tabel pelanggan lokal sendiri (`public.c1_customer`), yang menyebabkan duplikasi data dengan tabel master pelanggan terpusat perusahaan (`public.a1_customers`).
  - Duplikasi ini berpotensi memicu ketidaksinkronan kode pelanggan, inkonsistensi nama perusahaan, dan penanganan relasi bertingkat yang tidak efisien.

- **Implementasi Migrasi (File: `20261126190000_migrate_c1_customer_to_a1_customers.sql`)**:
  - **Pelepasan Foreign Key Lama**: Melepas batasan foreign key yang mengarah ke `c1_customer` pada tabel `c1_company_sales_staging_rows`, `c1_outstanding_staging_rows`, `c1_overdue_alert`, dan `c1_payment_transactions`.
  - **Remapping Data Eksisting**: Menyelaraskan seluruh ID pelanggan pada tabel staging dan alert ke ID yang sesuai di `public.a1_customers` berbasis pencocokan nama ternormalisasi (`c1_normalize_company_name`) dan kode perusahaan.
  - **Pembersihan Tabel Lokal**: Menghapus tabel lokal `public.c1_customer` dan `public.c1_customers` (`DROP TABLE ... CASCADE`) secara aman.
  - **Penyambungan Foreign Key Baru**: Mengarahkan kembali foreign key `c1_customer_id` pada seluruh tabel staging dan alert ke `public.a1_customers(id)` dengan aturan `ON DELETE SET NULL`.
  - **Pembaruan Fungsi Resolusi Unggah**:
    - Fungsi `c1_resolve_uploaded_customers(uuid, jsonb)` diperbarui untuk mencocokkan pelanggan yang diunggah langsung ke `public.a1_customers` melalui pencocokan kode perusahaan dan nama kanonikal.
    - Jika pelanggan baru terdeteksi, data otomatis didaftarkan ke `public.a1_customers` dengan kode awalan `UPLOAD-`.
  - **Pembaruan Fungsi Cascade Delete**:
    - Fungsi `c1_delete_uploaded_document` diperbarui agar cascade delete membersihkan staging dan audit tanpa ketergantungan pada `c1_customer`.

---

### 2.2 Penyiapan Tabel & Otomasi Eskalasi Overdue ke MID (`public.c1_mid_escalations`)

- **Konteks Kebutuhan**:
  - Modul Management Information Dashboard (MID) memerlukan data rekapitulasi isu penagihan dari CCR untuk memantau invoice yang tertunda beserta perkembangan tindak lanjut staf secara langsung.
  - Kebutuhan ini diwujudkan dalam bentuk tabel penampung khusus di skema publik tanpa mengubah atau mengganggu struktur tabel-tabel operasional C1 yang sudah berjalan.

- **Struktur Tabel Eskalasi MID (`public.c1_mid_escalations`)**:
  - Tabel dibuat melalui migrasi `20261126210000_create_c1_mid_escalations.sql` dengan 7 atribut utama yang dibutuhkan tim MID:
    1. `pic` (`text`): Nama staf penyusun log penagihan.
    2. `judul_issue` (`text`): Format terstruktur `Follow-Up: Overdue Invoice <invoice_id> - <customer_name>`.
    3. `deskripsi_issue` (`text`): Catatan detail penagihan (contoh: ringkasan percakapan telepon, status janji bayar, komitmen pelanggan).
    4. `date` (`timestamptz`): Waktu pencatatan atau pembaruan log terakhir.
    5. `priority` (`text`): Urgensi isu (`High`, `Medium`, `Low`) yang dihitung otomatis berdasarkan hari keterlambatan (`days_overdue`).
    6. `status` (`text`): Status penanganan dengan nilai minimal `pending`, `in_progress`, `in_review`, dan `done`.
    7. `due_date` (`date`): Batas tanggal penyelesaian isu (menggunakan `promise_date` jika tersedia, atau tanggal jatuh tempo invoice).
  - Dilengkapi kolom relasi dan audit: `id`, `invoice_id`, `customer_name`, `c1_customer_id`, `outstanding_amount`, `days_overdue`, `assignment_id`, `created_at`, dan `updated_at`.

- **Mekanisme Sinkronisasi Otomatis**:
  - **Sinkronisasi Log Staf**: Trigger `trg_c1_assignment_sync_mid_escalation` terpasang pada tabel `c1_assignment`. Setiap penambahan (`INSERT`), pembaruan (`UPDATE`), atau penghapusan log oleh staf langsung disinkronkan ke `c1_mid_escalations`.
  - **Sinkronisasi Dokumen Baru**: Fungsi `c1_sync_overdue_to_mid_escalations()` siap menyaring invoice overdue dari laporan outstanding yang baru divalidasi dan memasukkannya ke tabel eskalasi dengan status awal `pending`.
  - **Penyelesaian Otomatis**: Ketika piutang suatu invoice lunas atau status alert berubah, status eskalasi pada `c1_mid_escalations` otomatis dialihkan ke `done`.

---

### 2.3 Penghapusan & Decoupling Entitas Kantor Cabang (Branch Decoupling)

- **Konteks & Rasional**:
  - Sebelumnya, model analitik dan fungsi basis data C1 menyertakan parameter penyaringan kantor cabang (`branch` / `p_branch`).
  - Berdasarkan kebijakan operasional terpusat PT Andima Transportindo, seluruh penagihan invoice, pengelolaan piutang, dan pencatatan kas dikonsolidasikan di bawah kantor pusat (*Head Office*).
  - Keberadaan filter cabang menimbulkan kompleksitas yang tidak diperlukan dan risiko penyaringan data yang terbelah.

- **Pembaruan yang Diterapkan**:
  - Menghapus parameter dan klausa filter `branch` dari fungsi basis data `c1_get_customer_analytics` dan `c1_get_sales_overview_analytics`.
  - Menstandarisasi nilai lokasi dan cabang pada hasil analitik menjadi nilai tunggal yang seragam (*Head Office*).
  - Menghapus komponen selektor filter cabang dari antarmuka pengguna Customer Analytics, sehingga data yang disajikan secara konsisten mencerminkan total portofolio perusahaan.

---

## 3. Rencana Lanjutan & Status Integrasi (Pending Roadmap)

1. **Konsumsi Frontend oleh Tim MID**:
   - Tim MID akan menghubungkan papan antarmuka mereka ke tabel `public.c1_mid_escalations` atau endpoint API `/api/v1/mid/escalations`.
   - Modul C1 telah selesai menyediakan data secara realtime dan terisolasi.

2. **Verifikasi Sinkronisasi Berkelanjutan**:
   - Seluruh trigger dan fungsi sinkronisasi telah diuji menggunakan simulasi transaksi lokal (PGlite) dan diverifikasi pada basis data remote Supabase.
   - Pemantauan berkala akan dilakukan saat berkas laporan outstanding periode berikutnya diunggah oleh staf operasional.
