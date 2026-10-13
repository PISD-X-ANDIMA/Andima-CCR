"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  Check,
  ChevronRight,
  Download,
  FileWarning,
  History,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import CustomDropdown from "@/components/CustomDropdown";
import Pagination from "@/components/Pagination";
import { AssignmentRecord, OverdueInvoiceItem, OverdueKpiSummary } from "@/types/overdue";

interface OverdueAlertViewProps {
  onOpenWarningLetter: (item: OverdueInvoiceItem) => void;
}

const EMPTY_KPI: OverdueKpiSummary = {
  totalOverdueValue: 0,
  totalOverdueValueGrowth: 0,
  affectedInvoicesCount: 0,
  criticalAgingValue: 0,
  criticalAgingPercent: 0,
  criticalDebtorsCount: 0,
  avgDsoDelay: 0,
  slaDiff: 0,
  targetRecoveryDays: 0,
  unassignedPicCount: 0,
  unassignedFloatingValue: 0,
};

const PAGE_SIZE = 8;

function formatDate(value: string) {
  if (!value || value === "-") return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name?: string) {
  if (!name) return "-";
  const result = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return result || "-";
}

function riskClasses(status: string) {
  if (status === "LEGAL ESCALATION") return "border-red-200 bg-red-50 text-red-700";
  if (status === "HIGH RISK") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "WATCHLIST") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function agingClasses(days: number) {
  if (days > 60) return "bg-red-100 text-red-700";
  if (days > 30) return "bg-orange-50 text-orange-700";
  return "bg-blue-50 text-blue-700";
}

