"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  X,
} from "lucide-react";
import Header from "@/components/Header";
import CustomDropdown from "@/components/CustomDropdown";
import Pagination from "@/components/Pagination";
import type { AssignmentRecord, OverdueInvoiceItem, OverdueKpiSummary, StaffOption } from "@/types/overdue";

interface OverdueAlertViewProps {
  onOpenWarningLetter: (item: OverdueInvoiceItem) => void;
}

const EMPTY_KPI: OverdueKpiSummary = {
  totalActiveCustomers: 0,
  highRiskOutstanding: 0,
  topContributingCustomer: null,
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

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string) {
  if (!value || value === "-") return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name?: string) {
  return name?.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "-";
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
  const [agingBucket, setAgingBucket] = useState("Semua Bucket");
  const [selectedStatus, setSelectedStatus] = useState("Semua Status");
  const [onlyOverdue30, setOnlyOverdue30] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [assignModalInvoice, setAssignModalInvoice] = useState<OverdueInvoiceItem | null>(null);
  const [assignTargetPic, setAssignTargetPic] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [canAssign, setCanAssign] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const loadOverdueData = useCallback(() => {
    setLoading(true);
    setErrorMessage(null);
    const params = new URLSearchParams({ branch: "Semua Cabang", search: searchQuery, status: selectedStatus, agingBucket, onlyOverdue30: onlyOverdue30 ? "true" : "false", refresh: Date.now().toString() });
    fetch(`/api/v1/overdue?${params.toString()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then((result) => {
        if (!result.ok) throw new Error(result.body?.error?.message || "Gagal memuat overdue alert.");
        const nextInvoices = result.body.invoices ?? [];
        setInvoices(nextInvoices);
        setKpiSummary(result.body.kpiSummary ?? null);
        setSelectedInvoice((current) => nextInvoices.find((invoice: OverdueInvoiceItem) => invoice.id === current?.id) ?? nextInvoices[0] ?? null);
        setCheckedIds((current) => current.filter((id) => nextInvoices.some((invoice: OverdueInvoiceItem) => invoice.id === id)));
        setCurrentPage(1);
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
  }, [agingBucket, onlyOverdue30, searchQuery, selectedStatus, showToast]);

  useEffect(() => { loadOverdueData(); }, [loadOverdueData]);

  useEffect(() => {
    let active = true;
    setStaffLoading(true);
    fetch(`/api/v1/overdue/staff?refresh=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then((result) => {
        if (!active) return;
        if (!result.ok) throw new Error("Gagal memuat staff aktif.");
        setStaffOptions(result.body.data ?? []);
        setCanAssign(Boolean(result.body.canAssign));
      })
      .catch(() => { if (active) { setStaffOptions([]); setCanAssign(false); } })
      .finally(() => { if (active) setStaffLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedInvoiceId = selectedInvoice?.id;
  useEffect(() => {
    if (!selectedInvoiceId) { setAssignmentHistory([]); return; }
    fetch(`/api/v1/overdue/${encodeURIComponent(selectedInvoiceId)}/assign?refresh=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then((result) => { if (!result.ok) throw new Error("Gagal memuat riwayat assignment."); setAssignmentHistory(result.body.data ?? []); })
      .catch(() => setAssignmentHistory([]));
  }, [selectedInvoiceId]);

  const handleEvaluate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/overdue/evaluate?refresh=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store" });
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
      const response = await fetch("/api/v1/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: "XLSX", requestedBy: "CCR", periodFilter: { agingBucket } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || "Export gagal.");
      showToast("Laporan ekspor berhasil dibuat.");
    } catch (error) { showToast(error instanceof Error ? error.message : "Export gagal."); }
  };

  const handleAssignPicSubmit = async () => {
    if (!assignModalInvoice || !assignTargetPic || !canAssign) { showToast("PIC wajib dipilih."); return; }
    try {
      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(assignModalInvoice.id)}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedTo: assignTargetPic }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message || body?.error || "Assignment gagal.");
      const staff = staffOptions.find((item) => item.employee_id === assignTargetPic);
      showToast(`PIC ${staff?.full_name ?? assignTargetPic} berhasil ditugaskan.`);
      setAssignModalInvoice(null);
      setAssignTargetPic("");
      loadOverdueData();
    } catch (error) { showToast(error instanceof Error ? error.message : "Assignment gagal."); }
  };

  const kpi = kpiSummary ?? EMPTY_KPI;
  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const paginatedInvoices = invoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allVisibleChecked = invoices.length > 0 && invoices.every((invoice) => checkedIds.includes(invoice.id));

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {toastMessage && <div role="status" className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><span>{toastMessage}</span></div>}
      <Header pageName="Overdue Alert" />
      <main className="mx-auto w-full max-w-[1800px] space-y-5 p-4 sm:p-6 lg:p-7">
        <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Cash Collection &amp; Recovery</p><h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">CCR: Overdue Alerts &amp; Receivables Monitoring</h1><p className="mt-1 max-w-2xl text-xs text-slate-500">Pantau invoice melewati SLA 30 hari, prioritaskan risiko, dan tindak lanjuti assignment PIC.</p></div>
          <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={handleEvaluate} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60"><RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />Refresh</button><button type="button" onClick={handleExportReport} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600"><Download className="h-3.5 w-3.5" />Ekspor Laporan</button></div>
        </section>

        {loading ? <KpiSkeleton /> : <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total overdue value" value={formatRupiah(kpi.totalOverdueValue)} detail={`${kpi.affectedInvoicesCount} faktur terdampak`} />
          <KpiCard label="Aging kritis (>60 hari)" value={formatRupiah(kpi.criticalAgingValue)} detail={`${kpi.criticalAgingPercent.toFixed(1)}% dari portofolio`} accent="text-red-600" />
          <KpiCard label="Rata-rata DSO delay" value={`${kpi.avgDsoDelay} hari`} detail={`+${kpi.slaDiff} hari di atas SLA 30 hari`} />
          <KpiCard label="Unassigned PIC" value={`${kpi.unassignedPicCount} faktur`} detail={`Nilai mengambang ${formatRupiah(kpi.unassignedFloatingValue)}`} accent="text-blue-700" />
        </section>}

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><label className="relative block min-w-0 flex-1 xl:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nomor faktur, pelanggan, atau NPWP..." className="w-full rounded-md border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"><div className="w-full sm:w-44"><CustomDropdown placeholder={agingBucket} categoryTitle="AGING BUCKET" items={[{ id: "all", label: "Semua Bucket" }, { id: "b1", label: "1 - 30 Hari" }, { id: "b2", label: "31 - 60 Hari" }, { id: "b3", label: "> 60 Hari" }]} value={agingBucket} onChange={(item) => setAgingBucket(item.label)} /></div><div className="w-full sm:w-44"><CustomDropdown placeholder={selectedStatus} categoryTitle="STATUS RISIKO" items={[{ id: "all", label: "Semua Status" }, { id: "legal", label: "LEGAL ESCALATION" }, { id: "high", label: "HIGH RISK" }, { id: "watch", label: "WATCHLIST" }, { id: "nego", label: "NEGOSIASI" }]} value={selectedStatus} onChange={(item) => setSelectedStatus(item.label)} /></div><button type="button" onClick={() => setOnlyOverdue30((current) => !current)} className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition ${onlyOverdue30 ? "border-[#3B6FF5] bg-[#3B6FF5] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}><span className={`flex h-4 w-4 items-center justify-center rounded-sm ${onlyOverdue30 ? "bg-white text-[#3B6FF5]" : "bg-slate-100 text-transparent"}`}><Check className="h-3 w-3" /></span>Hanya &gt;30 hari</button></div></div></section>

        <section className="grid min-w-0 grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <InvoiceTable loading={loading} errorMessage={errorMessage} invoices={paginatedInvoices} allVisibleChecked={allVisibleChecked} checkedIds={checkedIds} selectedInvoice={selectedInvoice} currentPage={currentPage} totalPages={totalPages} totalItems={invoices.length} onRetry={loadOverdueData} onSelect={(invoice) => { setSelectedInvoice(invoice); setCheckedIds((current) => current.includes(invoice.id) ? current.filter((id) => id === invoice.id) : [invoice.id]); }} onToggle={(id, checked) => setCheckedIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id))} onSelectAll={(checked) => setCheckedIds(checked ? invoices.map((invoice) => invoice.id) : [])} onAssign={setAssignModalInvoice} onPageChange={setCurrentPage} />
          <InvoiceDetail invoice={selectedInvoice} assignmentHistory={assignmentHistory} staffOptions={staffOptions} onOpenWarningLetter={onOpenWarningLetter} />
        </section>
      </main>

      {assignModalInvoice && <AssignmentModal invoice={assignModalInvoice} staffOptions={staffOptions} staffLoading={staffLoading} canAssign={canAssign} value={assignTargetPic} onChange={setAssignTargetPic} onClose={() => { setAssignModalInvoice(null); setAssignTargetPic(""); }} onSubmit={() => void handleAssignPicSubmit()} />}
    </div>
  );
};

function KpiCard({ label, value, detail, accent = "text-slate-950" }: { label: string; value: string; detail: string; accent?: string }) {
  return <article className="min-h-32 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-3 break-words text-xl font-bold ${accent}`}>{value}</p><p className="mt-2 text-[11px] font-semibold text-slate-500">{detail}</p></article>;
}

function KpiSkeleton() {
  return <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Memuat KPI overdue" aria-busy="true">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white p-4"><div className="h-3 w-32 rounded bg-slate-200" /><div className="mt-5 h-7 w-40 rounded bg-slate-200" /><div className="mt-3 h-3 w-28 rounded bg-slate-200" /></div>)}</section>;
}

function InvoiceTable({ loading, errorMessage, invoices, allVisibleChecked, checkedIds, selectedInvoice, currentPage, totalPages, totalItems, onRetry, onSelect, onToggle, onSelectAll, onAssign, onPageChange }: { loading: boolean; errorMessage: string | null; invoices: OverdueInvoiceItem[]; allVisibleChecked: boolean; checkedIds: string[]; selectedInvoice: OverdueInvoiceItem | null; currentPage: number; totalPages: number; totalItems: number; onRetry: () => void; onSelect: (invoice: OverdueInvoiceItem) => void; onToggle: (id: string, checked: boolean) => void; onSelectAll: (checked: boolean) => void; onAssign: (invoice: OverdueInvoiceItem) => void; onPageChange: (page: number) => void }) {
  return <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3"><div><h2 className="text-sm font-bold text-slate-900">Daftar faktur tertunggak</h2><p className="mt-0.5 text-[11px] text-slate-500">{totalItems} faktur dari data tervalidasi</p></div><button type="button" disabled className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500"><ArrowDownUp className="h-3.5 w-3.5" />Urutkan</button></div><div className="max-h-[590px] overflow-auto"><table className="w-full min-w-[940px] border-collapse text-left text-xs"><thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr className="border-b border-slate-200"><th className="w-10 px-3 py-3 text-center"><input type="checkbox" aria-label="Pilih semua invoice" checked={allVisibleChecked} onChange={(event) => onSelectAll(event.target.checked)} className="h-3.5 w-3.5 accent-blue-600" /></th><th className="px-3 py-3">Invoice</th><th className="px-3 py-3">Pelanggan</th><th className="px-3 py-3 text-right">Outstanding</th><th className="px-3 py-3 text-center">Aging</th><th className="px-3 py-3 text-center">Status risiko</th><th className="px-3 py-3 text-center">PIC / aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? [1, 2, 3, 4, 5].map((item) => <tr key={item}><td colSpan={7} className="px-4 py-4"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>) : errorMessage ? <tr><td colSpan={7} className="px-4 py-14 text-center"><AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" /><p className="text-xs font-semibold text-red-700">{errorMessage}</p><button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"><RefreshCw className="h-3.5 w-3.5" />Coba lagi</button></td></tr> : !invoices.length ? <tr><td colSpan={7} className="px-4 py-14 text-center"><FileWarning className="mx-auto mb-2 h-5 w-5 text-slate-300" /><p className="text-xs font-semibold text-slate-500">Belum ada invoice yang sesuai filter.</p></td></tr> : invoices.map((invoice) => { const assigned = Boolean(invoice.pic_assigned); return <tr key={invoice.id} onClick={() => onSelect(invoice)} className={`cursor-pointer transition hover:bg-blue-50/40 ${selectedInvoice?.id === invoice.id ? "bg-blue-50/70" : "bg-white"}`}><td className="px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Pilih ${invoice.invoice_number}`} checked={checkedIds.includes(invoice.id)} onChange={(event) => onToggle(invoice.id, event.target.checked)} className="h-3.5 w-3.5 accent-blue-600" /></td><td className="px-3 py-3"><p className="font-semibold text-blue-700">{invoice.invoice_number}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatDate(invoice.due_date)}</p></td><td className="px-3 py-3"><p className="font-semibold text-slate-900">{invoice.customer_name}</p><p className="mt-0.5 text-[11px] text-slate-500">{invoice.branch || "Cabang belum tersedia"}{invoice.branch_code ? ` (${invoice.branch_code})` : ""}</p></td><td className="px-3 py-3 text-right"><p className="font-semibold text-slate-900">{formatRupiah(invoice.amount_overdue)}</p><p className="mt-0.5 text-[10px] text-slate-500">{invoice.payment_note || "Belum ada pembayaran"}</p></td><td className="px-3 py-3 text-center"><span className={`inline-flex rounded px-2 py-1 text-[11px] font-bold ${agingClasses(invoice.days_overdue)}`}>{invoice.days_overdue} hari</span></td><td className="px-3 py-3 text-center"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${riskClasses(invoice.risk_status)}`}>{invoice.risk_status}</span></td><td className="px-3 py-3 text-center"><div className="flex min-w-[126px] items-center justify-center gap-2">{assigned ? <><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{invoice.pic_initials || initials(invoice.pic_assigned)}</span><span className="max-w-[70px] truncate text-[11px] font-medium text-slate-700">{invoice.pic_assigned}</span></> : <button type="button" onClick={(event) => { event.stopPropagation(); onAssign(invoice); }} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100">Assign PIC</button>}</div></td></tr>; })}</tbody></table></div><div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Menampilkan {totalItems ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, totalItems)} dari {totalItems} faktur</span><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} /></div></div>;
}

function InvoiceDetail({ invoice, assignmentHistory, staffOptions, onOpenWarningLetter }: { invoice: OverdueInvoiceItem | null; assignmentHistory: AssignmentRecord[]; staffOptions: StaffOption[]; onOpenWarningLetter: (invoice: OverdueInvoiceItem) => void }) {
  const assignedStaff = invoice?.pic_assigned ? staffOptions.find((staff) => staff.employee_id === invoice.pic_assigned) : undefined;
  const picName = assignedStaff?.full_name || invoice?.pic_assigned || "-";
  const picInitials = invoice?.pic_initials || (picName === "-" ? "-" : initials(picName));
  const warningInvoice = invoice && assignedStaff ? { ...invoice, pic_display_name: assignedStaff.full_name, pic_role: "Credit Controller" } : invoice;
  return <aside className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5"><div className="space-y-6 overflow-y-auto p-4 sm:p-5">{invoice ? <><div><div className="mb-4 flex items-start justify-between gap-3"><span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-600"><AlertTriangle className="h-4 w-4" />Target eskalasi</span><span className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold ${agingClasses(invoice.days_overdue)}`}>AGING: {invoice.days_overdue} HARI</span></div><h2 className="text-lg font-bold text-slate-950">{invoice.customer_name}</h2><p className="mt-1 text-xs text-slate-500">NPWP: {invoice.npwp || "-"}</p><div className="mt-4 flex items-end justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"><span className="text-xs font-medium text-slate-500">Total tagihan macet</span><strong className="text-base text-red-600">{formatRupiah(invoice.amount_overdue)}</strong></div><div className="mt-4 flex items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${picName === "-" ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-700"}`}>{picInitials}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{picName}</p><p className="truncate text-[11px] text-slate-500">{picName === "-" ? "PIC belum ditugaskan" : "PIC penagihan"}{assignedStaff ? ` · ${assignedStaff.employee_id}` : ""}</p></div></div><div className="mt-4 rounded-r-md border-l-4 border-amber-400 bg-amber-50 p-3"><div className="mb-1 flex justify-between gap-3 text-[10px] font-bold uppercase text-amber-800"><span>Catatan penagihan terakhir</span><span className="shrink-0 font-medium normal-case text-amber-600">{invoice.last_log.date} {invoice.last_log.time}</span></div><p className="text-xs italic leading-relaxed text-amber-950">&quot;{invoice.last_log.text || "Belum ada log penagihan."}&quot;</p></div><div className="mt-4 grid grid-cols-2 gap-2">{invoice.days_overdue >= 30 ? <button type="button" onClick={() => warningInvoice && onOpenWarningLetter(warningInvoice)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700"><FileWarning className="h-4 w-4" />Kirim Surat Peringatan ({getLetterAction(invoice.days_overdue)})</button> : <span className="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-[11px] font-semibold text-amber-700">Belum memenuhi batas penerbitan SP</span>}<button type="button" disabled={!invoice.contact_person.phone || invoice.contact_person.phone === "-"} onClick={() => { if (invoice.contact_person.phone && invoice.contact_person.phone !== "-") window.location.href = `tel:${invoice.contact_person.phone}`; }} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Phone className="h-3.5 w-3.5" />Hubungi</button></div></div><div className="border-t border-slate-100 pt-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Log aktivitas hari ini</h3><History className="h-4 w-4 text-slate-400" /></div><div className="relative ml-2 space-y-4 border-l border-slate-200 pb-1">{assignmentHistory.map((assignment) => <div key={assignment.assignment_id} className="relative pl-4"><span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-white" /><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold text-slate-900">PIC ditugaskan: {assignment.assigned_to}</p><span className="shrink-0 text-[10px] text-slate-400">{new Date(assignment.assigned_at).toLocaleDateString("id-ID")}</span></div><p className="mt-0.5 text-[11px] text-slate-500">Status follow-up: {assignment.follow_up_status}</p></div>)}<div className="relative pl-4"><span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white" /><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold text-slate-900">{invoice.last_log.logged_by || "Sistem"}</p><span className="shrink-0 text-[10px] text-slate-400">{invoice.last_log.time}</span></div><p className="mt-0.5 text-[11px] text-slate-500">{invoice.last_log.text || "Belum ada log penagihan."}</p></div></div><button type="button" disabled className="mt-3 inline-flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-blue-600 disabled:cursor-not-allowed disabled:opacity-70">Lihat riwayat lengkap<ChevronRight className="h-3.5 w-3.5" /></button></div></> : <div className="py-12 text-center"><UserRound className="mx-auto mb-2 h-6 w-6 text-slate-300" /><p className="text-xs font-semibold text-slate-500">Pilih invoice untuk melihat detail.</p></div>}</div></aside>;
}

function getLetterAction(days: number) {
  if (days > 90) return "SP-3";
  if (days >= 60) return "SP-2";
  return "SP-1";
}

function AssignmentModal({ invoice, staffOptions, staffLoading, canAssign, value, onChange, onClose, onSubmit }: { invoice: OverdueInvoiceItem; staffOptions: StaffOption[]; staffLoading: boolean; canAssign: boolean; value: string; onChange: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><h2 className="text-sm font-bold text-slate-900">Penugasan PIC penagih</h2><button type="button" aria-label="Tutup" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button></div><p className="mt-4 text-xs text-slate-500">{invoice.invoice_number} · {invoice.customer_name}</p><label className="mt-5 block text-xs font-bold text-slate-700">Staff PIC<select autoFocus value={value} onChange={(event) => onChange(event.target.value)} disabled={!canAssign || staffLoading || !staffOptions.length} className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"><option value="">{staffLoading ? "Memuat staff..." : !canAssign ? "Tidak memiliki hak assignment" : staffOptions.length ? "Pilih staff aktif" : "Staff tidak tersedia"}</option>{staffOptions.map((staff) => <option key={staff.employee_id} value={staff.employee_id}>{staff.full_name} ({staff.employee_id})</option>)}</select></label><div className="mt-5 flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-md border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Batal</button><button type="button" onClick={onSubmit} disabled={!canAssign || staffLoading || !value} className="flex-1 rounded-md bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Simpan penugasan</button></div></div></div>;
}

export default OverdueAlertView;
