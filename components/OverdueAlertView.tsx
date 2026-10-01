"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import CustomDropdown from "@/components/CustomDropdown";
import Pagination from "@/components/Pagination";
import { OverdueInvoiceItem, OverdueKpiSummary } from "@/types/overdue";

interface OverdueAlertViewProps {
  onOpenWarningLetter: (item: OverdueInvoiceItem) => void;
}

export const OverdueAlertView: React.FC<OverdueAlertViewProps> = ({ onOpenWarningLetter }) => {
  // Data states
  const [invoices, setInvoices] = useState<OverdueInvoiceItem[]>([]);
  const [kpiSummary, setKpiSummary] = useState<OverdueKpiSummary | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<OverdueInvoiceItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("Semua Cabang");
  const [agingBucket, setAgingBucket] = useState<string>("Semua Bucket");
  const [selectedStatus, setSelectedStatus] = useState<string>("Semua Status");
  const [onlyOverdue30, setOnlyOverdue30] = useState<boolean>(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Selected row checkboxes
  const [checkedIds, setCheckedIds] = useState<string[]>(["inv-8841"]);

  // Assignment Modal State
  const [assignModalInvoice, setAssignModalInvoice] = useState<OverdueInvoiceItem | null>(null);
  const [assignTargetPic, setAssignTargetPic] = useState<string>("Hendra K.");

  // Notification message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const loadOverdueData = () => {
    setLoading(true);
    const params = new URLSearchParams({
      branch: selectedBranch,
      search: searchQuery,
      status: selectedStatus,
      agingBucket: agingBucket,
      onlyOverdue30: onlyOverdue30 ? "true" : "false",
    });

    fetch(`/api/v1/overdue-alerts?${params.toString()}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.invoices) {
          setInvoices(resData.invoices);
          setKpiSummary(resData.kpiSummary);
          if (resData.invoices.length > 0 && !selectedInvoice) {
            setSelectedInvoice(resData.invoices[0]);
          }
        }
      })
      .catch((err) => console.error("Error loading overdue alerts:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOverdueData();
  }, [selectedBranch, searchQuery, selectedStatus, agingBucket, onlyOverdue30]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleBatchEscalation = () => {
    fetch("/api/v1/overdue-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "BATCH_MID_ESCALATION",
        invoiceIds: checkedIds,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        showToast(data.message || "Eskalasi Otomatis Batch berhasil diproses!");
        loadOverdueData();
      });
  };

  const handleExportReport = () => {
    fetch("/api/v1/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "XLSX",
        requestedBy: "Hendra Kusuma",
        periodFilter: { branch: selectedBranch, agingBucket },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        showToast("Laporan Ekspor (.XLSX) berhasil dibuat & diunduh!");
      });
  };

  const handleAssignPicSubmit = () => {
    if (!assignModalInvoice) return;
    fetch("/api/v1/overdue-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ASSIGN_PIC",
        invoiceId: assignModalInvoice.id,
        assignedTo: assignTargetPic,
        assignedBy: "Hendra Kusuma",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        showToast(data.message || `PIC ${assignTargetPic} berhasil ditugaskan!`);
        setAssignModalInvoice(null);
        loadOverdueData();
      });
  };

  const totalPages = Math.ceil(invoices.length / itemsPerPage) || 1;
  const paginatedInvoices = invoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-12">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#0F172A] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 animate-bounce">
          <span className="text-emerald-400 font-bold">✓</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <Sidebar />

      {/* Main Container with Sidebar Offset */}
      <div className="flex flex-col min-h-screen transition-all duration-300 lg:pl-[260px]">
        {/* Top Header with Search Bar on Right */}
        <Header
          searchValue={searchQuery}
          onSearchChange={(val: string) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
        />

        <main className="flex-1 p-6 md:p-8 space-y-6 w-full">
          {/* Page Header & Subheader Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                CCR: OVERDUE ALERTS &amp; RECEIVABLES MONITORING
              </h1>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={loadOverdueData}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>⚡ Sinkronisasi Billing</span>
              </button>

              <button
                onClick={handleBatchEscalation}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-extrabold text-xs rounded-xl shadow-xs transition"
              >
                <span>⚡ Eskalasi Otomatis (Batch)</span>
              </button>

              <button
                onClick={handleExportReport}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Ekspor Laporan (.XLSX / .PDF)</span>
              </button>
            </div>
          </div>

          {/* 4 KPI Summary Cards Row */}
          {kpiSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Overdue Value */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">TOTAL OVERDUE VALUE</span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-extrabold uppercase">
                    🚨 URGENT
                  </span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {formatRupiah(kpiSummary.totalOverdueValue)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-rose-600 font-extrabold">↑ +{kpiSummary.totalOverdueValueGrowth}% vs bulan lalu</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Faktur Terdampak</span>
                  <span className="font-extrabold text-slate-800">{kpiSummary.affectedInvoicesCount} Faktur Terbuka</span>
                </div>
              </div>

              {/* Card 2: Aging Kritis */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">AGING KRITIS (&gt;60 HARI)</span>
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs">!</span>
                </div>
                <div className="text-xl font-extrabold text-rose-600">
                  {formatRupiah(kpiSummary.criticalAgingValue)}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-rose-600 font-extrabold">{kpiSummary.criticalAgingPercent}% dari portofolio macet</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Akun Terisolasi</span>
                  <span className="font-extrabold text-slate-800">{kpiSummary.criticalDebtorsCount} Debitur Macet</span>
                </div>
              </div>

              {/* Card 3: Rata-Rata DSO Delay */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">RATA-RATA DSO DELAY</span>
                  <span className="p-1 text-slate-400">⏱️</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {kpiSummary.avgDsoDelay} Hari
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-amber-600 font-bold">+{kpiSummary.slaDiff} Hari di atas batas SLA (30d)</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Target Recovery</span>
                  <span className="font-extrabold text-emerald-600">≤ {kpiSummary.targetRecoveryDays} Hari Operasional</span>
                </div>
              </div>

              {/* Card 4: Unassigned PIC Penagih */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">UNASSIGNED PIC PENAGIH</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping"></span>
                </div>
                <div className="text-xl font-extrabold text-blue-700">
                  {kpiSummary.unassignedPicCount} Faktur
                </div>
                <div className="mt-1 text-[11px] font-bold text-rose-600">
                  Tindakan Diperlukan Segera
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Nilai Mengambang</span>
                  <span className="font-extrabold text-slate-900">{formatRupiah(kpiSummary.unassignedFloatingValue)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Search Box */}
              <div className="w-full lg:w-96 relative">
                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari No. Faktur, Nama Pelanggan, atau NPWP..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap justify-end">
                <div className="w-48">
                  <CustomDropdown
                    placeholder={agingBucket}
                    categoryTitle="AGING BUCKET"
                    items={[
                      { id: "all", label: "Semua Bucket" },
                      { id: "b1", label: "1 - 30 Hari" },
                      { id: "b2", label: "31 - 60 Hari" },
                      { id: "b3", label: "> 60 Hari" },
                    ]}
                    value={agingBucket}
                    onChange={(item) => setAgingBucket(item.label)}
                  />
                </div>

                <div className="w-48">
                  <CustomDropdown
                    placeholder={selectedStatus}
                    categoryTitle="STATUS RESIKO"
                    items={[
                      { id: "all", label: "Semua Status" },
                      { id: "legal", label: "LEGAL ESCALATION" },
                      { id: "high", label: "HIGH RISK" },
                      { id: "watch", label: "WATCHLIST" },
                      { id: "nego", label: "NEGOSIASI" },
                    ]}
                    value={selectedStatus}
                    onChange={(item) => setSelectedStatus(item.label)}
                  />
                </div>

                {/* Badge Toggle: Hanya >30 Hari */}
                <button
                  onClick={() => setOnlyOverdue30(!onlyOverdue30)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 ${
                    onlyOverdue30
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${onlyOverdue30 ? "bg-white text-blue-600" : "bg-slate-200"}`}>
                    ✓
                  </span>
                  <span>Hanya &gt;30 Hari</span>
                </button>
              </div>
            </div>

            {/* Branch Filter Tabs */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs">
              <span className="font-extrabold text-slate-400 uppercase tracking-wider mr-2 text-[10px]">
                CABANG:
              </span>
              {[
                { label: "Semua Cabang", count: 48 },
                { label: "Jakarta", count: 18 },
                { label: "Surabaya", count: 14 },
                { label: "Semarang", count: 7 },
                { label: "Balikpapan", count: 5 },
                { label: "Belawan", count: 4 },
              ].map((b) => {
                const isSelected = selectedBranch === b.label;
                return (
                  <button
                    key={b.label}
                    onClick={() => {
                      setSelectedBranch(b.label);
                      setCurrentPage(1);
                    }}
                    className={`px-3.5 py-1.5 rounded-full font-bold transition-all ${
                      isSelected
                        ? "bg-[#0F172A] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {b.label} ({b.count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split Table & Right Profile Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Table Section */}
            <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="font-extrabold text-slate-900 uppercase">
                  Daftar Faktur Tertunggak <span className="text-slate-400 font-semibold">({invoices.length} Faktur Terdaftar)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50">
                    ⚙️ Kolom
                  </button>
                  <button className="px-3 py-1 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50">
                    ⇅ Urutkan
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-extrabold text-[10px] tracking-wider uppercase">
                      <th className="w-10 px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={invoices.length > 0 && invoices.every((c) => checkedIds.includes(c.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCheckedIds(invoices.map((c) => c.id));
                            } else {
                              setCheckedIds([]);
                            }
                          }}
                          className="w-4 h-4 rounded accent-[#0F172A]"
                        />
                      </th>
                      <th className="px-4 py-3.5">NO. FAKTUR &amp; JATUH TEMPO</th>
                      <th className="px-4 py-3.5">PELANGGAN &amp; CABANG</th>
                      <th className="px-4 py-3.5 text-right">NOMINAL OVERDUE</th>
                      <th className="px-4 py-3.5 text-center">AGING DELAY</th>
                      <th className="px-4 py-3.5 text-center">STATUS RESIKO</th>
                      <th className="px-4 py-3.5">PIC PENAGIH</th>
                      <th className="px-4 py-3.5 text-center">AKSI</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                          Memuat data faktur tertunggak...
                        </td>
                      </tr>
                    ) : paginatedInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                          Tidak ada faktur tertunggak ditemukan.
                        </td>
                      </tr>
                    ) : (
                      paginatedInvoices.map((inv) => {
                        const isSelected = selectedInvoice?.id === inv.id;
                        const isChecked = checkedIds.includes(inv.id);

                        return (
                          <tr
                            key={inv.id}
                            onClick={() => setSelectedInvoice(inv)}
                            className={`transition-colors cursor-pointer ${
                              isSelected ? "bg-blue-50/70" : "hover:bg-slate-50/80"
                            }`}
                          >
                            <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setCheckedIds(checkedIds.filter((i) => i !== inv.id));
                                  } else {
                                    setCheckedIds([...checkedIds, inv.id]);
                                  }
                                }}
                                className="w-4 h-4 rounded accent-[#0F172A]"
                              />
                            </td>

                            <td className="px-4 py-4">
                              <div className="font-extrabold text-blue-700">{inv.invoice_number}</div>
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Tempo: <span className="font-bold text-slate-700">{inv.due_date}</span>
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="font-extrabold text-slate-900">{inv.customer_name}</div>
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                {inv.branch} ({inv.branch_code})
                              </div>
                            </td>

                            <td className="px-4 py-4 text-right">
                              <div className="font-extrabold text-slate-900">{formatRupiah(inv.amount_overdue)}</div>
                              {inv.payment_note && (
                                <div className="text-[10px] font-bold text-rose-600 mt-0.5">{inv.payment_note}</div>
                              )}
                            </td>

                            <td className="px-4 py-4 text-center">
                              <span className="px-2.5 py-1 rounded bg-rose-600 text-white font-extrabold text-xs">
                                {inv.days_overdue} Hari
                              </span>
                            </td>

                            <td className="px-4 py-4 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                inv.risk_status === "LEGAL ESCALATION"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : inv.risk_status === "HIGH RISK"
                                  ? "bg-orange-100 text-orange-800"
                                  : inv.risk_status === "WATCHLIST"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}>
                                • {inv.risk_status}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              {inv.pic_assigned ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                                    {inv.pic_initials || "PIC"}
                                  </span>
                                  <span className="font-bold text-slate-800 text-[11px]">{inv.pic_assigned}</span>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-bold text-[10px]">
                                  Unassigned
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                              {inv.action_type === "SP-2" ? (
                                <button
                                  onClick={() => onOpenWarningLetter(inv)}
                                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-lg shadow-xs transition"
                                >
                                  SP-2
                                </button>
                              ) : inv.action_type === "SP-1" ? (
                                <button
                                  onClick={() => onOpenWarningLetter(inv)}
                                  className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-lg shadow-xs transition"
                                >
                                  SP-1
                                </button>
                              ) : inv.action_type === "TUGASKAN" ? (
                                <button
                                  onClick={() => setAssignModalInvoice(inv)}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg shadow-xs transition"
                                >
                                  TUGASKAN
                                </button>
                              ) : (
                                <button
                                  onClick={() => onOpenWarningLetter(inv)}
                                  className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition"
                                >
                                  {inv.action_type}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with Pagination */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 font-medium">
                  Menampilkan <span className="font-bold text-slate-800">1 - {paginatedInvoices.length}</span> dari{" "}
                  <span className="font-bold text-slate-800">{invoices.length}</span> faktur tertunggak
                </div>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(p) => setCurrentPage(p)}
                />
              </div>
            </div>

            {/* Right Side Panel: Selected Overdue Inspection Panel */}
            {selectedInvoice && (
              <div className="xl:col-span-4 space-y-4">
                {/* Aging Distribution Breakdown Box */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 mb-2">
                    <span>AGING DISTRIBUTION BREAKDOWN</span>
                    <span className="text-blue-700 font-bold">100% Portofolio Overdue</span>
                  </div>

                  {/* Multi-colored Progress bar */}
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-3">
                    <div className="bg-blue-600 h-full" style={{ width: "35%" }} title="1 - 30d"></div>
                    <div className="bg-amber-500 h-full" style={{ width: "40%" }} title="31 - 60d"></div>
                    <div className="bg-rose-600 h-full" style={{ width: "25%" }} title="> 60d"></div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div>
                      <span className="block font-bold text-slate-400">1 - 30d</span>
                      <span className="block font-extrabold text-blue-600">35%</span>
                      <span className="text-slate-500">Rp 2.94M</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-400">31 - 60d</span>
                      <span className="block font-extrabold text-amber-600">40%</span>
                      <span className="text-slate-500">Rp 3.36M</span>
                    </div>
                    <div>
                      <span className="block font-bold text-slate-400">&gt; 60d</span>
                      <span className="block font-extrabold text-rose-600">25%</span>
                      <span className="text-slate-500">Rp 2.12M</span>
                    </div>
                  </div>
                </div>

                {/* Main Selected Escalation Box */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600">
                      <span>⚠️ ESKALASI TERPILIH (#1 PRIORITAS)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-extrabold text-[10px]">
                      AGING: {selectedInvoice.days_overdue} HARI
                    </span>
                  </div>

                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">{selectedInvoice.customer_name}</h2>
                    <div className="text-xs text-slate-500 font-semibold mt-0.5">
                      NPWP: {selectedInvoice.npwp}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">Total Tagihan Macet:</span>
                      <span className="text-base font-extrabold text-rose-600">{formatRupiah(selectedInvoice.amount_overdue)}</span>
                    </div>
                  </div>

                  {/* Contact Executive Card */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-sm">
                      BW
                    </div>
                    <div className="text-xs">
                      <div className="font-extrabold text-slate-900">{selectedInvoice.contact_person.name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {selectedInvoice.contact_person.role} • {selectedInvoice.contact_person.phone}
                      </div>
                    </div>
                  </div>

                  {/* Catatan Log Penagihan Terakhir */}
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between font-extrabold text-amber-900 text-[11px]">
                      <span>CATATAN LOG PENAGIHAN TERAKHIR:</span>
                      <span>{selectedInvoice.last_log.date}, {selectedInvoice.last_log.time}</span>
                    </div>
                    <p className="text-slate-700 text-[11px] leading-relaxed italic">
                      "{selectedInvoice.last_log.text}"
                    </p>
                    <div className="text-[10px] text-amber-700 font-bold">
                      Logged by PIC: {selectedInvoice.last_log.logged_by}
                    </div>
                  </div>

                  {/* Primary Action Buttons */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => onOpenWarningLetter(selectedInvoice)}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                    >
                      <span>✉️</span>
                      <span>KIRIM SURAT PERINGATAN (SP-2)</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button className="py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5">
                        <span>📞</span>
                        <span>HUBUNGI DEBITUR</span>
                      </button>

                      <button
                        onClick={() => setAssignModalInvoice(selectedInvoice)}
                        className="py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                      >
                        <span>👥</span>
                        <span>GANTI PIC</span>
                      </button>
                    </div>
                  </div>

                  {/* Log Aktivitas Penagihan Hari Ini Timeline */}
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-900">
                      <span>LOG AKTIVITAS PENAGIHAN HARI INI</span>
                      <span className="text-slate-400 font-mono">28-09-2026</span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-start gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0"></span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between font-bold text-slate-900 text-[11px]">
                            <span>Kunjungan Kantor (Surabaya)</span>
                            <span className="text-slate-400 font-mono text-[10px]">10:45 WIB</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            PIC Agus W. mendatangi kantor PT Tirta Mas Multimodal. Konfirmasi cek mundur tgl 05 Oktober.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0"></span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between font-bold text-slate-900 text-[11px]">
                            <span>Surat Peringatan 1 Terkirim</span>
                            <span className="text-slate-400 font-mono text-[10px]">09:15 WIB</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            SP-1 dikirimkan secara otomatis via e-faktur tercatat kepada CV Bintang Borneo Abadi.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between font-bold text-slate-900 text-[11px]">
                            <span>Validasi Rekonsiliasi Bank</span>
                            <span className="text-slate-400 font-mono text-[10px]">08:30 WIB</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Kasir pusat memvalidasi pembayaran parsial Rp 150,000,000 dari PT Samudera Biru Jaya.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button className="w-full text-center text-xs font-extrabold text-blue-600 hover:underline pt-1">
                      Lihat Riwayat Lengkap Audit Trail →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Vessel Hold Policy Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="px-3 py-1 rounded bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider">
                MULTIMODAL VESSEL HOLD POLICY
              </span>
              <h3 className="text-lg font-extrabold text-slate-900">
                Blokir Otomatis Bill of Lading (B/L) untuk Piutang Kritis
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Debitur dengan saldo jatuh tempo melebihi 60 hari secara sistematis akan ditahan izin pelepasan kargonya di pelabuhan muat (Tanjung Priok, Tanjung Perak, Belawan) sampai bilyet giro divalidasi.
              </p>
            </div>

            <div className="w-full md:w-80 h-32 rounded-xl overflow-hidden bg-slate-900 relative shrink-0">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-80"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=600&q=80')`,
                }}
              ></div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent flex items-end p-3 text-white text-[10px] font-bold">
                🚢 Terminal Pelabuhan Multimoda ANDIMA
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Assignment Modal */}
      {assignModalInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-slate-900">Penugasan PIC Penagih</h3>
              <button onClick={() => setAssignModalInvoice(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-600">
              <div>
                <span className="font-semibold text-slate-400 block">Faktur:</span>
                <span className="font-extrabold text-slate-900">{assignModalInvoice.invoice_number}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block">Pelanggan:</span>
                <span className="font-extrabold text-slate-900">{assignModalInvoice.customer_name}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-400 block">Nominal Overdue:</span>
                <span className="font-extrabold text-rose-600">{formatRupiah(assignModalInvoice.amount_overdue)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Pilih PIC Penagih:</label>
              <select
                value={assignTargetPic}
                onChange={(e) => setAssignTargetPic(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Hendra K.">Hendra Kusuma (Wilayah Jawa &amp; Kaltim)</option>
                <option value="Deni S.">Deni Setiawan (Wilayah JKT &amp; BPN)</option>
                <option value="Agus W.">Agus Wijaya (Wilayah SUB &amp; BLW)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setAssignModalInvoice(null)}
                className="w-1/2 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={handleAssignPicSubmit}
                className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition"
              >
                Simpan Penugasan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverdueAlertView;
