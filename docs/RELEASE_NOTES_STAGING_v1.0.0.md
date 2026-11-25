# Catatan Rilis Resmi (Release Notes) — Staging v1.0.0
## Modul C1: Credit Control & Recovery (CCR) — PT Andima Transportindo

> **Versi**: `v1.0.0-staging`  
> **Tanggal Rilis**: 19 November 2026  
> **Status Stabilitas**: *Feature Complete — Ready for Staging UAT (User Acceptance Testing)*  
> **Target Cabang (Branch)**: `development` (Merge Commit: `3b2f8f2`)  
> **Target Audiens**: Dewan Direksi, Tim Manajemen Keuangan, Tim Akuntansi & Billing, Staf Credit Control, Pengembang Teknis & Tim QA.

---

## 1. Ringkasan Eksekutif (*Executive Summary*)

Modul **C1: Credit Control & Recovery (CCR)** dirancang untuk memecahkan tantangan likuiditas kas (*cash flow bottleneck*) di PT Andima Transportindo. Dalam industri logistik multimoda dan freight forwarding, biaya operasional kargo (*trucking*, *handling*, *storage/demurrage*, dan bea pelabuhan) wajib dibayarkan di muka secara tunai, sementara pelanggan korporat menikmati termin kredit 14–60 hari.

Rilis **Staging v1.0.0** menyatukan seluruh siklus hidup piutang dan analitik finansial perusahaan ke dalam satu *Single Source of Truth*:
- Mengeliminasi ketergantungan pada spreadsheet terpisah melalui **Modul Ingestion Dokumen** dua tahap (*Preview & Validate*) dengan persistensi dokumen yang ditolak (*Rejected Document Persistence*).
- Menampilkan kesehatan arus kas secara seketika melalui **4 Kartu Metrik Makro** dan grafik tren penjualan deret waktu berkesinambungan (*Zero-Filled Time-Series*).
- Menyediakan portofolio analitik mendalam per pelanggan (*Customer Analytics*) dengan deduplikasi identitas kanonikal (pembersihan nomor MAWB otomatis).
- Mendeteksi dini invoice tertunggak (> 30 hari) melalui **Overdue Alert Center** dengan pembagian 3 *Aging Buckets*, penugasan PIC oleh Manajemen, pencatatan log tindak lanjut oleh Staf, serta pelunasan dan pembalikan transaksi otomatis (*Auto-Settlement & Auto-Reversal*).
- Menghadirkan **Dukungan Dwibahasa Penuh** (Bahasa Indonesia & Bahasa Inggris) untuk seluruh antarmuka dan laporan.

---

## 2. Akses Lingkungan Staging & Akun Pengujian (*Staging Environment & Test Credentials*)

### 2.1 Tautan Akses Lingkungan Staging
Lingkungan pengujian staging dapat diakses langsung melalui tautan berikut:

