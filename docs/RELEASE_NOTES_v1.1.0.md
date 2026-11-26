# Catatan Rilis Resmi (Release Notes) - Staging v1.1.0
## Modul C1: Credit Control & Recovery (CCR) - PT Andima Transportindo

> **Versi**: `v1.1.0-staging`  
> **Tanggal Rilis**: 26 November 2026  
> **Status Stabilitas**: *Feature Complete - Stable & Verified*  
> **Target Cabang (Branch)**: `feat/C1-Rev-26Nov` / `development`  
> **Target Audiens**: Dewan Direksi, Tim Manajemen Keuangan, Tim Akuntansi & Billing, Staf Credit Control, Pengembang Teknis & Tim QA.

---

## 1. Ringkasan Eksekutif (Executive Summary)

Rilis **Staging v1.1.0** membawa pembaruan menyeluruh pada modul Credit Control & Recovery (CCR) yang berfokus pada:
- **Transparansi Portofolio Pelanggan**: Mengubah penyajian data dari yang sebelumnya berbasis customer code fiktif menjadi representasi faktur riil (Customer Invoices) dan transaksi aktual dari laporan operasional.
- **Kemudahan Analisis Keuangan**: Penambahan filter pengurutan baru berdasarkan Biaya Operasional (Cost) dan informasi jumlah invoice aktif per pelanggan secara langsung pada tampilan utama Customer Analytics.
- **Keamanan & Akuntabilitas Log Penagihan**: Penerapan proteksi kepemilikan log tindak lanjut (Author-Only Protection) di mana setiap staf hanya berhak mengedit atau menghapus log follow-up yang mereka buat sendiri.
- **Modernisasi Komponen Antarmuka & Aksesibilitas**: Penyempurnaan sistem desain mencakup selektor batas halaman dengan posisi dropup dinamis, kalender pemilih tanggal Sales Overview berstandar Figma, skeleton loading anti-pergeseran tata letak, navigasi responsif dengan menu hamburger, serta modal konfirmasi keluar (signout) yang terintegrasi secara semantik.

Seluruh fitur telah melalui verifikasi menyeluruh dengan 100% tingkat kelulusan unit dan integrasi test, serta kompatibilitas penuh pada kompilasi Next.js Turbopack.

---

## 2. Rincian Pembaruan Fitur (Feature Updates & Changelog)

### 2.1 Modul Portofolio Customer Analytics (`/customer-analytics`)

- **Rebranding Seksi "Customer Codes" Menjadi "Customer Invoices"**:
  - Judul seksi dan tabel pada halaman rincian analitik pelanggan resmi dialihkan menjadi "Customer Invoices" (Faktur Pelanggan).
  - Kolom pertama kini menampilkan nomor faktur riil (`Invoice Number`) yang bersumber dari Sales Report tervalidasi dan Outstanding Report, menggantikan kode dummy atau kode fallback fiktif.
  - Baris transaksi menampilkan nilai nominal (`Amount`), periode transaksi, status pembayaran (`PAID`, `OUTSTANDING`, dsb.), serta tautan identitas pelanggan.
  - Teks navigasi dan ringkasan footer diperbarui menjadi representasi jumlah invoice (contoh: "Showing 1-10 of 24 invoices").

- **Subtitle Jumlah Invoice Dinamis pada Kartu Pelanggan**:
  - Keterangan di bawah nama perusahaan pada daftar analitik pelanggan tidak lagi menampilkan format "X customer codes".
  - Digantikan dengan kalkulasi jumlah faktur aktif secara presisi (`active_invoices_count`), dengan format multibahasa yang rapi:
    - 1 invoice: `1 invoice` (EN) / `1 faktur` (ID).
    - Jamak (> 1 invoice): `{count} invoices` (EN) / `{count} faktur` (ID).
    - 0 invoice: `No invoices` (EN) / `Tidak ada invoice` (ID).

