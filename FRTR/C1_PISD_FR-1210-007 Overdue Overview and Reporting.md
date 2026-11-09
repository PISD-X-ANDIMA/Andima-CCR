# C1_PISD_FR-1210-007: Overdue Overview and Reporting

| Field | Value |
| --- | --- |
| **Document ID** | FR-01210-007 |
| **Date** | 12-10-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [C1_PISD_FR-2709-004: Deteksi Dini Overdue Alert dan Assignment](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-004-deteksi-dini-overdue-alert-dan-assignment-Ujab6Rj70Z) |
| **Priority** | P1 - Enhancement |

Dokumen ini mendefinisikan kebutuhan fungsional untuk menyajikan ringkasan metrik keterlambatan pembayaran eksekutif, tabel pemantauan piutang terpadu, mekanisme seleksi baris dan tombol checklist dinamis, serta navigasi alur kerja penagihan komprehensif pada modul Overdue Alert.

---

## Description

Sistem harus menyediakan pusat kendali penagihan piutang (*Overdue Alert Center*) yang menyajikan kartu ringkasan KPI tagihan tertunggak, tabel data tagihan dengan penyaringan komprehensif, fitur aktivasi tombol checklist otomatis saat baris dipilih, modal pratinjau invoice lengkap, serta tautan navigasi langsung ke alur penugasan dan riwayat penyuntingan penagihan.

---

## Scope and Users

| Item | Value |
| --- | --- |
| Scope | Kartu KPI overdue; filter operasional (cabang, aging bucket, status resiko Title Case, pencarian teks); tabel data overdue interaktif; tombol seleksi dan checklist aksi cepat; modal pratinjau invoice; integrasi navigasi ke formulir create/edit tindak lanjut. |
| Actor / user role | Level Management / Supervisor (`MANAGEMENT`) dengan akses monitoring menyeluruh dan penetapan staf; Level Admin / Staff (`STAFF`) dengan akses pemantauan dan eksekusi tindak lanjut. |

---

## Functional Requirements

- **FR-CCR-007-01 Kartu Ringkasan KPI Overdue Eksekutif**  
  Sistem menyajikan empat kartu indikator utama pada bagian atas dasbor:
  1. **Total Overdue Invoices**: Total kuantitas lembar invoice yang sedang tertunggak.
  2. **Total Overdue Amount**: Akumulasi nominal rupiah piutang yang belum terbayar.
  3. **High Risk Overdue**: Total nominal piutang dengan keterlambatan lebih dari 60 hari.
  4. **Active Cases**: Jumlah entitas customer yang sedang memiliki kasus penunggakan aktif.
- **FR-CCR-007-02 Filter Operasional Terpadu**  
  Sistem menyediakan kontrol penyaringan multi-dimensi:
  - **Branch**: Semua Cabang, Jakarta, Semarang, Surabaya, Balikpapan.
  - **Aging Bucket**: Semua Bucket, 1 - 30 Hari (Watchlist), 31 - 60 Hari (Medium Risk), > 60 Hari (High Risk).
  - **Risk Status**: Opsi berlabel Title Case (`All`, `High Risk`, `Medium Risk`, `Watchlist`, `Negotiation`).
  - **Pencarian Cepat**: Filter teks instan mencocokkan nomor invoice, nama customer, atau nomor NPWP.
- **FR-CCR-007-03 Seleksi Baris dan Tombol Checklist Dinamis**  
  Tabel mendukung seleksi satu atau banyak baris invoice menggunakan checkbox. Memilih setidaknya satu baris tagihan secara otomatis memunculkan tombol checklist aksi cepat untuk penugasan massal atau pemrosesan batch.
- **FR-CCR-007-04 Modal Pratinjau Invoice Lengkap (Overdue Invoice Preview Modal)**  
  Setiap nomor invoice pada tabel dapat diklik untuk membuka modal pratinjau yang menampilkan:
  - Informasi nomor invoice, nama entitas customer, cabang, dan NPWP.
  - Tanggal terbit invoice, tanggal jatuh tempo, hari keterlambatan (*days overdue*), dan status resiko.
  - Nominal tagihan asli, sisa saldo terutang, dan riwayat PIC penanggung jawab saat ini.
- **FR-CCR-007-05 Navigasi Alur Tindak Lanjut Terdedikasi**  
  Tabel menyediakan tombol aksi langsung pada setiap baris invoice:
  - Tombol aksi "+ Log Follow Up" menavigasikan pengguna ke halaman penuh Create Follow-up (`/overdue-alert/create/[id]`).
  - Menu aksi "Edit / View History" menavigasikan pengguna ke halaman penuh Edit Overdue (`/overdue-alert/edit/[id]`) yang dilengkapi timeline kronologis dan tombol Back di posisi atas.

---

## Business Rules

1. Seluruh KPI dan daftar invoice dievaluasi secara dinamis dari tabel `c1_overdue_alert` yang digabungkan dengan `c1_assignment` terbaru dan master customer.
2. Tagihan yang telah lunas otomatis hilang dari daftar dan mengurangi total KPI yang tampil secara waktu nyata.
3. Hak penetapan PIC hanya dapat diakses oleh pengguna level Management, sedangkan staf hanya dapat mencatat dan memperbarui progres tindak lanjut.

---

## API Endpoint Contract

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/overdue-alerts | Mengambil ringkasan KPI, total item, dan daftar tagihan tertunggak sesuai filter dan pencarian. | Staff & Management |
| POST | /api/v1/overdue-alerts | Menjalankan aksi evaluasi ulang proyeksi overdue atau penugasan PIC massal/tunggal. | Management (`MANAGEMENT`) |

---

## Acceptance Criteria

1. Dasbor menampilkan empat kartu KPI (Total Invoices, Total Amount, High Risk Amount, Active Cases) dengan nilai yang akurat.
2. Filter cabang, bucket usia tunggakan, status resiko Title Case, dan kotak pencarian teks berfungsi memfilter data secara instan.
3. Memilih baris invoice mengaktifkan tombol checklist aksi cepat di antarmuka.
4. Mengklik nomor invoice membuka modal pratinjau dengan rincian saldo dan status penugasan.
5. Tombol aksi mengarahkan pengguna ke halaman formulir tindak lanjut create dan edit dengan tata letak yang lebar dan responsif.

---

## Source Traceability

| Source | Requirements Coverage |
| --- | --- |
| [C1_PISD_FR-2709-004: Deteksi Dini Overdue Alert dan Assignment](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-004-deteksi-dini-overdue-alert-dan-assignment-Ujab6Rj70Z) | Induk fitur evaluasi jatuh tempo, penetapan PIC, dan pemantauan piutang. |
| [Problem Statement](https://docmost.ayutrans.id/s/ccr/p/problem-statement-NrsepJHfgy) | Ketiadaan visibilitas portofolio penagihan piutang dan pelaporan penanggung jawab operasional. |
