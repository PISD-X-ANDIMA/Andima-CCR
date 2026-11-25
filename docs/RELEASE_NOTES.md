# Riwayat Catatan Rilis (Release Notes Index)
## PT Andima Transportindo — Sistem POS & Credit Control & Recovery (CCR)

Dokumen ini mencatat seluruh riwayat versi rilis resmi aplikasi berdasarkan prinsip **Semantic Versioning 2.0.0** dan alur kerja *Trunk-Based / Feature-Branch* sebagaimana diatur dalam [docs/VERSION_CONTROL.md](file:///d:/Stev/Kuliah/Sem%205/PISD/Andima-POS/docs/VERSION_CONTROL.md).

---

## Daftar Versi Rilis

### [v1.0.0-staging] — 19 November 2026
**Modul C1: Credit Control & Recovery (CCR) — Staging Feature Complete Release**

- **Dokumentasi Lengkap**: 👉 [docs/RELEASE_NOTES_STAGING_v1.0.0.md](file:///d:/Stev/Kuliah/Sem%205/PISD/Andima-POS/docs/RELEASE_NOTES_STAGING_v1.0.0.md)
- **Cabang Git**: `development` (Merge commit `3b2f8f2`)
- **Status Mutu**: 59 dari 59 unit test lulus 100%, 0 TypeScript errors.
- **Rangkuman Perubahan Utama**:
  - **Ingestion Dokumen**: Validasi dua tahap (*Preview & Validate*), persistensi dokumen gagal dengan status `REJECTED`, standarisasi kolom biaya (`Sub Total`, `VAT`, `PPH 23`, `Others`, `DIP IATA`), dan cascade deletion pembersihan transaksi/customer yatim.
  - **Sales Overview**: 4 kartu metrik makro finansial, deret waktu *Zero-Filled Time-Series*, filter periode dinamis, grafik stacked area anti-CLS skeleton, dan generator ekspor sisi klien multi-format (Excel, PDF, CSV).
  - **Customer Analytics**: Deduplikasi kanonikal pemotongan MAWB otomatis, profil rinci customer dengan modal riwayat pelunasan, serta optimasi query URL chunking.
  - **Overdue Alert Center**: Pemantauan invoice jatuh tempo > 30 hari (*oldest due date first*), 3 aging buckets (`Watchlist`, `Medium Risk`, `High Risk`), pemisahan wewenang penugasan PIC oleh Management dan log tindak lanjut oleh Staff, auto-settlement dan auto-reversal, serta tombol decoupled refresh.
  - **Dukungan Dwibahasa Penuh**: *Language toggle* instan Bahasa Indonesia (`id`) & English (`en`) di seluruh modul antarmuka.
  - **Sinkronisasi Akun Staging**: 5 akun pengujian terdaftar resmi per peran (`stevanusimanuel@...`, `jonathanindrawan@...`, `diazbara1@...`, `aldosapan@...`, `jesichan@...`) dan pembersihan tuntas akun fiktif lama.