- **Opsi Filter Pengurutan Baru Berdasarkan Cost (Biaya Operasional)**:
  - Menu dropdown *Sort By* pada Customer Analytics kini dilengkapi opsi baru **Cost** (*Biaya Operasional*).
  - Didukung penuh oleh query backend SQL yang mengagregasikan total biaya operasional (`total_cost`) dari baris penjualan tervalidasi.
  - Mendukung pengurutan secara menaik (*ascending*) maupun menurun (*descending*) secara konsisten dengan metrik laba (*sales profit*), piutang (*total outstanding*), dan nama pelanggan (*customer name*).

---

### 2.2 Overdue Alert Center & Keamanan Tindak Lanjut (`/overdue-alert`)

- **Proteksi Kepemilikan Log Follow-Up (Author-Only Edit & Delete)**:
  - Meningkatkan akuntabilitas penagihan dengan membatasi wewenang perubahan log: staf hanya dapat mengedit atau menghapus log follow-up yang mereka susun sendiri.
  - Pada antarmuka pengguna (`OverdueInvoiceEditView`), tombol aksi Edit dan Delete dinonaktifkan atau disembunyikan untuk log yang dibuat oleh staf lain, disertai tooltip penjelasan penugasan.
  - Pada backend API (`/api/v1/overdue/[invoiceId]/progress`), metode HTTP `PATCH` dan `DELETE` memverifikasi identitas pengguna terhadap `assigned_by`. Akses dari non-pembuat log ditolak secara tegas dengan respons `403 Forbidden`.

- **Presisi Penetapan PIC Log Penagihan**:
  - Kolom PIC pada riwayat follow-up secara otomatis dipetakan ke nama lengkap staf yang menyusun log tersebut dari data profil resmi, memastikan transparansi pelaporan antar tim.

- **Penyesuaian Notifikasi Uji Coba (Alert Notification Suppression)**:
  - Notifikasi pop-up agresif yang mengganggu alur pengujian dinonaktifkan sementara komponen visual dan pesan toast tetap dipertahankan untuk memastikan kenyamanan verifikasi otomatis dan manual.

---

### 2.3 Sistem Desain, Tata Letak, & Pengalaman Pengguna (UI/UX)

- **Paginasi Dinamis & Dropup Page Size Selector**:
  - Kontrol paginasi pada tabel data utama kini mendukung pemilihan batas baris fleksibel (10, 25, 50, 100).
  - Menu dropdown batas baris menggunakan perilaku *dropup* (membuka ke atas) sehingga tidak terpotong oleh batas bawah jendela browser atau elemen footer.

- **Figma Calendar Popover pada Sales Overview**:
  - Komponen pemilihan rentang tanggal pada grafik Sales Overview diselaraskan dengan spesifikasi desain Figma.
  - Menyediakan navigasi bulan instan, penanda visual tanggal awal dan akhir, serta pintasan rentang waktu yang terintegrasi rapi.

- **Skeleton Loading Terstandarisasi**:
  - Komponen skeleton visual ditambahkan pada pratinjau data penagihan dan formulir tambah/edit follow-up, mengeliminasi efek *flicker* dan pergeseran tata letak saat data diunduh dari server.

- **Navigasi Responsif & Menu Hamburger**:
  - Desain ulang struktur navbar dan sidebar untuk mendukung perangkat mobile dan tablet melalui tombol toggle hamburger yang intuitif.

- **Modal Konfirmasi Signout Terintegrasi**:
  - Dialog konfirmasi keluar akun diposisikan secara semantik di dalam layout konten utama, memastikan fokus aksesibilitas keyboard dan navigasi yang aman.

- **Penyempurnaan Lokalisasi Dwibahasa (i18n)**:
  - Seluruh label, pesan galat, tooltip, dan konfirmasi dialog diperbarui pada kamus Bahasa Indonesia (`lib/i18n/id.ts`) dan Bahasa Inggris (`lib/i18n/en.ts`) untuk menjamin konsistensi peristilahan akuntansi dan penagihan.

---

## 3. Metrik Kualitas & Hasil Pengujian

- **Unit & Integration Tests**: 100% kelulusan pada seluruh test suite (99+ test lulus tanpa kegagalan).
- **TypeScript & Linting**: 0 galat tipe (strict type checking pada parameter union dan respons endpoint).
- **Kompilasi Produksi**: Seluruh 31 rute aplikasi berhasil dibangun secara bersih menggunakan Next.js Turbopack compiler.
