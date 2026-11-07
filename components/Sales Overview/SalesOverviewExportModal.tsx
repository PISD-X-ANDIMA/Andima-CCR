"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  PieChart,
  Receipt,
  Square,
  Table,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import type { AlertRow, MacroPoint, MacroSummary, RecentDocument } from "./SalesOverview";

export type ExportFormat = "PDF" | "XLSX" | "CSV";

interface SalesOverviewExportModalProps {
  open: boolean;
  onClose: () => void;
  summary: MacroSummary;
  series: MacroPoint[];
  startPeriod: string;
  endPeriod: string;
  alerts?: AlertRow[];
  documents?: RecentDocument[];
  defaultFormat?: ExportFormat;
}

type PdfColumnDef = {
  title: string;
  width: number;
  align: "left" | "center" | "right";
};

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function periodParts(period: string) {
  const [year, month] = (period || "").split("-").map(Number);
  return { year: year || 2026, month: month || 1 };
}

function periodLabel(period: string) {
  if (!period) return "-";
  const { year, month } = periodParts(period);
  return `${monthNames[(month || 1) - 1]} ${year}`;
}

export default function SalesOverviewExportModal({
  open,
  onClose,
  summary,
  series,
  startPeriod,
  endPeriod,
  alerts = [],
  documents = [],
  defaultFormat = "PDF",
}: SalesOverviewExportModalProps) {
  // Export Format State
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultFormat);

  // Checklist states
  const [selectedCards, setSelectedCards] = useState({
    salesProfit: true,
    cost: true,
    outstanding: true,
    netMargin: true,
  });

  // Section 2: Unified Monthly Financial Performance Trend (1 checklist)
  const [includePerformanceTrend, setIncludePerformanceTrend] = useState(true);

  // Section 3 & 4
  const [includeAlerts, setIncludeAlerts] = useState(true);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filter series to the active period
  const filteredSeries = useMemo(() => {
    return series
      .filter((p) => p.period_month >= startPeriod && p.period_month <= endPeriod)
      .sort((a, b) => a.period_month.localeCompare(b.period_month));
  }, [series, startPeriod, endPeriod]);

  if (!open) return null;

  const allCardsChecked = Object.values(selectedCards).every(Boolean);

  const toggleAllCards = () => {
    const nextState = !allCardsChecked;
    setSelectedCards({
      salesProfit: nextState,
      cost: nextState,
      outstanding: nextState,
      netMargin: nextState,
    });
  };

  const selectAllEverything = () => {
    setSelectedCards({ salesProfit: true, cost: true, outstanding: true, netMargin: true });
    setIncludePerformanceTrend(true);
    setIncludeAlerts(true);
    setIncludeDocuments(true);
  };

  const deselectAllEverything = () => {
    setSelectedCards({ salesProfit: false, cost: false, outstanding: false, netMargin: false });
    setIncludePerformanceTrend(false);
    setIncludeAlerts(false);
    setIncludeDocuments(false);
  };

  const totalSelectableCount = 7; // 4 cards + 1 trend + 1 alerts + 1 documents
  const selectedCount =
    Object.values(selectedCards).filter(Boolean).length +
    (includePerformanceTrend ? 1 : 0) +
    (includeAlerts ? 1 : 0) +
    (includeDocuments ? 1 : 0);

  const isAllSelected = selectedCount === totalSelectableCount;
  const isPartiallySelected = selectedCount > 0 && selectedCount < totalSelectableCount;

  const toggleMasterSelectAll = () => {
    if (isAllSelected) {
      deselectAllEverything();
    } else {
      selectAllEverything();
    }
  };

  const anyCardsSelected = Object.values(selectedCards).some(Boolean);

  type PreviewSectionKey = "cards" | "charts" | "alerts" | "documents";

  const previewPages = useMemo(() => {
    const active: PreviewSectionKey[] = [];
    if (anyCardsSelected && summary) active.push("cards");
    if (includePerformanceTrend && filteredSeries.length > 0) active.push("charts");
    if (includeAlerts && alerts.length > 0) active.push("alerts");
    if (includeDocuments && documents.length > 0) active.push("documents");

    if (active.length <= 2) {
      return [active];
    }

    if (active.length === 3) {
      if (active.includes("cards") && active.includes("charts")) {
        return [["cards", "charts"], active.filter((s) => s !== "cards" && s !== "charts")];
      }
      return [[active[0]], active.slice(1)];
    }

    // active.length === 4 (Semua komponen aktif):
    // Halaman 1: cards + charts (Ringkasan Finansial Eksekutif)
    // Halaman 2: alerts + documents (Operasional & Kepatuhan)
    return [
      ["cards", "charts"],
      ["alerts", "documents"],
    ];
  }, [anyCardsSelected, summary, includePerformanceTrend, filteredSeries, includeAlerts, alerts, includeDocuments, documents]);

  // ==========================================
  // 1. PDF EXPORT (All Black, No Table BG, All Data)
  // ==========================================
  const handleExportPdf = () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const left = 14;
      const right = 196;
      let y = 16;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > 275) {
          pdf.addPage();
          y = 16;
          // Mini running continuation header in pure black
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(0, 0, 0);
          pdf.text("PT ANDIMA TRANSPORTINDO - SALES OVERVIEW REPORT (Lanjutan)", left, y);
          pdf.setFont("helvetica", "normal");
          pdf.text(`${periodLabel(startPeriod)} - ${periodLabel(endPeriod)}`, right, y, { align: "right" });
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.2);
          pdf.line(left, y + 2, right, y + 2);
          y += 8;
        }
      };

      // Header Banner (Black & White Minimalist)
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text("PT ANDIMA TRANSPORTINDO", left, y);

      pdf.setFontSize(8.5);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      const todayStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      pdf.text(`Generated: ${todayStr}`, right, y, { align: "right" });
      y += 6;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.text("SALES OVERVIEW REPORT", left, y);
      y += 5;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Periode Evaluasi: ${periodLabel(startPeriod)} - ${periodLabel(endPeriod)}`, left, y);
      y += 3;

      // Divider (Clean Black Line)
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.6);
      pdf.line(left, y, right, y);
      pdf.setLineWidth(0.2);
      y += 7;

      // 1. CARDS SECTION (Clean Box Borders, No Fill, All Black Text)
      if (anyCardsSelected && summary) {
        checkPageBreak(38);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text("1. RINGKASAN METRIK FINANSIAL", left, y);
        y += 5;

        // Build list of active cards
        const cardItems = [];
        if (selectedCards.salesProfit) {
          cardItems.push({ label: "SALES PROFIT PERIOD", value: money.format(summary.sales_profit ?? 0), note: "Total Revenue - Cost" });
        }
        if (selectedCards.cost) {
          cardItems.push({ label: "COST REQUIREMENT PERIOD", value: money.format(summary.cost ?? 0), note: "Total Biaya Operasional" });
        }
        if (selectedCards.outstanding) {
          cardItems.push({ label: "OUTSTANDING PERIOD", value: money.format(summary.total_outstanding ?? 0), note: "Total Tagihan Belum Tertagih" });
        }
        if (selectedCards.netMargin) {
          const ratio = summary.revenue ? `${((summary.sales_profit / summary.revenue) * 100).toFixed(1)}%` : "-";
          cardItems.push({ label: "NET MARGIN RATIO", value: ratio, note: "Rasio Margin Penjualan" });
        }

        const cols = cardItems.length === 1 ? 1 : cardItems.length === 2 ? 2 : cardItems.length === 3 ? 3 : 2;
        const boxWidth = (right - left - (cols - 1) * 4) / cols;
        const boxHeight = 18;

        for (let i = 0; i < cardItems.length; i++) {
          const colIndex = i % cols;
          const rowIndex = Math.floor(i / cols);
          const bx = left + colIndex * (boxWidth + 4);
          const by = y + rowIndex * (boxHeight + 4);

          // Card Box: Stroke only (No Background Color)
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.25);
          pdf.roundedRect(bx, by, boxWidth, boxHeight, 1, 1, "S");

          // Label
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7);
          pdf.setTextColor(0, 0, 0);
          pdf.text(cardItems[i].label, bx + 3, by + 5);

          // Value
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.text(cardItems[i].value, bx + 3, by + 11);

          // Note
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(6.5);
          pdf.setTextColor(0, 0, 0);
          pdf.text(cardItems[i].note, bx + 3, by + 15);
        }

        const totalRows = Math.ceil(cardItems.length / cols);
        y += totalRows * (boxHeight + 4) + 4;
      }

      // 2. MONTHLY FINANCIAL PERFORMANCE TREND (Clean Lines, No Background)
      if (includePerformanceTrend && filteredSeries.length > 0) {
        checkPageBreak(40);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text("2. TREN KINERJA FINANSIAL BULANAN", left, y);
        y += 5;

        // Table Header
        const tableCols: PdfColumnDef[] = [
          { title: "Periode", width: 30, align: "left" },
          { title: "Revenue", width: 38, align: "right" },
          { title: "Cost", width: 38, align: "right" },
          { title: "Sales Profit", width: 38, align: "right" },
          { title: "Outstanding", width: 38, align: "right" },
        ];

        // Adjust column widths to fill table width exactly
        const totalDefinedWidth = tableCols.reduce((sum, c) => sum + c.width, 0);
        const scaleFactor = (right - left) / totalDefinedWidth;
        tableCols.forEach((c) => (c.width = c.width * scaleFactor));

        // Draw Table Header (Border Lines, No Background Fill)
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.3);
        pdf.line(left, y, right, y);
        pdf.line(left, y + 6.5, right, y + 6.5);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(0, 0, 0);

        let curX = left;
        for (const col of tableCols) {
          const tx = col.align === "right" ? curX + col.width - 2 : curX + 2;
          pdf.text(col.title, tx, y + 4.5, { align: col.align });
          curX += col.width;
        }
        y += 6.5;

        // Draw Data Rows (No Zebra Stripe Fill, Light Horizontal Lines)
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);

        filteredSeries.forEach((pt) => {
          checkPageBreak(6.5);
          pdf.setTextColor(0, 0, 0);

          let rowX = left;
          for (const col of tableCols) {
            let val = "";
            if (col.title === "Periode") val = periodLabel(pt.period_month);
            else if (col.title === "Revenue") val = money.format(pt.revenue);
            else if (col.title === "Cost") val = money.format(pt.cost);
            else if (col.title === "Sales Profit") val = money.format(pt.sales_profit);
            else if (col.title === "Outstanding") val = money.format(pt.total_outstanding);

            const tx = col.align === "right" ? rowX + col.width - 2 : rowX + 2;
            pdf.text(val, tx, y + 4.2, { align: col.align });
            rowX += col.width;
          }

          // Bottom border for row
          pdf.setDrawColor(210, 215, 220);
          pdf.setLineWidth(0.15);
          pdf.line(left, y + 6, right, y + 6);

          y += 6;
        });

        y += 4;
      }

      // 3. OVERDUE ALERTS SECTION (Prints ALL Data, No Background)
      if (includeAlerts && alerts.length > 0) {
        checkPageBreak(35);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`3. DAFTAR PERINGATAN OVERDUE (> 30 HARI) - Total: ${alerts.length} Invoices`, left, y);
        y += 5;

        const alertCols: PdfColumnDef[] = [
          { title: "No. Invoice", width: 34, align: "left" },
          { title: "Pelanggan", width: 62, align: "left" },
          { title: "Jatuh Tempo", width: 24, align: "center" },
          { title: "Overdue", width: 22, align: "center" },
          { title: "Total Tagihan", width: 40, align: "right" },
        ];

        // Draw Table Header (Border Lines, No Fill)
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.3);
        pdf.line(left, y, right, y);
        pdf.line(left, y + 6.5, right, y + 6.5);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(0, 0, 0);

        let curX = left;
        for (const col of alertCols) {
          const tx = col.align === "right" ? curX + col.width - 2 : col.align === "center" ? curX + col.width / 2 : curX + 2;
          pdf.text(col.title, tx, y + 4.5, { align: col.align });
          curX += col.width;
        }
        y += 6.5;

        // Draw Data Rows - ALL ALERTS (No slice cap)
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);

        alerts.forEach((alert) => {
          checkPageBreak(6.5);
          pdf.setTextColor(0, 0, 0);

          let rowX = left;
          alertCols.forEach((col) => {
            let val = "";
            if (col.title === "No. Invoice") val = alert.id;
            else if (col.title === "Pelanggan") val = (alert.client || "").slice(0, 36);
            else if (col.title === "Jatuh Tempo") val = alert.due;
            else if (col.title === "Overdue") val = `${alert.days} Hari`;
            else if (col.title === "Total Tagihan") val = money.format(alert.amount);

            const tx = col.align === "right" ? rowX + col.width - 2 : col.align === "center" ? rowX + col.width / 2 : rowX + 2;
            pdf.text(val, tx, y + 4.2, { align: col.align });
            rowX += col.width;
          });

          // Bottom border for row
          pdf.setDrawColor(210, 215, 220);
          pdf.setLineWidth(0.15);
          pdf.line(left, y + 6, right, y + 6);

          y += 6;
        });

        y += 4;
      }

      // 4. RECENT DOCUMENTS SECTION (Prints ALL Data, No Background)
      if (includeDocuments && documents.length > 0) {
        checkPageBreak(35);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`4. RIWAYAT DOKUMEN UPLOAD TERAKHIR (${documents.length} Dokumen)`, left, y);
        y += 5;

        const docCols: PdfColumnDef[] = [
          { title: "Nama File Dokumen", width: 75, align: "left" },
          { title: "Tipe", width: 45, align: "left" },
          { title: "Waktu Upload", width: 32, align: "center" },
          { title: "Status", width: 30, align: "center" },
        ];

        // Draw Table Header (Border Lines, No Fill)
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.3);
        pdf.line(left, y, right, y);
        pdf.line(left, y + 6.5, right, y + 6.5);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(0, 0, 0);

        let curX = left;
        for (const col of docCols) {
          const tx = col.align === "right" ? curX + col.width - 2 : col.align === "center" ? curX + col.width / 2 : curX + 2;
          pdf.text(col.title, tx, y + 4.5, { align: col.align });
          curX += col.width;
        }
        y += 6.5;

        // Draw Data Rows - ALL DOCUMENTS
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);

        documents.forEach((doc) => {
          checkPageBreak(6.5);
          pdf.setTextColor(0, 0, 0);

          let rowX = left;
          docCols.forEach((col) => {
            let val = "";
            if (col.title === "Nama File Dokumen") val = doc.file_name.slice(0, 42);
            else if (col.title === "Tipe") val = doc.document_type.replace(/_/g, " ");
            else if (col.title === "Waktu Upload") val = doc.uploaded_at.slice(0, 10);
            else if (col.title === "Status") val = doc.validation_status.toUpperCase();

            const tx = col.align === "right" ? rowX + col.width - 2 : col.align === "center" ? rowX + col.width / 2 : rowX + 2;
            pdf.text(val, tx, y + 4.2, { align: col.align });
            rowX += col.width;
          });

          // Bottom border for row
          pdf.setDrawColor(210, 215, 220);
          pdf.setLineWidth(0.15);
          pdf.line(left, y + 6, right, y + 6);

          y += 6;
        });
        y += 4;
      }

      // Footer disclaimer & page numbers on all pages (Pure Black)
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        pdf.line(left, 287, right, 287);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(0, 0, 0);
        pdf.text("Confidential · PT Andima Transportindo Sales Overview Report", left, 291);
        pdf.text(`Halaman ${p} dari ${totalPages}`, right, 291, { align: "right" });
      }

      // Save & trigger download
      pdf.save(`sales-overview-report-${startPeriod}-${endPeriod}.pdf`);
      onClose();
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Gagal mengekspor PDF. Silakan coba lagi.");
    } finally {
      setIsExporting(false);
    }
  };

  // ==========================================
  // 2. EXCEL EXPORT (Professional Styled Table)
  // ==========================================
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "PT Andima Transportindo";
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet("Sales Overview Report");

      // Title Block
      worksheet.mergeCells("A1:E1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "PT ANDIMA TRANSPORTINDO";
      titleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF0F172A" } };

      worksheet.mergeCells("A2:E2");
      const subTitleCell = worksheet.getCell("A2");
      subTitleCell.value = "SALES OVERVIEW REPORT";
      subTitleCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1E293B" } };

      worksheet.mergeCells("A3:E3");
      const metaCell = worksheet.getCell("A3");
      const todayStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      metaCell.value = `Periode Evaluasi: ${periodLabel(startPeriod)} - ${periodLabel(endPeriod)} | Tanggal Ekspor: ${todayStr}`;
      metaCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF64748B" } };

      let currentRow = 5;

      // Helper for styling table headers
      const styleHeaderRow = (rowNumber: number, colsCount: number) => {
        const row = worksheet.getRow(rowNumber);
        row.height = 24;
        for (let c = 1; c <= colsCount; c++) {
          const cell = row.getCell(c);
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1E293B" }, // Professional Navy/Slate
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FF0F172A" } },
            bottom: { style: "thin", color: { argb: "FF0F172A" } },
            left: { style: "thin", color: { argb: "FF0F172A" } },
            right: { style: "thin", color: { argb: "FF0F172A" } },
          };
          cell.alignment = { vertical: "middle" };
        }
      };

      // Helper for styling data rows
      const styleDataRow = (rowNumber: number, colsCount: number, isAlt: boolean = false) => {
        const row = worksheet.getRow(rowNumber);
        row.height = 20;
        for (let c = 1; c <= colsCount; c++) {
          const cell = row.getCell(c);
          cell.font = { name: "Calibri", size: 9.5 };
          if (isAlt) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          cell.alignment = { vertical: "middle" };
        }
      };

      // 1. Financial Metrics Summary
      if (anyCardsSelected && summary) {
        worksheet.getCell(`A${currentRow}`).value = "1. RINGKASAN METRIK FINANSIAL";
        worksheet.getCell(`A${currentRow}`).font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
        currentRow++;

        worksheet.getRow(currentRow).values = ["Komponen Metrik", "Nilai Nominal / Rasio", "Keterangan"];
        styleHeaderRow(currentRow, 3);
        currentRow++;

        const metricRows: Array<[string, number | string, string, string]> = [];
        if (selectedCards.salesProfit) {
          metricRows.push(["Sales Profit Period", summary.sales_profit ?? 0, '"Rp"#,##0', "Total Revenue - Cost"]);
        }
        if (selectedCards.cost) {
          metricRows.push(["Cost Requirement Period", summary.cost ?? 0, '"Rp"#,##0', "Total Biaya Operasional"]);
        }
        if (selectedCards.outstanding) {
          metricRows.push(["Outstanding Period", summary.total_outstanding ?? 0, '"Rp"#,##0', "Total Tagihan Belum Tertagih"]);
        }
        if (selectedCards.netMargin) {
          const ratio = summary.revenue ? summary.sales_profit / summary.revenue : 0;
          metricRows.push(["Net Margin Ratio", ratio, "0.0%", "Rasio Margin Penjualan"]);
        }

        metricRows.forEach(([label, val, fmt, note], idx) => {
          const row = worksheet.getRow(currentRow);
          row.getCell(1).value = label;
          row.getCell(2).value = val;
          row.getCell(2).numFmt = fmt;
          row.getCell(2).font = { name: "Calibri", size: 9.5, bold: true };
          row.getCell(3).value = note;
          styleDataRow(currentRow, 3, idx % 2 === 1);
          currentRow++;
        });
        currentRow += 2;
      }

      // 2. Monthly Financial Performance Trend
      if (includePerformanceTrend && filteredSeries.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = "2. TREN KINERJA FINANSIAL BULANAN";
        worksheet.getCell(`A${currentRow}`).font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
        currentRow++;

        worksheet.getRow(currentRow).values = ["Periode", "Revenue", "Cost", "Sales Profit", "Outstanding"];
        styleHeaderRow(currentRow, 5);
        currentRow++;

        filteredSeries.forEach((pt, idx) => {
          const row = worksheet.getRow(currentRow);
          row.getCell(1).value = periodLabel(pt.period_month);
          row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

          row.getCell(2).value = pt.revenue;
          row.getCell(2).numFmt = '"Rp"#,##0';

          row.getCell(3).value = pt.cost;
          row.getCell(3).numFmt = '"Rp"#,##0';

          row.getCell(4).value = pt.sales_profit;
          row.getCell(4).numFmt = '"Rp"#,##0';
          row.getCell(4).font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF1D4ED8" } };

          row.getCell(5).value = pt.total_outstanding;
          row.getCell(5).numFmt = '"Rp"#,##0';
          row.getCell(5).font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFB91C1C" } };

          styleDataRow(currentRow, 5, idx % 2 === 1);
          currentRow++;
        });
        currentRow += 2;
      }

      // 3. Overdue Alerts List (ALL DATA)
      if (includeAlerts && alerts.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = `3. DAFTAR PERINGATAN OVERDUE (> 30 HARI) - Total: ${alerts.length} Invoices`;
        worksheet.getCell(`A${currentRow}`).font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF991B1B" } };
        currentRow++;

        worksheet.getRow(currentRow).values = ["No. Invoice", "Nama Pelanggan", "Jatuh Tempo", "Overdue (Hari)", "Total Tagihan"];
        styleHeaderRow(currentRow, 5);
        currentRow++;

        alerts.forEach((alert, idx) => {
          const row = worksheet.getRow(currentRow);
          row.getCell(1).value = alert.id;
          row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

          row.getCell(2).value = alert.client;
          row.getCell(3).value = alert.due;
          row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

          row.getCell(4).value = `${alert.days} Hari`;
          row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
          row.getCell(4).font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFDC2626" } };

          row.getCell(5).value = alert.amount;
          row.getCell(5).numFmt = '"Rp"#,##0';
          row.getCell(5).font = { name: "Calibri", size: 9.5, bold: true };

          styleDataRow(currentRow, 5, idx % 2 === 1);
          currentRow++;
        });
        currentRow += 2;
      }

      // 4. Recent Documents (ALL DATA)
      if (includeDocuments && documents.length > 0) {
        worksheet.getCell(`A${currentRow}`).value = `4. RIWAYAT DOKUMEN UPLOAD TERAKHIR (${documents.length} Dokumen)`;
        worksheet.getCell(`A${currentRow}`).font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF0F172A" } };
        currentRow++;

        worksheet.getRow(currentRow).values = ["Nama File Dokumen", "Tipe Dokumen", "Waktu Upload", "Status Validasi"];
        styleHeaderRow(currentRow, 4);
        currentRow++;

        documents.forEach((doc, idx) => {
          const row = worksheet.getRow(currentRow);
          row.getCell(1).value = doc.file_name;
          row.getCell(2).value = doc.document_type.replace(/_/g, " ");
          row.getCell(3).value = doc.uploaded_at.slice(0, 10);
          row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

          row.getCell(4).value = doc.validation_status.toUpperCase();
          row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
          row.getCell(4).font = {
            name: "Calibri",
            size: 9.5,
            bold: true,
            color: { argb: doc.validation_status === "validated" ? "FF047857" : "FFB91C1C" },
          };

          styleDataRow(currentRow, 4, idx % 2 === 1);
          currentRow++;
        });
      }

      // Auto-fit Column Widths
      worksheet.getColumn(1).width = 30;
      worksheet.getColumn(2).width = 38;
      worksheet.getColumn(3).width = 24;
      worksheet.getColumn(4).width = 22;
      worksheet.getColumn(5).width = 26;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales-overview-report-${startPeriod}-${endPeriod}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Gagal mengekspor file Excel. Silakan coba lagi.");
    } finally {
      setIsExporting(false);
    }
  };

  // ==========================================
  // 3. CSV EXPORT (Structured Abstract Plain Text)
  // ==========================================
  const handleExportCsv = () => {
    setIsExporting(true);
    try {
      const lines: string[] = [];
      lines.push("PT ANDIMA TRANSPORTINDO");
      lines.push("SALES OVERVIEW REPORT");
      lines.push(`Periode: ${periodLabel(startPeriod)} - ${periodLabel(endPeriod)}`);
      lines.push(`Tanggal Ekspor: ${new Date().toLocaleDateString("id-ID")}`);
      lines.push("");

      if (anyCardsSelected && summary) {
        lines.push("=== 1. RINGKASAN METRIK FINANSIAL ===");
        lines.push("Komponen Metrik,Nilai,Keterangan");
        if (selectedCards.salesProfit) {
          lines.push(`Sales Profit Period,${summary.sales_profit ?? 0},Total Revenue - Cost`);
        }
        if (selectedCards.cost) {
          lines.push(`Cost Requirement Period,${summary.cost ?? 0},Total Biaya Operasional`);
        }
        if (selectedCards.outstanding) {
          lines.push(`Outstanding Period,${summary.total_outstanding ?? 0},Total Tagihan Belum Tertagih`);
        }
        if (selectedCards.netMargin) {
          const ratio = summary.revenue ? `${((summary.sales_profit / summary.revenue) * 100).toFixed(1)}%` : "0.0%";
          lines.push(`Net Margin Ratio,${ratio},Rasio Margin Penjualan`);
        }
        lines.push("");
      }

      if (includePerformanceTrend && filteredSeries.length > 0) {
        lines.push("=== 2. TREN KINERJA FINANSIAL BULANAN ===");
        lines.push("Periode,Revenue,Cost,Sales Profit,Outstanding");
        filteredSeries.forEach((pt) => {
          lines.push(`"${periodLabel(pt.period_month)}",${pt.revenue},${pt.cost},${pt.sales_profit},${pt.total_outstanding}`);
        });
        lines.push("");
      }

      if (includeAlerts && alerts.length > 0) {
        lines.push(`=== 3. DAFTAR PERINGATAN OVERDUE (> 30 HARI) (${alerts.length} Invoices) ===`);
        lines.push("No. Invoice,Nama Pelanggan,Jatuh Tempo,Overdue (Hari),Total Tagihan");
        alerts.forEach((a) => {
          const cleanClient = (a.client || "").replace(/"/g, '""');
          lines.push(`"${a.id}","${cleanClient}","${a.due}",${a.days},${a.amount}`);
        });
        lines.push("");
      }

      if (includeDocuments && documents.length > 0) {
        lines.push(`=== 4. RIWAYAT DOKUMEN UPLOAD TERAKHIR (${documents.length} Dokumen) ===`);
        lines.push("Nama File Dokumen,Tipe Dokumen,Waktu Upload,Status Validasi");
        documents.forEach((d) => {
          const cleanName = d.file_name.replace(/"/g, '""');
          lines.push(`"${cleanName}","${d.document_type}","${d.uploaded_at.slice(0, 10)}","${d.validation_status}"`);
        });
      }

      const csvContent = lines.join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales-overview-report-${startPeriod}-${endPeriod}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error("CSV export failed:", err);
      alert("Gagal mengekspor file CSV. Silakan coba lagi.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = () => {
    if (exportFormat === "PDF") return handleExportPdf();
    if (exportFormat === "XLSX") return handleExportExcel();
    if (exportFormat === "CSV") return handleExportCsv();
  };

  // ==========================================
  // PREVIEW RENDERERS
  // ==========================================
  const renderFullHeader = () => (
    <div className="border-b-2 border-slate-900 pb-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-extrabold text-slate-950 tracking-wide font-heading">
            PT ANDIMA TRANSPORTINDO
          </h1>
          <p className="text-[11px] font-bold text-slate-900 uppercase tracking-tight mt-0.5">
            Sales Overview Report
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-500">
          <p>Format: {exportFormat} Document</p>
          <p>{new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
        <span>Periode Evaluasi: <strong>{periodLabel(startPeriod)} - {periodLabel(endPeriod)}</strong></span>
        <span>PT Andima Transportindo Internal Report</span>
      </div>
    </div>
  );

  const renderContinuationHeader = (pageNum: number) => (
    <div className="border-b border-slate-900 pb-2.5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-extrabold text-slate-950 tracking-wide font-heading">
            PT ANDIMA TRANSPORTINDO
          </h2>
          <p className="text-[10px] font-bold text-slate-800 uppercase tracking-tight">
            Sales Overview Report (Lanjutan)
          </p>
        </div>
        <div className="text-right text-[9.5px] text-slate-600">
          <span>Periode: <strong>{periodLabel(startPeriod)} - {periodLabel(endPeriod)}</strong></span>
        </div>
      </div>
    </div>
  );

  const renderPageFooter = (pageNum: number, totalPages: number) => (
    <div className="border-t border-slate-300 pt-3 text-[9px] text-slate-500 flex justify-between items-center mt-6">
      <span>Confidential · PT Andima Transportindo Sales Overview Report</span>
      <span className="font-semibold text-slate-700">
        Halaman {pageNum} dari {totalPages}
      </span>
    </div>
  );

  const renderCardsSection = () => {
    if (!anyCardsSelected || !summary) return null;
    return (
      <div className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
          1. Ringkasan Metrik Finansial
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {selectedCards.salesProfit && (
            <div className="rounded border border-slate-300 bg-white p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-600">Sales Profit Period</p>
              <p className="text-xs font-extrabold text-slate-950 mt-0.5">{money.format(summary.sales_profit ?? 0)}</p>
              <p className="text-[9px] text-slate-500">Total Revenue - Cost</p>
            </div>
          )}
          {selectedCards.cost && (
            <div className="rounded border border-slate-300 bg-white p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-600">Cost Requirement Period</p>
              <p className="text-xs font-extrabold text-slate-950 mt-0.5">{money.format(summary.cost ?? 0)}</p>
              <p className="text-[9px] text-slate-500">Total Biaya Operasional</p>
            </div>
          )}
          {selectedCards.outstanding && (
            <div className="rounded border border-slate-300 bg-white p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-600">Outstanding Period</p>
              <p className="text-xs font-extrabold text-slate-950 mt-0.5">{money.format(summary.total_outstanding ?? 0)}</p>
              <p className="text-[9px] text-slate-500">Tagihan Belum Lunas</p>
            </div>
          )}
          {selectedCards.netMargin && (
            <div className="rounded border border-slate-300 bg-white p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-600">Net Margin Ratio</p>
              <p className="text-xs font-extrabold text-slate-950 mt-0.5">
                {summary.revenue ? `${((summary.sales_profit / summary.revenue) * 100).toFixed(1)}%` : "-"}
              </p>
              <p className="text-[9px] text-slate-500">Rasio Margin Penjualan</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderChartsSection = () => {
    if (!includePerformanceTrend || filteredSeries.length === 0) return null;
    return (
      <div className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
          2. Tren Kinerja Finansial Bulanan
        </h2>
        <div className="overflow-x-auto rounded border border-slate-300">
          <table className="w-full text-left text-[10px]">
            <thead className="border-b-2 border-slate-900 bg-white text-slate-900 font-bold">
              <tr>
                <th className="px-2 py-1.5">Periode</th>
                <th className="px-2 py-1.5 text-right">Revenue</th>
                <th className="px-2 py-1.5 text-right">Cost</th>
                <th className="px-2 py-1.5 text-right">Sales Profit</th>
                <th className="px-2 py-1.5 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSeries.map((row) => (
                <tr key={row.period_month} className="bg-white">
                  <td className="px-2 py-1 font-semibold">{periodLabel(row.period_month)}</td>
                  <td className="px-2 py-1 text-right">{money.format(row.revenue)}</td>
                  <td className="px-2 py-1 text-right">{money.format(row.cost)}</td>
                  <td className="px-2 py-1 text-right font-bold text-slate-950">{money.format(row.sales_profit)}</td>
                  <td className="px-2 py-1 text-right font-semibold text-slate-950">{money.format(row.total_outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAlertsSection = () => {
    if (!includeAlerts || alerts.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
            3. Daftar Peringatan Overdue (&gt; 30 Hari)
          </h2>
          <span className="text-[10px] text-slate-700 font-semibold">{alerts.length} Invoices</span>
        </div>
        <div className="overflow-x-auto rounded border border-slate-300">
          <table className="w-full text-left text-[9.5px]">
            <thead className="border-b-2 border-slate-900 bg-white text-slate-900 font-bold">
              <tr>
                <th className="px-2 py-1.5">Invoice</th>
                <th className="px-2 py-1.5">Pelanggan</th>
                <th className="px-2 py-1.5 text-center">Jatuh Tempo</th>
                <th className="px-2 py-1.5 text-center">Overdue</th>
                <th className="px-2 py-1.5 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {alerts.slice(0, 5).map((a) => (
                <tr key={a.id} className="bg-white">
                  <td className="px-2 py-1 font-mono font-bold text-slate-950">{a.id}</td>
                  <td className="px-2 py-1 max-w-[140px] truncate">{a.client}</td>
                  <td className="px-2 py-1 text-center text-slate-700">{a.due}</td>
                  <td className="px-2 py-1 text-center font-bold text-slate-950">{a.days} Hari</td>
                  <td className="px-2 py-1 text-right font-semibold text-slate-950">{money.format(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {alerts.length > 5 && (
          <p className="text-[9px] text-slate-500 italic">
            + {alerts.length - 5} invoice overdue lainnya akan dicantumkan lengkap pada file hasil export.
          </p>
        )}
      </div>
    );
  };

  const renderDocumentsSection = () => {
    if (!includeDocuments || documents.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
            4. Riwayat Dokumen Upload Terakhir
          </h2>
          <span className="text-[10px] text-slate-700 font-semibold">{documents.length} Dokumen</span>
        </div>
        <div className="overflow-x-auto rounded border border-slate-300">
          <table className="w-full text-left text-[9.5px]">
            <thead className="border-b-2 border-slate-900 bg-white text-slate-900 font-bold">
              <tr>
                <th className="px-2 py-1.5">Nama Dokumen</th>
                <th className="px-2 py-1.5">Tipe</th>
                <th className="px-2 py-1.5 text-center">Waktu Upload</th>
                <th className="px-2 py-1.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {documents.slice(0, 4).map((d) => (
                <tr key={d.id} className="bg-white">
                  <td className="px-2 py-1 font-semibold max-w-[150px] truncate text-slate-950">{d.file_name}</td>
                  <td className="px-2 py-1 text-slate-700">{d.document_type.replace(/_/g, " ")}</td>
                  <td className="px-2 py-1 text-center text-slate-700">{d.uploaded_at.slice(0, 10)}</td>
                  <td className="px-2 py-1 text-center font-bold text-slate-950">
                    {d.validation_status.toUpperCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 md:p-6 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="flex h-[92vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              {exportFormat === "PDF" ? (
                <FileText className="size-5 text-rose-600" />
              ) : exportFormat === "XLSX" ? (
                <FileSpreadsheet className="size-5 text-emerald-600" />
              ) : (
                <Table className="size-5 text-indigo-600" />
              )}
            </span>
            <div>
              <h2 id="export-modal-title" className="text-base font-bold text-slate-900 font-heading">
                Sales Overview Export
              </h2>
              <p className="text-xs text-slate-500">
                Periode: <strong className="text-slate-700">{periodLabel(startPeriod)} - {periodLabel(endPeriod)}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Modal Body: 2 Columns */}
        <div className="grid flex-1 grid-cols-1 md:grid-cols-[360px_1fr] overflow-hidden">
          {/* Left Column: Checklist & Configuration */}
          <aside className="border-r border-slate-200 bg-slate-50 p-5 overflow-y-auto space-y-5">
            {/* Format File Output Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 font-heading">
                Format File Output
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setExportFormat("PDF")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition cursor-pointer ${
                    exportFormat === "PDF"
                      ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/20 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <FileText className="size-3.5 text-rose-600" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("XLSX")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition cursor-pointer ${
                    exportFormat === "XLSX"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-600/20 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-600" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("CSV")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition cursor-pointer ${
                    exportFormat === "CSV"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600/20 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Table className="size-3.5 text-indigo-600" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {/* Master Select All / Deselect All */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-heading">
                  Pilih Konten Laporan
                </h3>
                <p className="text-[11px] text-slate-500">{selectedCount} dari {totalSelectableCount} elemen dipilih</p>
              </div>
              <label
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-xs select-none ${
                  isAllSelected
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : isPartiallySelected
                    ? "bg-blue-600/90 text-white hover:bg-blue-700"
                    : "border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isPartiallySelected && !isAllSelected;
                  }}
                  onChange={toggleMasterSelectAll}
                  className="size-4 rounded accent-blue-600 cursor-pointer"
                />
                <span>Pilih Semua</span>
              </label>
            </div>

            {/* 1. Metric Cards Group */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allCardsChecked}
                    onChange={toggleAllCards}
                    className="size-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <span>1. Metric Cards</span>
                </label>
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  {Object.values(selectedCards).filter(Boolean).length}/4
                </span>
              </div>
              <div className="space-y-2 pl-5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCards.salesProfit}
                    onChange={(e) => setSelectedCards({ ...selectedCards, salesProfit: e.target.checked })}
                    className="size-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span>Sales Profit Period</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCards.cost}
                    onChange={(e) => setSelectedCards({ ...selectedCards, cost: e.target.checked })}
                    className="size-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span>Cost Requirement Period</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCards.outstanding}
                    onChange={(e) => setSelectedCards({ ...selectedCards, outstanding: e.target.checked })}
                    className="size-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span>Outstanding Period</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCards.netMargin}
                    onChange={(e) => setSelectedCards({ ...selectedCards, netMargin: e.target.checked })}
                    className="size-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span>Net Margin Ratio</span>
                </label>
              </div>
            </div>

            {/* 2. Monthly Financial Performance Trend (Single Unified Item) */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <label className="flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={includePerformanceTrend}
                    onChange={(e) => setIncludePerformanceTrend(e.target.checked)}
                    className="mt-0.5 size-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-900">2. Monthly Financial Performance</span>
                    <p className="text-[10px] font-normal text-slate-500 mt-0.5">
                      Tabel tren bulanan Revenue, Cost, Profit &amp; Outstanding
                    </p>
                  </div>
                </div>
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  {filteredSeries.length} Bulan
                </span>
              </label>
            </div>

            {/* 3. Overdue Alerts List */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <label className="flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeAlerts}
                    onChange={(e) => setIncludeAlerts(e.target.checked)}
                    className="size-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <span>3. Overdue Alerts List</span>
                </div>
                <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                  {alerts.length} Invoices
                </span>
              </label>
            </div>

            {/* 4. Recent Documents */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <label className="flex items-center justify-between text-xs font-bold text-slate-900 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeDocuments}
                    onChange={(e) => setIncludeDocuments(e.target.checked)}
                    className="size-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <span>4. Recent Documents</span>
                </div>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  {documents.length} Files
                </span>
              </label>
            </div>
          </aside>

          {/* Right Column: Live Document Preview */}
          <section className="flex flex-col items-center bg-slate-200/70 p-4 md:p-8 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between w-full max-w-[620px] text-xs text-slate-500 font-medium">
              <span>
                Preview Dokumen Laporan ({exportFormat}){" "}
                <strong className="text-slate-700">
                  {exportFormat === "PDF" && `(${selectedCount === 0 ? "1" : previewPages.length} Halaman)`}
                </strong>
              </span>
              <span className="text-[11px] text-slate-600 font-semibold">
                {periodLabel(startPeriod)} - {periodLabel(endPeriod)}
              </span>
            </div>

            {selectedCount === 0 || previewPages.length === 0 ? (
              <article className="w-full max-w-[620px] min-h-[840px] rounded-sm border border-slate-300 bg-white p-7 text-slate-900 shadow-xl flex flex-col justify-between text-xs font-sans">
                <div>
                  {renderFullHeader()}
                  <div className="py-28 text-center text-slate-400">
                    <Square className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold">Belum ada konten yang dipilih.</p>
                    <p className="text-[11px]">Centang komponen pada menu sebelah kiri untuk memunculkannya di laporan.</p>
                  </div>
                </div>
                {renderPageFooter(1, 1)}
              </article>
            ) : (
              previewPages.map((pageSections, pageIdx) => (
                <article
                  key={pageIdx}
                  className="w-full max-w-[620px] min-h-[840px] rounded-sm border border-slate-300 bg-white p-7 text-slate-900 shadow-xl flex flex-col justify-between text-xs font-sans mb-6 last:mb-0 transition-all"
                >
                  <div className="space-y-5">
                    {pageIdx === 0 ? renderFullHeader() : renderContinuationHeader(pageIdx + 1)}
                    {pageSections.map((sec) => (
                      <React.Fragment key={sec}>
                        {sec === "cards" && renderCardsSection()}
                        {sec === "charts" && renderChartsSection()}
                        {sec === "alerts" && renderAlertsSection()}
                        {sec === "documents" && renderDocumentsSection()}
                      </React.Fragment>
                    ))}
                  </div>
                  {renderPageFooter(pageIdx + 1, previewPages.length)}
                </article>
              ))
            )}
          </section>
        </div>

        {/* Modal Footer Actions */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <p className="text-xs text-slate-600">
            {selectedCount === 0 ? (
              <span className="text-amber-700 font-semibold">Pilih minimal 1 komponen untuk diekspor.</span>
            ) : (
              <span>
                Siap mengekspor <strong className="text-slate-900">{selectedCount} bagian terpilih</strong> ke file{" "}
                <strong className="text-blue-700">
                  {exportFormat === "PDF" ? "PDF (.pdf)" : exportFormat === "XLSX" ? "Excel (.xlsx)" : "CSV (.csv)"}
                </strong>
                .
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedCount === 0}
              className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition cursor-pointer ${
                exportFormat === "PDF"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : exportFormat === "XLSX"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              <Download className="size-4" />
              {isExporting
                ? `Membuat ${exportFormat}...`
                : exportFormat === "PDF"
                ? "Export PDF"
                : exportFormat === "XLSX"
                ? "Export Excel (.xlsx)"
                : "Export CSV (.csv)"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
