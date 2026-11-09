# C1_PISD_TR-2709-005: Export Analitik

| Field | Value |
| --- | --- |
| **Document ID** | TR-2709-005 |
| **Date** | 27-09-2026 (Updated: 09-11-2026) |
| **Author** | @Stevanus Immanuel @WebDev |
| **Parent** | [C1_PISD_FR-2709-005: Ekspor Ringkasan Analitik](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-005-ekspor-ringkasan-analitik-63WBK6503M) |
| **Priority** | P1 - Operational Feature |

Dokumen ini mendefinisikan arsitektur teknis pembuatan berkas ekspor laporan multi-format (Excel, PDF, CSV) dan generator Surat Peringatan di sisi peramban web (*client-side direct streaming*).

---

## FR-to-TR Relationship  

| Supported FR | Technical Relationship |
| --- | --- |
| [C1_PISD_FR-2709-005: Ekspor Ringkasan Analitik](https://docmost.ayutrans.id/s/ccr/p/c1-pisd-fr-2709-005-ekspor-ringkasan-analitik-63WBK6503M) | Menyediakan arsitektur pembuatan dokumen ekspor di sisi peramban menggunakan ExcelJS dan jsPDF, format CSV berstandar RFC 4180, serta template dokumen Surat Peringatan resmi. |

---

## Architecture & Technology

| Area | Requirements |
| --- | --- |
| Arsitektur Ekspor | Client-Side Direct Streaming Generator. Berkas di-render langsung di memori peramban dan diunduh sebagai binary Blob, mengeliminasi kebutuhan background worker atau antrean basis data. |
| Excel Generator | Library `exceljs` untuk menghasilkan berkas `.xlsx` dengan styling sel korporat, header tebal, border tipis, auto-width kolom, dan format angka mata uang Rupiah. |
| PDF Generator | Library `jspdf` dan `jspdf-autotable` untuk dokumen PDF orientasi landscape, kartu ringkasan eksekutif, pembagian halaman multi-page otomatis, dan footer cap waktu. |
| CSV Generator | Komposisi string UTF-8 dengan pemisah koma dan penanganan karakter spesial sesuai standar RFC 4180. |
| Skema Basis Data | Tabel antrean lawas `c1_export_request` dan `c1_export_file` telah dibersihkan (*dropped*) untuk efisiensi sistem. |

---

## Implementation Details

### 1. Ekspor Laporan Sales Overview (`SalesOverviewExportModal.tsx`)
- Mengambil parameter periode aktif (`start_period` dan `end_period`), metrik ringkasan makro, dan data deret waktu bulanan.
- Menghasilkan berkas dengan penamaan: `Sales_Overview_Report_{period}.{ext}`.
- Lembar kerja Excel memuat:
  - Header: Identitas laporan, periode filter, waktu unduh, dan pengunduh.
  - Kartu Ringkasan: Revenue, Cost, Sales Profit, Total Outstanding, Net Margin %.
  - Tabel Bulanan: Rincian baris per baris deret waktu bulanan.

### 2. Ekspor Analitik Customer
- Mengambil daftar customer yang sedang ditampilkan (beserta filter cabang, status pencarian, dan pengurutan).
- Menghasilkan berkas dengan penamaan: `Customer_Analytics_Report_{date}.{ext}`.
- Memuat kolom: Nama Customer, Kode, Cabang, Revenue, Cost, Sales Profit, Net Margin %, Total Outstanding, DSO, dan Arah Tren Pembayaran.

### 3. Generator Surat Peringatan (Warning Letter Generator)
- Generator dokumen PDF berbasis jsPDF:
  - Klasifikasi SP otomatis:
    - 30 s.d. 59 hari: `SP-1`
    - 60 s.d. 90 hari: `SP-2`
    - > 90 hari: `SP-3`
  - Nomor registrasi terstandar: `SP/{level}/{year}/{invoice_id}`.
  - Pratinjau multi-halaman interaktif sebelum unduhan.
  - Tombol aksi:
    - Simpan Draf: mengunduh berkas `Draft-SP-{invoice}.pdf`.
    - Kirim SP: mengunduh berkas `Surat-Peringatan-{level}-{invoice}.pdf`.
  - Rekening pembayaran resmi: Bank Mandiri No. Rek `1234-5678-9012` a.n. `PT Andima Transportindo`.
  - Tanda tangan resmi berjenjang: Credit Controller & PIC penagihan.

---

## Backward Compatibility API Helper

Pada modul backend `lib/supabaseOverdueApi.ts`, fungsi `requestExportFileInSupabase` didekopel dari tabel basis data usang:
```typescript
export async function requestExportFileInSupabase(
  format: "PDF" | "XLSX" | "CSV",
  requestedBy: string,
  periodFilter: Record<string, unknown>,
) {
  // Tabel c1_export_request dan c1_export_file telah di-drop.
  // Ekspor kini ditangani secara client-side atau streamed on demand.
  const requestId = `EXP-${Date.now()}`;
  const fileId = `FILE-${Date.now()}`;
  const storageReference = `exports/OVERDUE_ALERT_REPORT_${Date.now()}.${format.toLowerCase()}`;

  return {
    success: true,
    requestId,
    fileId,
    storageRef: storageReference,
  };
}
```

---

## Testing & Verification

1. **Automated Unit Testing (`tests/c1-tables-cleanup.test.mjs`)**:
   - Memverifikasi fungsi ekspor backend tidak lagi mengeksekusi kueri ke `c1_export_request` atau `c1_export_file`.
   - Memverifikasi pembuatan referensi ekspor dalam memori.
2. **Warning Letter Spec Test (`tests/overdue-polish.test.mjs`)**:
   - Memvalidasi batas hari keterlambatan untuk eligibilitas SP-1, SP-2, dan SP-3.
   - Memvalidasi isi parameter rekening bank dan penamaan berkas PDF.