export const OverdueAlertView: React.FC<OverdueAlertViewProps> = ({ onOpenWarningLetter }) => {
  const [invoices, setInvoices] = useState<OverdueInvoiceItem[]>([]);
  const [kpiSummary, setKpiSummary] = useState<OverdueKpiSummary | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<OverdueInvoiceItem | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedBranch = "Semua Cabang";
  const [agingBucket, setAgingBucket] = useState("Semua Bucket");
  const [selectedStatus, setSelectedStatus] = useState("Semua Status");
  const [onlyOverdue30, setOnlyOverdue30] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [assignModalInvoice, setAssignModalInvoice] = useState<OverdueInvoiceItem | null>(null);
  const [assignTargetPic, setAssignTargetPic] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const formatRupiah = useCallback((value: number) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0), []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const loadOverdueData = useCallback(() => {
    setLoading(true);
    setErrorMessage(null);
    const params = new URLSearchParams({
      branch: selectedBranch,
      search: searchQuery,
      status: selectedStatus,
      agingBucket,
      onlyOverdue30: onlyOverdue30 ? "true" : "false",
    });

    fetch(`/api/v1/overdue?${params.toString()}`)
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then((result) => {
        if (!result.ok) throw new Error(result.body?.error?.message || "Gagal memuat overdue alert.");
        const nextInvoices = result.body.invoices ?? [];
        setInvoices(nextInvoices);
        setKpiSummary(result.body.kpiSummary ?? null);
        setSelectedInvoice((current) => nextInvoices.find((invoice: OverdueInvoiceItem) => invoice.id === current?.id) ?? nextInvoices[0] ?? null);
        setCurrentPage(1);
        setCheckedIds((current) => current.filter((id) => nextInvoices.some((invoice: OverdueInvoiceItem) => invoice.id === id)));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Gagal memuat overdue alert.";
        setErrorMessage(message);
        setInvoices([]);
        setKpiSummary(null);
        setSelectedInvoice(null);
        showToast(message);
      })
      .finally(() => setLoading(false));
  }, [agingBucket, onlyOverdue30, searchQuery, selectedBranch, selectedStatus, showToast]);

  useEffect(() => {
    loadOverdueData();
  }, [loadOverdueData]);

  const selectedInvoiceId = selectedInvoice?.id;
  useEffect(() => {
    if (!selectedInvoiceId) {
      setAssignmentHistory([]);
      return;
    }
    fetch(`/api/v1/overdue/${encodeURIComponent(selectedInvoiceId)}/assign`)
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then((result) => {
        if (!result.ok) throw new Error("Gagal memuat riwayat assignment.");
        setAssignmentHistory(result.body.data ?? []);
      })
      .catch(() => setAssignmentHistory([]));
  }, [selectedInvoiceId]);

  const handleEvaluate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/overdue/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Gagal mengevaluasi overdue.");
      showToast(`${body.overdue ?? 0} invoice overdue terdeteksi.`);
      loadOverdueData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Gagal mengevaluasi overdue.");
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const response = await fetch("/api/v1/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "XLSX", requestedBy: "Hendra Kusuma", periodFilter: { branch: selectedBranch, agingBucket } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Export gagal.");
      showToast("Laporan ekspor berhasil dibuat.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Export gagal.");
    }
  };

  const handleAssignPicSubmit = async () => {
    if (!assignModalInvoice || !assignTargetPic.trim()) {
      showToast("Nama PIC wajib diisi.");
      return;
    }
    try {
      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(assignModalInvoice.id)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: assignTargetPic.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || body?.error || "Assignment gagal.");
      showToast(`PIC ${assignTargetPic.trim()} berhasil ditugaskan.`);
      setAssignModalInvoice(null);
      setAssignTargetPic("");
      loadOverdueData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Assignment gagal.");
    }
  };

  const kpi = kpiSummary ?? EMPTY_KPI;
  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const paginatedInvoices = invoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const agingBuckets = useMemo(() => [
    { label: "1-30 hari", amount: invoices.filter((invoice) => invoice.days_overdue <= 30).reduce((sum, invoice) => sum + invoice.amount_overdue, 0), color: "bg-blue-500", text: "text-blue-600" },
    { label: "31-60 hari", amount: invoices.filter((invoice) => invoice.days_overdue > 30 && invoice.days_overdue <= 60).reduce((sum, invoice) => sum + invoice.amount_overdue, 0), color: "bg-amber-400", text: "text-amber-600" },
    { label: ">60 hari", amount: invoices.filter((invoice) => invoice.days_overdue > 60).reduce((sum, invoice) => sum + invoice.amount_overdue, 0), color: "bg-red-500", text: "text-red-600" },
  ], [invoices]);
  const agingTotal = agingBuckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  const agingPercent = (amount: number) => agingTotal ? Math.round((amount / agingTotal) * 100) : 0;
  const allVisibleChecked = invoices.length > 0 && invoices.every((invoice) => checkedIds.includes(invoice.id));

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {toastMessage && <div role="status" className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>{toastMessage}</span></div>}
      <Header pageName="Overdue Alert" />
      <main className="mx-auto w-full max-w-[1800px] space-y-5 p-4 sm:p-6 lg:p-7">
        <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Cash Collection &amp; Recovery</p><h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">CCR: Overdue Alerts &amp; Receivables Monitoring</h1><p className="mt-1 max-w-2xl text-xs text-slate-500">Pantau invoice melewati SLA 30 hari, prioritaskan risiko, dan tindak lanjuti assignment PIC.</p></div>
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={handleEvaluate} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60"><RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />Sinkronisasi Billing</button><button type="button" onClick={handleExportReport} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600"><Download className="h-3.5 w-3.5" />Ekspor Laporan</button></div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><span>Total overdue value</span><span className="rounded bg-red-100 px-2 py-1 text-red-700">Urgent</span></div><p className="mt-3 text-xl font-bold text-slate-950">{formatRupiah(kpi.totalOverdueValue)}</p><p className="mt-1 text-[11px] font-semibold text-red-600">{kpi.totalOverdueValueGrowth > 0 ? `+${kpi.totalOverdueValueGrowth}%` : "-"} vs bulan lalu</p><div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-[11px]"><span className="text-slate-400">Faktur terdampak</span><strong>{kpi.affectedInvoicesCount}</strong></div></div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><span>Aging kritis (&gt;60 hari)</span><AlertTriangle className="h-4 w-4 text-red-500" /></div><p className="mt-3 text-xl font-bold text-red-600">{formatRupiah(kpi.criticalAgingValue)}</p><p className="mt-1 text-[11px] font-semibold text-red-600">{kpi.criticalAgingPercent.toFixed(1)}% dari portofolio</p><div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-[11px]"><span className="text-slate-400">Debitur kritis</span><strong>{kpi.criticalDebtorsCount}</strong></div></div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><span>Rata-rata DSO delay</span><History className="h-4 w-4 text-slate-400" /></div><p className="mt-3 text-xl font-bold text-slate-950">{kpi.avgDsoDelay} hari</p><p className="mt-1 text-[11px] font-semibold text-amber-600">+{kpi.slaDiff} hari di atas SLA 30 hari</p><div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-[11px]"><span className="text-slate-400">Target recovery</span><strong className="text-emerald-600">≤ {kpi.targetRecoveryDays} hari</strong></div></div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"><span>Unassigned PIC</span><span className="h-2 w-2 rounded-full bg-red-500" /></div><p className="mt-3 text-xl font-bold text-blue-700">{kpi.unassignedPicCount} faktur</p><p className="mt-1 text-[11px] font-semibold text-red-600">Tindakan diperlukan</p><div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-[11px]"><span className="text-slate-400">Nilai mengambang</span><strong>{formatRupiah(kpi.unassignedFloatingValue)}</strong></div></div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><label className="relative block min-w-0 flex-1 xl:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nomor faktur, pelanggan, atau NPWP..." className="w-full rounded-md border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"><div className="w-full sm:w-44"><CustomDropdown placeholder={agingBucket} categoryTitle="AGING BUCKET" items={[{ id: "all", label: "Semua Bucket" }, { id: "b1", label: "1 - 30 Hari" }, { id: "b2", label: "31 - 60 Hari" }, { id: "b3", label: "> 60 Hari" }]} value={agingBucket} onChange={(item) => setAgingBucket(item.label)} /></div><div className="w-full sm:w-44"><CustomDropdown placeholder={selectedStatus} categoryTitle="STATUS RISIKO" items={[{ id: "all", label: "Semua Status" }, { id: "legal", label: "LEGAL ESCALATION" }, { id: "high", label: "HIGH RISK" }, { id: "watch", label: "WATCHLIST" }, { id: "nego", label: "NEGOSIASI" }]} value={selectedStatus} onChange={(item) => setSelectedStatus(item.label)} /></div><button type="button" onClick={() => setOnlyOverdue30((current) => !current)} className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${onlyOverdue30 ? "border-[#3B6FF5] bg-[#3B6FF5] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}><span className={`flex h-4 w-4 items-center justify-center rounded-sm ${onlyOverdue30 ? "bg-white text-[#3B6FF5]" : "bg-slate-100 text-transparent"}`}><Check className="h-3 w-3" /></span>Hanya &gt;30 hari</button></div></div></section>

        <section className="overdue-grid grid min-w-0 grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Daftar faktur tertunggak</h2><p className="mt-0.5 text-[11px] text-slate-500">{invoices.length} faktur dari data tervalidasi</p></div><button type="button" disabled className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 sm:self-auto"><ArrowDownUp className="h-3.5 w-3.5" />Urutkan</button></div><div className="max-h-[590px] overflow-auto"><table className="w-full min-w-[940px] border-collapse text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr className="border-b border-slate-200"><th className="w-10 px-3 py-3 text-center"><input type="checkbox" aria-label="Pilih semua invoice" checked={allVisibleChecked} onChange={(event) => setCheckedIds(event.target.checked ? invoices.map((invoice) => invoice.id) : [])} className="h-3.5 w-3.5 accent-blue-600" /></th><th className="px-3 py-3">Invoice</th><th className="px-3 py-3">Pelanggan</th><th className="px-3 py-3 text-right">Outstanding</th><th className="px-3 py-3 text-center">Aging</th><th className="px-3 py-3 text-center">Status risiko</th><th className="px-3 py-3 text-center">PIC / aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? Array.from({ length: 5 }).map((_, index) => <tr key={`loading-${index}`}><td colSpan={7} className="px-4 py-4"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>) : errorMessage ? <tr><td colSpan={7} className="px-4 py-14 text-center"><AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" /><p className="text-xs font-semibold text-red-700">{errorMessage}</p><button type="button" onClick={loadOverdueData} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"><RefreshCw className="h-3.5 w-3.5" />Coba lagi</button></td></tr> : paginatedInvoices.length === 0 ? <tr><td colSpan={7} className="px-4 py-14 text-center"><FileWarning className="mx-auto mb-2 h-5 w-5 text-slate-300" /><p className="text-xs font-semibold text-slate-500">Belum ada invoice yang sesuai filter.</p></td></tr> : paginatedInvoices.map((invoice) => { const selected = invoice.id === selectedInvoice?.id; const assigned = Boolean(invoice.pic_assigned); return <tr key={invoice.id} onClick={() => setSelectedInvoice(invoice)} className={`cursor-pointer transition hover:bg-blue-50/40 ${selected ? "bg-blue-50/70" : "bg-white"}`}><td className="px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Pilih ${invoice.invoice_number}`} checked={checkedIds.includes(invoice.id)} onChange={(event) => setCheckedIds((current) => event.target.checked ? [...new Set([...current, invoice.id])] : current.filter((id) => id !== invoice.id))} className="h-3.5 w-3.5 accent-blue-600" /></td><td className="px-3 py-3"><p className="font-semibold text-blue-700">{invoice.invoice_number}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatDate(invoice.due_date)}</p></td><td className="px-3 py-3"><p className="font-semibold text-slate-900">{invoice.customer_name}</p><p className="mt-0.5 text-[11px] text-slate-500">{invoice.branch || "Cabang belum tersedia"}{invoice.branch_code ? ` (${invoice.branch_code})` : ""}</p></td><td className="px-3 py-3 text-right"><p className="font-semibold text-slate-900">{formatRupiah(invoice.amount_overdue)}</p><p className="mt-0.5 text-[10px] text-slate-500">{invoice.payment_note || "Belum ada pembayaran"}</p></td><td className="px-3 py-3 text-center"><span className={`inline-flex rounded px-2 py-1 text-[11px] font-bold ${agingClasses(invoice.days_overdue)}`}>{invoice.days_overdue} hari</span></td><td className="px-3 py-3 text-center"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${riskClasses(invoice.risk_status)}`}>{invoice.risk_status}</span></td><td className="px-3 py-3 text-center"><div className="flex min-w-[126px] items-center justify-center gap-2">{assigned ? <><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{invoice.pic_initials || initials(invoice.pic_assigned)}</span><span className="max-w-[70px] truncate text-[11px] font-medium text-slate-700">{invoice.pic_assigned}</span></> : <button type="button" onClick={(event) => { event.stopPropagation(); setAssignModalInvoice(invoice); }} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100">Assign PIC</button>}</div></td></tr>; })}</tbody></table></div><div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Menampilkan {invoices.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, invoices.length)} dari {invoices.length} faktur</span><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} /></div></div>

          <aside className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5 xl:max-h-[calc(100vh-7rem)]"><div className="max-h-[inherit] space-y-6 overflow-y-auto p-4 sm:p-5"><div><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Aging breakdown</h2><span className="text-[11px] font-semibold text-slate-500">{invoices.length} faktur</span></div><div className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100">{agingBuckets.map((bucket) => <span key={bucket.label} className={bucket.color} style={{ width: `${agingPercent(bucket.amount)}%` }} />)}</div><div className="grid grid-cols-3 gap-2 text-[10px] font-medium text-slate-500">{agingBuckets.map((bucket) => <div key={bucket.label}><span className="block">{bucket.label}</span><strong className={`block text-sm ${bucket.text}`}>{agingPercent(bucket.amount)}%</strong><span className="block truncate">{formatRupiah(bucket.amount)}</span></div>)}</div></div>

            <div className="border-t border-slate-100 pt-5">{selectedInvoice ? <><div className="mb-4 flex items-start justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-600"><AlertTriangle className="h-4 w-4" />Target eskalasi</span><span className="shrink-0 rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">AGING: {selectedInvoice.days_overdue} HARI</span></div><h2 className="text-lg font-bold text-slate-950">{selectedInvoice.customer_name}</h2><p className="mt-1 text-xs text-slate-500">NPWP: {selectedInvoice.npwp || "-"}</p><div className="mt-4 flex items-end justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"><span className="text-xs font-medium text-slate-500">Total tagihan macet</span><strong className="text-base text-red-600">{formatRupiah(selectedInvoice.amount_overdue)}</strong></div><div className="mt-4 flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{initials(selectedInvoice.contact_person.name)}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{selectedInvoice.contact_person.name || "Kontak belum tersedia"}</p><p className="truncate text-[11px] text-slate-500">{selectedInvoice.contact_person.role || "-"} · {selectedInvoice.contact_person.phone || "-"}</p></div></div><div className="mt-4 rounded-r-md border-l-4 border-amber-400 bg-amber-50 p-3"><div className="mb-1 flex justify-between gap-3 text-[10px] font-bold uppercase text-amber-800"><span>Catatan penagihan terakhir</span><span className="shrink-0 font-medium normal-case text-amber-600">{selectedInvoice.last_log.date} {selectedInvoice.last_log.time}</span></div><p className="text-xs italic leading-relaxed text-amber-950">&quot;{selectedInvoice.last_log.text || "Belum ada log penagihan."}&quot;</p></div><div className="mt-4 space-y-2"><button type="button" onClick={() => onOpenWarningLetter(selectedInvoice)} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700"><FileWarning className="h-4 w-4" />Kirim Surat Peringatan ({selectedInvoice.action_type})</button><div className="grid grid-cols-2 gap-2"><button type="button" disabled={!selectedInvoice.contact_person.phone || selectedInvoice.contact_person.phone === "-"} onClick={() => { if (selectedInvoice.contact_person.phone && selectedInvoice.contact_person.phone !== "-") window.location.href = `tel:${selectedInvoice.contact_person.phone}`; }} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Phone className="h-3.5 w-3.5" />Hubungi</button><button type="button" onClick={() => setAssignModalInvoice(selectedInvoice)} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><UsersRound className="h-3.5 w-3.5" />Ganti PIC</button></div></div></> : <div className="py-8 text-center"><UserRound className="mx-auto mb-2 h-6 w-6 text-slate-300" /><p className="text-xs font-semibold text-slate-500">Pilih invoice untuk melihat detail.</p></div>}</div>

            {selectedInvoice && <div className="border-t border-slate-100 pt-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Log aktivitas hari ini</h3><History className="h-4 w-4 text-slate-400" /></div><div className="relative ml-2 space-y-4 border-l border-slate-200 pb-1">{assignmentHistory.map((assignment) => <div key={assignment.assignment_id} className="relative pl-4"><span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-white" /><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold text-slate-900">PIC ditugaskan: {assignment.assigned_to}</p><span className="shrink-0 text-[10px] text-slate-400">{new Date(assignment.assigned_at).toLocaleDateString("id-ID")}</span></div><p className="mt-0.5 text-[11px] text-slate-500">Status follow-up: {assignment.follow_up_status}</p></div>)}<div className="relative pl-4"><span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white" /><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold text-slate-900">{selectedInvoice.last_log.logged_by || "Sistem"}</p><span className="shrink-0 text-[10px] text-slate-400">{selectedInvoice.last_log.time}</span></div><p className="mt-0.5 text-[11px] text-slate-500">{selectedInvoice.last_log.text || "Belum ada log penagihan."}</p></div></div><button type="button" disabled className="mt-3 inline-flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-blue-600 disabled:cursor-not-allowed disabled:opacity-70">Lihat riwayat lengkap<ChevronRight className="h-3.5 w-3.5" /></button></div>}
          </div></aside>
        </section>
      </main>

      {assignModalInvoice && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><h2 className="text-sm font-bold text-slate-900">Penugasan PIC penagih</h2><button type="button" aria-label="Tutup" onClick={() => setAssignModalInvoice(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button></div><dl className="mt-4 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">Invoice</dt><dd className="font-bold text-slate-900">{assignModalInvoice.invoice_number}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Pelanggan</dt><dd className="max-w-[65%] text-right font-bold text-slate-900">{assignModalInvoice.customer_name}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Nominal overdue</dt><dd className="font-bold text-red-600">{formatRupiah(assignModalInvoice.amount_overdue)}</dd></div></dl><label className="mt-5 block text-xs font-bold text-slate-700">Nama PIC penagihan<input autoFocus type="text" value={assignTargetPic} onChange={(event) => setAssignTargetPic(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleAssignPicSubmit(); }} placeholder="Contoh: Hendra Kusuma" className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label><div className="mt-5 flex gap-2"><button type="button" onClick={() => setAssignModalInvoice(null)} className="flex-1 rounded-md border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Batal</button><button type="button" onClick={() => void handleAssignPicSubmit()} className="flex-1 rounded-md bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700">Simpan penugasan</button></div></div></div>}
    </div>
  );
};

export default OverdueAlertView;