- **Halaman Utama / Dasbor**: [http://localhost:3000](http://localhost:3000)
- **Modul 1 — Ingestion Dokumen**: [http://localhost:3000/uploaded-documents](http://localhost:3000/uploaded-documents)
- **Modul 2 — Sales Overview**: [http://localhost:3000/sales-overview](http://localhost:3000/sales-overview)
- **Modul 3 — Customer Analytics**: [http://localhost:3000/customer-analytics](http://localhost:3000/customer-analytics)
- **Modul 4 — Overdue Alert Center**: [http://localhost:3000/overdue-alert](http://localhost:3000/overdue-alert)

*(Catatan: Jika aplikasi di-deploy pada lingkungan cloud/Vercel staging internal, arahkan domain basis ke URL staging yang bersangkutan).*

### 2.2 Akun Pengujian Resmi Berdasarkan Peran (*Role-Based Access Control*)
Seluruh akun pengujian di bawah ini telah disinkronkan dan terdaftar aktif pada tabel `b2_register`, `d3_positions`, dan `d3_departments`:

| Klasifikasi Akses | Nama Pengguna | Alamat Email | Posisi (*Position*) | Departemen | Default Password | Otoritas Utama |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **MANAGEMENT** | Stevanus Imanuel | `stevanusimanuel@andima.co.id` | Director of Finance | Finance | `@CCR12345a` | Monitor makro, filter analitik, penetapan PIC penagihan |
| **MANAGEMENT** | Jonathan Indrawan | `jonathanindrawan@andima.co.id` | Acc Manager | Finance | `@CCR12345a` | Monitor makro, audit piutang, penetapan PIC |
| **MANAGEMENT** | Diaz Bara | `diazbara1@andima.co.id` | Customer Success Manager | Cust Success | `@CCR12345a` | Analisis tren pelanggan & DSO, penetapan PIC |
| **MANAGEMENT** | Aldo Sapan | `aldosapan@andima.co.id` | Cash Manager | Finance | `@CCR12345a` | Evaluasi arus kas & kebutuhan modal, penetapan PIC |
| **STAFF** | Jesi Chan | `jesichan@andima.co.id` | Billing | Finance | `@CCR12345a` | Unggah dokumen, hapus berkas, log follow-up, settlement |

> [!NOTE]
> Akun fiktif terdahulu (`michaeljackson@...`, `taylorswift@...`, `keanureeves@...`, `emmawatson@...`, `tomhanks@...`) beserta seluruh riwayat penugasan yatim telah dibersihkan secara tuntas dari basis data.

---

## 3. Rincian Pembaruan Fitur (*Feature Updates & Changelog*)

### 3.1 Modul Ingestion Dokumen & Validasi Skema Preflight
- **Alur Dua Tahap (*Preview & Validate*)**:
  - File Excel (`.xlsx`, `.xls`) dan PDF diparsing terlebih dahulu di memori (*in-memory preflight*) sebelum disimpan ke basis data.
  - Pengguna dapat melihat ringkasan baris data valid, calon entitas customer baru, serta peringatan anomali data sebelum mengklik tombol finalisasi.
- **Pencatatan Dokumen Gagal/Ditolak (*Rejected Document Persistence*)**:
  - Berkas yang gagal saat tahap validasi atau ditolak oleh pengguna kini tetap tercatat di tabel `c1_document_uploads` dengan status resmi `REJECTED`.
  - Temuan rincian galat baris per baris disimpan di `c1_document_validation_errors` untuk keperluan jejak audit (*audit trail*), tanpa menyimpan berkas fisik ke Supabase Storage.
  - Tersedia modal inspeksi galat (*"View Validation Findings"*) yang menampilkan nomor baris dan keterangan galat secara interaktif.
- **Standarisasi Kolom Biaya Operasional Sesuai Dokumen Resmi**:
  - Rincian kolom biaya pada pratinjau dan tabel kini diselaraskan dengan dokumen operasional PT Andima Transportindo:
    $$\text{Format Baru: } \mathbf{Sub\ Total} \quad\vert\quad \mathbf{VAT} \quad\vert\quad \mathbf{PPH\ 23} \quad\vert\quad \mathbf{Others} \quad\vert\quad \mathbf{DIP\ IATA}$$
  - Menggantikan label teknis lama (*trucking cost*, *handling cost*, *storage cost*, *other operational cost*).
- **Penghapusan Bertingkat Atomik (*Atomic Cascading Deletion*)**:
  - Penghapusan dokumen pada tabel `/uploaded-documents` memicu pembersihan menyeluruh (*cascade cleanup*) terhadap tabel staging, transaksi pembayaran turunan (`c1_payment_transactions`), dan entitas customer baru yang tidak lagi memiliki referensi dokumen lain, menjaga kebersihan master customer `c1_customer`.
- **Keamanan Format Berkas**:
  - Penolakan format berisiko seperti `.csv` secara otomatis di sisi klien dan server dengan pesan instruksi ramah (*CSV is not supported; please convert to XLSX*).

---

### 3.2 Modul Kartu Metrik Makro & Tren Kinerja Penjualan (`/sales-overview`)
- **4 Kartu Metrik Finansial Otoritatif**:
  1. **Sales Profit Period**: Keuntungan operasional bersih periode berjalan ($\text{Revenue} - \text{Cost}$).
  2. **Cost Requirement Period**: Akumulasi biaya modal operasional yang harus dibayar di muka.
  3. **Outstanding Period**: Total tagihan piutang belum tertagih dalam rentang evaluasi.
  4. **Net Margin Ratio**: Rasio margin keuntungan bersih terhadap total pendapatan kotor ($(\text{Sales Profit} / \text{Revenue}) \times 100\%$).
- **Deret Waktu Zero-Filled (*Zero-Filled Time-Series*)**:
  - Menghilangkan celah grafis pada visualisasi grafik Recharts jika terdapat bulan tanpa aktivitas transaksi. Server menyuntikkan angka `0` secara eksplisit sehingga kurva tren tetap berkesinambungan.
- **Filter Periode Cepat (*Quick Period Filters*)**:
  - Pemilihan rentang dinamis: *Trailing 3 Months*, *Trailing 6 Months*, *Trailing 12 Months*, dan *Full Year* dengan tetap mempertahankan bulan akhir pilihan pengguna.
- **Pencegahan Pergeseran Tata Letak (*Skeleton Loading*)**:
  - Penggunaan komponen skeleton berdimensi persis pada kartu metrik dan area grafik untuk mencegah *Cumulative Layout Shift* (CLS) saat data sedang dimuat.
- **Generator Ekspor Multi-Format di Sisi Klien**:
  - Ekspor instan ke format Excel (`.xlsx` dengan format sel akuntansi Rupiah `Rp #,##0`), PDF eksekutif lanskap (`.pdf` via jsPDF), dan CSV (standar RFC 4180) tanpa membebani penyimpanan server.

---

### 3.3 Modul Portofolio Customer Analytics (`/customer-analytics`)
- **Deduplikasi Identitas Kanonikal & Pembersihan MAWB**:
  - Algoritma normalisasi otomatis memotong nomor MAWB dan angka unik di belakang nama pelanggan (contoh: `"PT Cahaya Logistik 17278941"` dipetakan secara akurat ke entitas induk kanonikal `"PT Cahaya Logistik"`).
  - Menggabungkan alias entitas cabang sehingga total piutang dan omset tidak terpecah.
- **Halaman Profil Granular Customer (`/customer-analytics/[customerId]`)**:
  - Menampilkan metrik *Days Sales Outstanding* (DSO), tren riwayat pembayaran, tabel seluruh invoice aktif, serta modal riwayat pelunasan bertahap.
- **Optimasi Kueri URL Chunking**:
  - Penanganan pelanggan dengan jumlah alias yang besar menggunakan mekanisme *chunked querying* untuk mencegah galat *HTTP 431 Request Header Fields Too Large*.

---

### 3.4 Modul Overdue Alert Center & Alur Penagihan Terpadu (`/overdue-alert`)
- **Deteksi Piutang Tertunggak Otomatis**:
  - Memfilter seluruh invoice dari dokumen outstanding yang telah melewati tanggal jatuh tempo (> 30 hari), disajikan terurut dari tanggal jatuh tempo paling lama (*oldest due date first*).
- **Pengelompokan 3 Tingkat Risiko (*Title Case Aging Buckets*)**:
  1. **Watchlist (1 - 30 Hari Keterlambatan)**: Kategori peringatan awal dan konfirmasi penagihan ramah.
  2. **Medium Risk (31 - 60 Hari Keterlambatan)**: Kategori moderat yang memerlukan komitmen janji bayar tertulis (*Promise Date*).
  3. **High Risk (> 60 Hari Keterlambatan)**: Kategori kritis yang membutuhkan negosiasi tingkat tinggi atau pembekuan fasilitas kredit. Label lama *Legal Escalation* telah distandarisasi ke dalam *High Risk*.
- **Pemisahan Peran Tegas (RBAC)**:
  - **Management**: Menetapkan staf penanggung jawab (*Assign PIC*) untuk satu atau banyak invoice tertunggak secara massal.
  - **Staff**: Mencatat log tindak lanjut, tanggal janji bayar, mengedit/menghapus riwayat tindak lanjut sebelumnya, serta mencatat pelunasan tagihan.
- **Siklus Pelunasan & Pembalikan Otomatis (*Auto-Settlement & Auto-Reversal*)**:
  - Mengubah status tindak lanjut menjadi `COMPLETED` otomatis mencatat transaksi pelunasan di `c1_payment_transactions` (referensi `SETTLE-{assignmentId}`) dan mengeluarkan tagihan dari daftar overdue.
  - Menghapus atau mengubah log status `COMPLETED` otomatis membatalkan pelunasan tersebut (*reversal*) dan mengembalikan tagihan ke daftar overdue aktif.
- **Tombol Refresh Terdekupel (*Decoupled Refresh*)**:
  - Staf penagih dapat menekan tombol Refresh tanpa mengalami galat `403 Forbidden` karena prosedur evaluasi manajerial dijalankan secara non-blocking sesuai tingkat peran pengguna.

---

### 3.5 Fitur Pendukung Tambahan (*Good-to-Have Capabilities*)
- **Dukungan Dwibahasa Penuh (*Bilingual Language Toggle*)**:
  - Pengguna dapat beralih secara instan antara Bahasa Indonesia (`id`) dan Bahasa Inggris (`en`) melalui toggle pada navigasi utama.
  - Mencakup seluruh label navigasi, kartu KPI, header dan filter tabel, status risiko, modal konfirmasi, format tanggal, dan mata uang.
- **Pembersihan Skema Basis Data (*Dead Tables Elimination*)**:
  - Menghapus 5 tabel usang dari skema Supabase (`c1_sales_performance_metrics`, `c1_financial_risk_indicators`, dll.) dan beralih sepenuhnya ke 10 tabel aktif yang dioptimalkan dengan fungsi Stored Procedure / RPC PostgreSQL.

---

## 4. Daftar Rujukan Dokumen Teknis & Fungsional (*Documentation References*)

Dokumentasi arsitektur, spesifikasi fungsional, dan pedoman teknis yang mendasari rilis ini tersedia pada tautan berikut:

1. **Panduan Eksekutif & Sistem Komprehensif (Fungsional & Bisnis)**:  
   👉 [FRTR/C1_Modul_CCR_Comprehensive_Story_and_System_Guide.md](file:///d:/Stev/Kuliah/Sem%205/PISD/Andima-POS/FRTR/C1_Modul_CCR_Comprehensive_Story_and_System_Guide.md)  
   *Memuat latar belakang bisnis logistik, glosarium metrik keuangan (DSO, Net Margin), diagram alur data end-to-end (Mermaid), bedah detail per halaman, alur settlement/reversal, dan panduan presentasi dewan direksi.*

2. **Cetak Biru Arsitektur Backend & Basis Data (Teknis)**:  
   👉 [FRTR/backend-documentation.md](file:///d:/Stev/Kuliah/Sem%205/PISD/Andima-POS/FRTR/backend-documentation.md)  
   *Memuat inventori 10 tabel aktif skema `c1_`, dokumentasi RPC Stored Procedure otoritatif, Route Handler API Next.js 16, dan matriks otorisasi RBAC.*

3. **Standar Kontrol Versi & Kualitas Kode (Version Control Standards)**:  
   👉 [docs/VERSION_CONTROL.md](file:///d:/Stev/Kuliah/Sem%205/PISD/Andima-POS/docs/VERSION_CONTROL.md)  
   *Memuat pedoman Conventional Commits 1.0.0, Trunk-Based/Feature Branching, kriteria review Pull Request, pedoman anti-slop code, dan aturan rilis SemVer.*

4. **Spesifikasi Formal Version Control & QA**:  
   👉 [FRTR/version-control-documentation.md](file:///d:/Stev/Kuliah/Sem%205/PISD/Andima-POS/FRTR/version-control-documentation.md)  
   *Memuat dokumentasi version control formal untuk pelaporan proyek akademis dan korporat.*

---

## 5. Laporan Penjaminan Kualitas (*Quality Assurance & Verification Report*)

Sebelum perilisan versi staging ini, seluruh komponen sistem telah melewati pengujian otomatis dan statis dengan hasil sempurna:

### 5.1 Hasil Uji Otomatis (*Automated Test Suites*)
```text
> my-app@0.1.0 test
> node --test tests/*.test.mjs

ℹ tests 59
ℹ suites 0
ℹ pass 59
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms ~15083ms (15.08s)
```

**Cakupan Pengujian Kunci yang Lolos 100%**:
1. `analytics RPCs aggregate validated C1 data and preserve API semantics` (PASS)
2. `overdue refresh uses latest validated upload rows and removes stale alerts` (PASS)
3. `analytics merges duplicate company identities into one canonical row` (PASS)
4. `payment RPC records partial payment and rejects overpayment` (PASS)
5. `analytics deduplicates company names with embedded MAWB or numbers` (PASS)
6. `CCR authorization matrix allows chart access for management and staff` (PASS)
7. `finalizing a validation failure creates a Rejected document without storing original file` (PASS)
8. `validateRows accepts exact document columns Sub Total, VAT, PPH 23, Others, DIP IATA` (PASS)
9. `cascade deletion migration removes payment transactions and unreferenced upload customers` (PASS)
10. `document delete is Staff-only and maps processing status to conflict` (PASS)
11. `Overdue risk status maps to Title Case without Legal Escalation` (PASS)
12. `Overdue settlement payment flow and exclusions` (PASS)

### 5.2 Analisis Tipe Statis (*TypeScript Static Analysis*)
- Eksekusi: `pnpm exec tsc --noEmit`
- Hasil: **0 Errors / 0 Type Mismatches** (Sistem terverifikasi *type-safe* sepenuhnya).

### 5.3 Audit Kualitas Kode (*Anti-Slop Standards Compliance*)
- Bebas dari *dead imports*, kode usang, dan mocking data fiktif pada alur produksi.
- Kueri basis data dijalankan secara *server-side authoritative* dengan perlindungan terhadap SQL Injection dan validasi skema runtime.

