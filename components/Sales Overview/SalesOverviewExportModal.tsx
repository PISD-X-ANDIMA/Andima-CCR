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
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import type { AlertRow, MacroPoint, MacroSummary, RecentDocument } from "./SalesOverview";

interface SalesOverviewExportModalProps {
  open: boolean;
  onClose: () => void;
  summary: MacroSummary;
  series: MacroPoint[];
  startPeriod: string;
  endPeriod: string;
  alerts?: AlertRow[];
  documents?: RecentDocument[];
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
}: SalesOverviewExportModalProps) {
  // Checklist states
  const [selectedCards, setSelectedCards] = useState({
    salesProfit: true,
    cost: true,
    outstanding: true,
    netMargin: true,
  });

  const [selectedCharts, setSelectedCharts] = useState({
    trend: true,
    revenue: true,
    cost: true,
    outstanding: true,
  });

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
  const allChartsChecked = Object.values(selectedCharts).every(Boolean);

  const toggleAllCards = () => {
    const nextState = !allCardsChecked;
    setSelectedCards({
      salesProfit: nextState,
      cost: nextState,
      outstanding: nextState,
      netMargin: nextState,
    });
  };

  const toggleAllCharts = () => {
    const nextState = !allChartsChecked;
    setSelectedCharts({
      trend: nextState,
      revenue: nextState,
      cost: nextState,
      outstanding: nextState,
    });
  };

  const selectAllEverything = () => {
    setSelectedCards({ salesProfit: true, cost: true, outstanding: true, netMargin: true });
    setSelectedCharts({ trend: true, revenue: true, cost: true, outstanding: true });
    setIncludeAlerts(true);
    setIncludeDocuments(true);
  };

  const deselectAllEverything = () => {
    setSelectedCards({ salesProfit: false, cost: false, outstanding: false, netMargin: false });
    setSelectedCharts({ trend: false, revenue: false, cost: false, outstanding: false });
    setIncludeAlerts(false);
    setIncludeDocuments(false);
  };

  const totalSelectableCount = 10;
  const selectedCount =
    Object.values(selectedCards).filter(Boolean).length +
    Object.values(selectedCharts).filter(Boolean).length +
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
  const anyChartsSelected = Object.values(selectedCharts).some(Boolean);

  type PreviewSectionKey = "cards" | "charts" | "alerts" | "documents";

  const previewPages = useMemo(() => {
    const active: PreviewSectionKey[] = [];
    if (anyCardsSelected && summary) active.push("cards");
    if (anyChartsSelected && filteredSeries.length > 0) active.push("charts");
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
  }, [anyCardsSelected, summary, anyChartsSelected, filteredSeries, includeAlerts, alerts, includeDocuments, documents]);

  // PDF Export Execution using jsPDF
  const handleExportPdf = () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const left = 14;
      const right = 196;
      const pageWidth = 210;
      let y = 16;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > 275) {
          pdf.addPage();
          y = 16;
          // Add mini running header on continuation pages
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(140, 150, 160);
          pdf.text("PT ANDIMA TRANSPORTINDO - SALES OVERVIEW REPORT", left, y);
          pdf.text(`${periodLabel(startPeriod)} - ${periodLabel(endPeriod)}`, right, y, { align: "right" });
          pdf.setDrawColor(220, 225, 230);
          pdf.line(left, y + 2, right, y + 2);
          y += 8;
        }
      };

      // Header Banner
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(26, 54, 93); // Dark Navy
      pdf.text("PT ANDIMA TRANSPORTINDO", left, y);

      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.setFont("helvetica", "normal");
      const todayStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      pdf.text(`Generated: ${todayStr}`, right, y, { align: "right" });
      y += 6;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.text("EXECUTIVE SALES & RECEIVABLES OVERVIEW REPORT", left, y);
      y += 5;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Periode Evaluasi: ${periodLabel(startPeriod)} - ${periodLabel(endPeriod)}`, left, y);
      y += 3;

      // Divider
      pdf.setDrawColor(37, 99, 235);
      pdf.setLineWidth(0.8);
      pdf.line(left, y, right, y);
      pdf.setLineWidth(0.2);
      y += 7;

      // 1. CARDS SECTION
      if (anyCardsSelected && summary) {
        checkPageBreak(38);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59);
        pdf.text("1. RINGKASAN METRIK FINANSIAL", left, y);
        y += 5;

        // Build list of active cards
        const cardItems = [];
        if (selectedCards.salesProfit) {
          cardItems.push({ label: "SALES PROFIT PERIOD", value: money.format(summary.sales_profit ?? 0), note: "Revenue - Cost" });
        }
        if (selectedCards.cost) {
          cardItems.push({ label: "COST REQUIREMENT PERIOD", value: money.format(summary.cost ?? 0), note: "Total Biaya Operasional" });
        }
        if (selectedCards.outstanding) {
          cardItems.push({ label: "OUTSTANDING PERIOD", value: money.format(summary.total_outstanding ?? 0), note: "Total Tagihan Belum Tertagih" });
        }
        if (selectedCards.netMargin) {
          const ratio = summary.revenue ? `${((summary.sales_profit / summary.revenue) * 100).toFixed(1)}%` : "-";
          cardItems.push({ label: "NET MARGIN RATIO", value: ratio, note: "Rasio Margin Periode" });
        }

        const cols = cardItems.length === 1 ? 1 : cardItems.length === 2 ? 2 : cardItems.length === 3 ? 3 : 2;
        const boxWidth = (right - left - (cols - 1) * 4) / cols;
        const boxHeight = 18;

        for (let i = 0; i < cardItems.length; i++) {
          const colIndex = i % cols;
          const rowIndex = Math.floor(i / cols);
          const bx = left + colIndex * (boxWidth + 4);
          const by = y + rowIndex * (boxHeight + 4);

          // Card Background & Border
          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(226, 232, 240);
          pdf.roundedRect(bx, by, boxWidth, boxHeight, 1.5, 1.5, "FD");

          // Label
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7);
          pdf.setTextColor(100, 116, 139);
          pdf.text(cardItems[i].label, bx + 3, by + 5);

          // Value
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(15, 23, 42);
          pdf.text(cardItems[i].value, bx + 3, by + 11);

          // Note
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(6.5);
          pdf.setTextColor(148, 163, 184);
          pdf.text(cardItems[i].note, bx + 3, by + 15);
        }

        const totalRows = Math.ceil(cardItems.length / cols);
        y += totalRows * (boxHeight + 4) + 4;
      }

      // 2. CHARTS / MONTHLY TREND DATA
      if (anyChartsSelected && filteredSeries.length > 0) {
        checkPageBreak(40);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59);
        pdf.text("2. TREN KINERJA PENJUALAN & BIAYA (BULANAN)", left, y);
        y += 5;

        // Table Header
        const tableCols: PdfColumnDef[] = [{ title: "Periode", width: 30, align: "left" }];
        if (selectedCharts.revenue || selectedCharts.trend) {
          tableCols.push({ title: "Revenue", width: 38, align: "right" });
        }
        if (selectedCharts.cost || selectedCharts.trend) {
          tableCols.push({ title: "Cost", width: 38, align: "right" });
        }
        if (selectedCharts.trend) {
          tableCols.push({ title: "Sales Profit", width: 38, align: "right" });
        }
        if (selectedCharts.outstanding || selectedCharts.trend) {
          tableCols.push({ title: "Outstanding", width: 38, align: "right" });
        }

        // Adjust column widths to fill table width exactly
        const totalDefinedWidth = tableCols.reduce((sum, c) => sum + c.width, 0);
        const scaleFactor = (right - left) / totalDefinedWidth;
        tableCols.forEach((c) => (c.width = c.width * scaleFactor));

        // Draw Table Header Row
        pdf.setFillColor(30, 41, 59);
        pdf.rect(left, y, right - left, 6.5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(255, 255, 255);

        let curX = left;
        for (const col of tableCols) {
          const tx = col.align === "right" ? curX + col.width - 2 : curX + 2;
          pdf.text(col.title, tx, y + 4.5, { align: col.align });
          curX += col.width;
        }
        y += 6.5;

        // Draw Data Rows
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);

        filteredSeries.forEach((pt, idx) => {
          checkPageBreak(6.5);
          if (idx % 2 === 1) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(left, y, right - left, 6, "F");
          }
          pdf.setTextColor(30, 41, 59);

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
          y += 6;
        });

        y += 4;
      }

      // 3. OVERDUE ALERTS SECTION
      if (includeAlerts && alerts.length > 0) {
        checkPageBreak(35);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59);
        pdf.text(`3. DAFTAR PERINGATAN OVERDUE (> 30 HARI) - Total: ${alerts.length} Invoices`, left, y);
        y += 5;

        const alertCols: PdfColumnDef[] = [
          { title: "No. Invoice", width: 32, align: "left" },
          { title: "Pelanggan", width: 60, align: "left" },
          { title: "Jatuh Tempo", width: 24, align: "center" },
          { title: "Overdue", width: 20, align: "center" },
          { title: "Total Tagihan", width: 46, align: "right" },
        ];

        // Header
        pdf.setFillColor(220, 38, 38); // Amber/Red banner for alerts
        pdf.rect(left, y, right - left, 6.5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(255, 255, 255);

        let curX = left;
        for (const col of alertCols) {
          const tx = col.align === "right" ? curX + col.width - 2 : col.align === "center" ? curX + col.width / 2 : curX + 2;
          pdf.text(col.title, tx, y + 4.5, { align: col.align });
          curX += col.width;
        }
        y += 6.5;

        // Rows
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);

        alerts.slice(0, 15).forEach((alert, idx) => {
          checkPageBreak(6.5);
          if (idx % 2 === 1) {
            pdf.setFillColor(254, 242, 242);
            pdf.rect(left, y, right - left, 6, "F");
          }
          pdf.setTextColor(15, 23, 42);

          let rowX = left;
          alertCols.forEach((col) => {
            let val = "";
            if (col.title === "No. Invoice") val = alert.id;
            else if (col.title === "Pelanggan") val = (alert.client || "").slice(0, 34);
            else if (col.title === "Jatuh Tempo") val = alert.due;
            else if (col.title === "Overdue") val = `${alert.days} Hari`;
            else if (col.title === "Total Tagihan") val = money.format(alert.amount);

            const tx = col.align === "right" ? rowX + col.width - 2 : col.align === "center" ? rowX + col.width / 2 : rowX + 2;
            pdf.text(val, tx, y + 4.2, { align: col.align });
            rowX += col.width;
          });
          y += 6;
        });

        if (alerts.length > 15) {
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(7);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`* Menampilkan 15 dari total ${alerts.length} invoice overdue terdaftar.`, left, y + 4);
          y += 7;
        } else {
          y += 3;
        }
      }

      // 4. RECENT DOCUMENTS SECTION
      if (includeDocuments && documents.length > 0) {
        checkPageBreak(35);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59);
        pdf.text(`4. RIWAYAT DOKUMEN UPLOAD TERAKHIR (${documents.length} Dokumen)`, left, y);
        y += 5;

        const docCols: PdfColumnDef[] = [
          { title: "Nama File Dokumen", width: 75, align: "left" },
          { title: "Tipe", width: 45, align: "left" },
          { title: "Waktu Upload", width: 32, align: "center" },
          { title: "Status", width: 30, align: "center" },
        ];

        // Header
        pdf.setFillColor(30, 41, 59);
        pdf.rect(left, y, right - left, 6.5, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(255, 255, 255);

        let curX = left;
        for (const col of docCols) {
          const tx = col.align === "right" ? curX + col.width - 2 : col.align === "center" ? curX + col.width / 2 : curX + 2;
          pdf.text(col.title, tx, y + 4.5, { align: col.align });
          curX += col.width;
        }
        y += 6.5;

        // Rows
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);

        documents.forEach((doc, idx) => {
          checkPageBreak(6.5);
          if (idx % 2 === 1) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(left, y, right - left, 6, "F");
          }
          pdf.setTextColor(15, 23, 42);

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
          y += 6;
        });
        y += 4;
      }

      // Footer disclaimer & page numbers on all pages
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setDrawColor(226, 232, 240);
        pdf.line(left, 287, right, 287);
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text("Confidential · PT Andima Transportindo CCR Internal Monitoring Report", left, 291);
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

  const renderFullHeader = () => (
    <div className="border-b-2 border-blue-600 pb-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-extrabold text-blue-900 tracking-wide font-heading">
            PT ANDIMA TRANSPORTINDO
          </h1>
          <p className="text-[11px] font-bold text-slate-800 uppercase tracking-tight mt-0.5">
            Executive Sales &amp; Receivables Overview Report
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-400">
          <p>Format: PDF Document</p>
          <p>{new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded border border-slate-100">
        <span>Periode: <strong>{periodLabel(startPeriod)} - {periodLabel(endPeriod)}</strong></span>
        <span>Divisi: <strong>Credit Control &amp; Receivables (CCR)</strong></span>
      </div>
    </div>
  );

  const renderContinuationHeader = (pageNum: number) => (
    <div className="border-b border-slate-200 pb-2.5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-extrabold text-blue-900 tracking-wide font-heading">
            PT ANDIMA TRANSPORTINDO
          </h2>
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">
            Executive Sales &amp; Receivables Overview Report (Lanjutan)
          </p>
        </div>
        <div className="text-right text-[9.5px] text-slate-500">
          <span>Periode: <strong>{periodLabel(startPeriod)} - {periodLabel(endPeriod)}</strong></span>
        </div>
      </div>
    </div>
  );

  const renderPageFooter = (pageNum: number, totalPages: number) => (
    <div className="border-t border-slate-200 pt-3 text-[9px] text-slate-400 flex justify-between items-center mt-6">
      <span>Confidential · PT Andima Transportindo CCR Internal Monitoring</span>
      <span className="font-semibold text-slate-500">
        Halaman {pageNum} dari {totalPages}
      </span>
    </div>
  );

  const renderCardsSection = () => {
    if (!anyCardsSelected || !summary) return null;
    return (
      <div className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1">
          1. Ringkasan Metrik Finansial
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {selectedCards.salesProfit && (
            <div className="rounded border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-500">Sales Profit Period</p>
              <p className="text-xs font-extrabold text-slate-900 mt-0.5">{money.format(summary.sales_profit ?? 0)}</p>
              <p className="text-[9px] text-slate-400">Total Revenue - Cost</p>
            </div>
          )}
          {selectedCards.cost && (
            <div className="rounded border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-500">Cost Requirement Period</p>
              <p className="text-xs font-extrabold text-slate-900 mt-0.5">{money.format(summary.cost ?? 0)}</p>
              <p className="text-[9px] text-slate-400">Total Biaya Operasional</p>
            </div>
          )}
          {selectedCards.outstanding && (
            <div className="rounded border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-500">Outstanding Period</p>
              <p className="text-xs font-extrabold text-slate-900 mt-0.5">{money.format(summary.total_outstanding ?? 0)}</p>
              <p className="text-[9px] text-slate-400">Tagihan Belum Lunas</p>
            </div>
          )}
          {selectedCards.netMargin && (
            <div className="rounded border border-slate-200 bg-slate-50/70 p-2.5">
              <p className="text-[9px] font-bold uppercase text-slate-500">Net Margin Ratio</p>
              <p className="text-xs font-extrabold text-slate-900 mt-0.5">
                {summary.revenue ? `${((summary.sales_profit / summary.revenue) * 100).toFixed(1)}%` : "-"}
              </p>
              <p className="text-[9px] text-slate-400">Rasio Margin Penjualan</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderChartsSection = () => {
    if (!anyChartsSelected || filteredSeries.length === 0) return null;
    return (
      <div className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-1">
          2. Tren Kinerja Finansial Bulanan
        </h2>
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-slate-800 text-white font-semibold">
              <tr>
                <th className="px-2 py-1.5">Bulan</th>
                {(selectedCharts.revenue || selectedCharts.trend) && <th className="px-2 py-1.5 text-right">Revenue</th>}
                {(selectedCharts.cost || selectedCharts.trend) && <th className="px-2 py-1.5 text-right">Cost</th>}
                {selectedCharts.trend && <th className="px-2 py-1.5 text-right">Sales Profit</th>}
                {(selectedCharts.outstanding || selectedCharts.trend) && <th className="px-2 py-1.5 text-right">Outstanding</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSeries.map((row, i) => (
                <tr key={row.period_month} className={i % 2 === 1 ? "bg-slate-50" : ""}>
                  <td className="px-2 py-1 font-semibold">{periodLabel(row.period_month)}</td>
                  {(selectedCharts.revenue || selectedCharts.trend) && (
                    <td className="px-2 py-1 text-right">{money.format(row.revenue)}</td>
                  )}
                  {(selectedCharts.cost || selectedCharts.trend) && (
                    <td className="px-2 py-1 text-right">{money.format(row.cost)}</td>
                  )}
                  {selectedCharts.trend && (
                    <td className="px-2 py-1 text-right font-bold text-blue-700">{money.format(row.sales_profit)}</td>
                  )}
                  {(selectedCharts.outstanding || selectedCharts.trend) && (
                    <td className="px-2 py-1 text-right text-rose-700">{money.format(row.total_outstanding)}</td>
                  )}
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
            3. Daftar Peringatan Overdue (&gt; 30 Hari)
          </h2>
          <span className="text-[10px] text-rose-700 font-semibold">{alerts.length} Invoices</span>
        </div>
        <div className="overflow-x-auto rounded border border-rose-200">
          <table className="w-full text-left text-[9.5px]">
            <thead className="bg-rose-600 text-white font-semibold">
              <tr>
                <th className="px-2 py-1.5">Invoice</th>
                <th className="px-2 py-1.5">Pelanggan</th>
                <th className="px-2 py-1.5 text-center">Jatuh Tempo</th>
                <th className="px-2 py-1.5 text-center">Overdue</th>
                <th className="px-2 py-1.5 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100">
              {alerts.slice(0, 5).map((a, i) => (
                <tr key={a.id} className={i % 2 === 1 ? "bg-rose-50/50" : ""}>
                  <td className="px-2 py-1 font-mono font-bold text-blue-700">{a.id}</td>
                  <td className="px-2 py-1 max-w-[140px] truncate">{a.client}</td>
                  <td className="px-2 py-1 text-center text-slate-600">{a.due}</td>
                  <td className="px-2 py-1 text-center font-bold text-rose-700">{a.days} Hari</td>
                  <td className="px-2 py-1 text-right font-semibold">{money.format(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {alerts.length > 5 && (
          <p className="text-[9px] text-slate-400 italic">
            + {alerts.length - 5} invoice overdue lainnya akan dicantumkan lengkap pada file PDF hasil export.
          </p>
        )}
      </div>
    );
  };

  const renderDocumentsSection = () => {
    if (!includeDocuments || documents.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
            4. Riwayat Dokumen Upload Terakhir
          </h2>
          <span className="text-[10px] text-slate-500">{documents.length} Dokumen</span>
        </div>
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-left text-[9.5px]">
            <thead className="bg-slate-700 text-white font-semibold">
              <tr>
                <th className="px-2 py-1.5">Nama Dokumen</th>
                <th className="px-2 py-1.5">Tipe</th>
                <th className="px-2 py-1.5 text-center">Waktu Upload</th>
                <th className="px-2 py-1.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.slice(0, 4).map((d, i) => (
                <tr key={d.id} className={i % 2 === 1 ? "bg-slate-50" : ""}>
                  <td className="px-2 py-1 font-semibold max-w-[150px] truncate">{d.file_name}</td>
                  <td className="px-2 py-1">{d.document_type.replace(/_/g, " ")}</td>
                  <td className="px-2 py-1 text-center text-slate-500">{d.uploaded_at.slice(0, 10)}</td>
                  <td className="px-2 py-1 text-center">
                    <span className="rounded bg-teal-100 px-1 py-0.5 text-[8.5px] font-bold text-teal-800">
                      {d.validation_status.toUpperCase()}
                    </span>
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
              <FileText className="size-5" />
            </span>
            <div>
              <h2 id="export-modal-title" className="text-base font-bold text-slate-900 font-heading">
                Export Dashboard Report (PDF)
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
            <div className="flex items-center justify-between gap-3">
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

            {/* 2. Charts Group */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allChartsChecked}
                    onChange={toggleAllCharts}
                    className="size-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <span>2. Performance Charts</span>
                </label>
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  {Object.values(selectedCharts).filter(Boolean).length}/4
                </span>
              </div>
              <div className="space-y-2 pl-5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCharts.trend}
                    onChange={(e) => setSelectedCharts({ ...selectedCharts, trend: e.target.checked })}
                    className="size-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span>Sales &amp; Cost Performance Trend</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCharts.revenue}
                    onChange={(e) => setSelectedCharts({ ...selectedCharts, revenue: e.target.checked })}
                    className="size-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span>Revenue Chart</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCharts.cost}
                    onChange={(e) => setSelectedCharts({ ...selectedCharts, cost: e.target.checked })}
                    className="size-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span>Cost Chart</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCharts.outstanding}
                    onChange={(e) => setSelectedCharts({ ...selectedCharts, outstanding: e.target.checked })}
                    className="size-3.5 accent-blue-600 cursor-pointer"
                  />
                  <span>Outstanding Chart</span>
                </label>
              </div>
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

          {/* Right Column: Live A4 Document Preview */}
          <section className="flex flex-col items-center bg-slate-200/70 p-4 md:p-8 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between w-full max-w-[620px] text-xs text-slate-500 font-medium">
              <span>
                Preview Lembar Laporan A4{" "}
                <strong className="text-slate-700">
                  ({selectedCount === 0 ? "1" : previewPages.length} Halaman)
                </strong>
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100/70 rounded px-2 py-0.5 font-semibold">
                <Check className="size-3.5" /> Live Preview Aktif
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
              <span>Siap mengekspor <strong className="text-slate-900">{selectedCount} bagian terpilih</strong> ke file PDF.</span>
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
              onClick={handleExportPdf}
              disabled={isExporting || selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              <Download className="size-4" />
              {isExporting ? "Membuat PDF..." : "Export PDF"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
