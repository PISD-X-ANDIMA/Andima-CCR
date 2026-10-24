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
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

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
  const s = status.toUpperCase();
  if (s === "LEGAL ESCALATION") return "border-red-200 bg-red-50 text-red-700";
  if (s === "HIGH RISK") return "border-amber-200 bg-amber-50 text-amber-700";
  if (s === "WATCHLIST") return "border-slate-200 bg-slate-100 text-slate-700";
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
  const [agingBucket, setAgingBucket] = useState("All Buckets");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
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
    const params = new URLSearchParams({
      branch: "Semua Cabang",
      search: searchQuery,
      status: selectedStatus === "All Statuses" ? "Semua Status" : selectedStatus,
      agingBucket: agingBucket === "All Buckets" ? "Semua Bucket" : agingBucket,
      onlyOverdue30: onlyOverdue30 ? "true" : "false",
      refresh: Date.now().toString(),
    });
    fetch(`/api/v1/overdue?${params.toString()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then(async (response) => ({ ok: response.ok, body: await readJsonResponse<{ invoices?: OverdueInvoiceItem[]; kpiSummary?: OverdueKpiSummary; error?: { message?: string } }>(response) }))
      .then((result) => {
        if (!result.ok) throw new Error(responseMessage(result.body, "Failed to load overdue alerts."));
        const nextInvoices = result.body?.invoices ?? [];
        setInvoices(nextInvoices);
        setKpiSummary(result.body?.kpiSummary ?? null);
        setSelectedInvoice((current) => nextInvoices.find((invoice: OverdueInvoiceItem) => invoice.id === current?.id) ?? nextInvoices[0] ?? null);
        setCheckedIds((current) => current.filter((id) => nextInvoices.some((invoice: OverdueInvoiceItem) => invoice.id === id)));
        setCurrentPage(1);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to load overdue alerts.";
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
      .then(async (response) => ({ ok: response.ok, body: await readJsonResponse<{ data?: StaffOption[]; canAssign?: boolean; error?: { message?: string } }>(response) }))
      .then((result) => {
        if (!active) return;
        if (!result.ok) throw new Error(responseMessage(result.body, "Failed to load active staff."));
        setStaffOptions(result.body?.data ?? []);
        setCanAssign(Boolean(result.body?.canAssign));
      })
      .catch(() => { if (active) { setStaffOptions([]); setCanAssign(false); } })
      .finally(() => { if (active) setStaffLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedInvoiceId = selectedInvoice?.id;
  useEffect(() => {
    if (!selectedInvoiceId) { setAssignmentHistory([]); return; }
    fetch(`/api/v1/overdue/${encodeURIComponent(selectedInvoiceId)}/assign?refresh=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then(async (response) => ({ ok: response.ok, body: await readJsonResponse<{ data?: AssignmentRecord[]; error?: { message?: string } }>(response) }))
      .then((result) => { if (!result.ok) throw new Error(responseMessage(result.body, "Failed to load assignment history.")); setAssignmentHistory(result.body?.data ?? []); })
      .catch(() => setAssignmentHistory([]));
  }, [selectedInvoiceId]);

  const handleEvaluate = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/overdue/evaluate?refresh=${Date.now()}`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store" });
      const body = await readJsonResponse<{ overdue?: number; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Failed to evaluate overdue invoices."));
      showToast(`${body?.overdue ?? 0} overdue invoices detected.`);
      loadOverdueData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to evaluate overdue invoices.");
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const response = await fetch("/api/v1/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: "XLSX", requestedBy: "CCR", periodFilter: { agingBucket } }) });
      const body = await readJsonResponse<{ error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Export failed."));
      showToast("Report export generated successfully.");
    } catch (error) { showToast(error instanceof Error ? error.message : "Export failed."); }
  };

  const handleAssignPicSubmit = async () => {
    if (!assignModalInvoice || !assignTargetPic || !canAssign) { showToast("PIC must be selected."); return; }
    try {
      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(assignModalInvoice.id)}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedTo: assignTargetPic }) });
      const body = await readJsonResponse<{ error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Assignment failed."));
      const staff = staffOptions.find((item) => item.employee_id === assignTargetPic);
      showToast(`PIC ${staff?.full_name ?? assignTargetPic} successfully assigned.`);
      setAssignModalInvoice(null);
      setAssignTargetPic("");
      loadOverdueData();
    } catch (error) { showToast(error instanceof Error ? error.message : "Assignment failed."); }
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
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl font-heading">Overdue Alerts &amp; Receivables Monitoring</h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">Monitor invoices past 30-day SLA, prioritize risks, and follow up PIC assignments.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleEvaluate} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60 cursor-pointer">
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />Refresh
            </button>
            <button type="button" onClick={handleExportReport} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 cursor-pointer">
              <Download className="h-3.5 w-3.5" />Export Report
            </button>
          </div>
        </section>

        {loading ? <KpiSkeleton /> : <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Overdue Value" value={formatRupiah(kpi.totalOverdueValue)} detail={`${kpi.affectedInvoicesCount} invoices affected`} />
          <KpiCard label="Critical Aging (>60 Days)" value={formatRupiah(kpi.criticalAgingValue)} detail={`${kpi.criticalAgingPercent.toFixed(1)}% of portfolio`} accent="text-red-600" />
          <KpiCard label="Average DSO Delay" value={`${kpi.avgDsoDelay} days`} detail={`+${kpi.slaDiff} days above 30-day SLA`} />
          <KpiCard label="Unassigned PIC" value={`${kpi.unassignedPicCount} invoices`} detail={`Floating value ${formatRupiah(kpi.unassignedFloatingValue)}`} accent="text-blue-700" />
        </section>}

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <label className="relative block min-w-0 flex-1 xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search invoice number, customer, or tax ID..." className="w-full rounded-md border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="w-full sm:w-44">
                <CustomDropdown
                  placeholder={agingBucket}
                  categoryTitle="Aging Bucket"
                  items={[{ id: "all", label: "All Buckets" }, { id: "b1", label: "1 - 30 Days" }, { id: "b2", label: "31 - 60 Days" }, { id: "b3", label: "> 60 Days" }]}
                  value={agingBucket}
                  onChange={(item) => setAgingBucket(item.label)}
                />
              </div>
              <div className="w-full sm:w-44">
                <CustomDropdown
                  placeholder={selectedStatus}
                  categoryTitle="Risk Status"
                  items={[{ id: "all", label: "All Statuses" }, { id: "legal", label: "Legal Escalation" }, { id: "high", label: "High Risk" }, { id: "watch", label: "Watchlist" }, { id: "nego", label: "Negotiation" }]}
                  value={selectedStatus}
                  onChange={(item) => setSelectedStatus(item.label)}
                />
              </div>
              <button
                type="button"
                onClick={() => setOnlyOverdue30((current) => !current)}
                className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition cursor-pointer ${onlyOverdue30 ? "border-[#3B6FF5] bg-[#3B6FF5] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-sm ${onlyOverdue30 ? "bg-white text-[#3B6FF5]" : "bg-slate-100 text-transparent"}`}>
                  <Check className="h-3 w-3" />
                </span>
                Only &gt;30 Days
              </button>
            </div>
          </div>
        </section>

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
  return (
    <article className="min-h-32 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold text-slate-500 font-heading">{label}</p>
      <p className={`mt-3 break-words text-xl font-bold font-heading ${accent}`}>{value}</p>
      <p className="mt-2 text-[11px] font-medium text-slate-500">{detail}</p>
    </article>
  );
}

function KpiSkeleton() {
  return <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading overdue KPIs" aria-busy="true">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white p-4"><div className="h-3 w-32 rounded bg-slate-200" /><div className="mt-5 h-7 w-40 rounded bg-slate-200" /><div className="mt-3 h-3 w-28 rounded bg-slate-200" /></div>)}</section>;
}

function InvoiceTable({ loading, errorMessage, invoices, allVisibleChecked, checkedIds, selectedInvoice, currentPage, totalPages, totalItems, onRetry, onSelect, onToggle, onSelectAll, onAssign, onPageChange }: { loading: boolean; errorMessage: string | null; invoices: OverdueInvoiceItem[]; allVisibleChecked: boolean; checkedIds: string[]; selectedInvoice: OverdueInvoiceItem | null; currentPage: number; totalPages: number; totalItems: number; onRetry: () => void; onSelect: (invoice: OverdueInvoiceItem) => void; onToggle: (id: string, checked: boolean) => void; onSelectAll: (checked: boolean) => void; onAssign: (invoice: OverdueInvoiceItem) => void; onPageChange: (page: number) => void }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 font-heading">Overdue Invoices List</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">{totalItems} invoices from validated data</p>
        </div>
        <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
          <ArrowDownUp className="h-3.5 w-3.5" />Sort
        </button>
      </div>
      <div className="max-h-[590px] overflow-auto">
        <table className="w-full min-w-[940px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="w-10 px-3 py-3 text-center">
                <input type="checkbox" aria-label="Select all invoices" checked={allVisibleChecked} onChange={(event) => onSelectAll(event.target.checked)} className="h-3.5 w-3.5 accent-blue-600" />
              </th>
              <th className="px-3 py-3">Invoice</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3 text-right">Outstanding</th>
              <th className="px-3 py-3 text-center">Aging</th>
              <th className="px-3 py-3 text-center">Risk Status</th>
              <th className="px-3 py-3 text-center">PIC / Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? [1, 2, 3, 4, 5].map((item) => (
              <tr key={item}><td colSpan={7} className="px-4 py-4"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
            )) : errorMessage ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">{errorMessage}</p>
                  <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline cursor-pointer">
                    <RefreshCw className="h-3.5 w-3.5" />Try again
                  </button>
                </td>
              </tr>
            ) : !invoices.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <FileWarning className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">No invoices match the selected filter.</p>
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const assigned = Boolean(invoice.pic_assigned);
                return (
                  <tr key={invoice.id} onClick={() => onSelect(invoice)} className={`cursor-pointer transition hover:bg-blue-50/40 ${selectedInvoice?.id === invoice.id ? "bg-blue-50/70" : "bg-white"}`}>
                    <td className="px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${invoice.invoice_number}`} checked={checkedIds.includes(invoice.id)} onChange={(event) => onToggle(invoice.id, event.target.checked)} className="h-3.5 w-3.5 accent-blue-600 cursor-pointer" />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-blue-700">{invoice.invoice_number}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(invoice.due_date)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{invoice.customer_name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{invoice.branch || "Branch unavailable"}{invoice.branch_code ? ` (${invoice.branch_code})` : ""}</p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="font-semibold text-slate-900">{formatRupiah(invoice.amount_overdue)}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{invoice.payment_note || "No payments yet"}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${agingClasses(invoice.days_overdue)}`}>{invoice.days_overdue} days</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskClasses(invoice.risk_status)}`}>{invoice.risk_status}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex min-w-[126px] items-center justify-center gap-2">
                        {assigned ? (
                          <>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{invoice.pic_initials || initials(invoice.pic_assigned)}</span>
                            <span className="max-w-[70px] truncate text-[11px] font-medium text-slate-700">{invoice.pic_assigned}</span>
                          </>
                        ) : (
                          <button type="button" onClick={(event) => { event.stopPropagation(); onAssign(invoice); }} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 cursor-pointer">Assign PIC</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Showing {totalItems ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems} invoices</span>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}

function InvoiceDetail({ invoice, assignmentHistory, staffOptions, onOpenWarningLetter }: { invoice: OverdueInvoiceItem | null; assignmentHistory: AssignmentRecord[]; staffOptions: StaffOption[]; onOpenWarningLetter: (invoice: OverdueInvoiceItem) => void }) {
  const assignedStaff = invoice?.pic_assigned ? staffOptions.find((staff) => staff.employee_id === invoice.pic_assigned) : undefined;
  const picName = assignedStaff?.full_name || invoice?.pic_assigned || "-";
  const picInitials = invoice?.pic_initials || (picName === "-" ? "-" : initials(picName));
  const warningInvoice = invoice && assignedStaff ? { ...invoice, pic_display_name: assignedStaff.full_name, pic_role: "Credit Controller" } : invoice;
  return (
    <aside className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5">
      <div className="space-y-6 overflow-y-auto p-4 sm:p-5">
        {invoice ? (
          <>
            <div>
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 font-heading">
                  <AlertTriangle className="h-4 w-4" />Escalation Target
                </span>
                <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${agingClasses(invoice.days_overdue)}`}>
                  Aging: {invoice.days_overdue} Days
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-950 font-heading">{invoice.customer_name}</h2>
              <p className="mt-1 text-xs text-slate-500">NPWP / Tax ID: {invoice.npwp || "-"}</p>
              <div className="mt-4 flex items-end justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                <span className="text-xs font-medium text-slate-500">Total Overdue Balance</span>
                <strong className="text-base text-red-600 font-heading">{formatRupiah(invoice.amount_overdue)}</strong>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${picName === "-" ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-700"}`}>
                  {picInitials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{picName}</p>
                  <p className="truncate text-[11px] text-slate-500">{picName === "-" ? "Unassigned PIC" : "Collection PIC"}{assignedStaff ? ` · ${assignedStaff.employee_id}` : ""}</p>
                </div>
              </div>
              <div className="mt-4 rounded-r-md border-l-4 border-amber-400 bg-amber-50 p-3">
                <div className="mb-1 flex justify-between gap-3 text-[10px] font-semibold text-amber-800">
                  <span>Latest Collection Note</span>
                  <span className="shrink-0 font-medium normal-case text-amber-600">{invoice.last_log.date} {invoice.last_log.time}</span>
                </div>
                <p className="text-xs italic leading-relaxed text-amber-950">&quot;{invoice.last_log.text || "No collection logs recorded yet."}&quot;</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {invoice.days_overdue >= 30 ? (
                  <button type="button" onClick={() => warningInvoice && onOpenWarningLetter(warningInvoice)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 cursor-pointer">
                    <FileWarning className="h-4 w-4" />Send Warning Letter ({getLetterAction(invoice.days_overdue)})
                  </button>
                ) : (
                  <span className="col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-[11px] font-semibold text-amber-700">Does not meet warning letter threshold</span>
                )}
                <button type="button" disabled={!invoice.contact_person.phone || invoice.contact_person.phone === "-"} onClick={() => { if (invoice.contact_person.phone && invoice.contact_person.phone !== "-") window.location.href = `tel:${invoice.contact_person.phone}`; }} className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                  <Phone className="h-3.5 w-3.5" />Call Contact
                </button>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900 font-heading">Today&apos;s Activity Log</h3>
                <History className="h-4 w-4 text-slate-400" />
              </div>
              <div className="relative ml-2 space-y-4 border-l border-slate-200 pb-1">
                {assignmentHistory.map((assignment) => (
                  <div key={assignment.assignment_id} className="relative pl-4">
                    <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-white" />
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-bold text-slate-900">PIC Assigned: {assignment.assigned_to}</p>
                      <span className="shrink-0 text-[10px] text-slate-400">{new Date(assignment.assigned_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">Follow-up status: {assignment.follow_up_status}</p>
                  </div>
                ))}
                <div className="relative pl-4">
                  <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-900">{invoice.last_log.logged_by || "System"}</p>
                    <span className="shrink-0 text-[10px] text-slate-400">{invoice.last_log.time}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{invoice.last_log.text || "No collection logs recorded yet."}</p>
                </div>
              </div>
              <button type="button" disabled className="mt-3 inline-flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-blue-600 disabled:cursor-not-allowed disabled:opacity-70">
                View full history<ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="py-12 text-center">
            <UserRound className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-xs font-semibold text-slate-500">Select an invoice to view details.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function getLetterAction(days: number) {
  if (days > 90) return "Warning Letter 3";
  if (days >= 60) return "Warning Letter 2";
  return "Warning Letter 1";
}

function AssignmentModal({ invoice, staffOptions, staffLoading, canAssign, value, onChange, onClose, onSubmit }: { invoice: OverdueInvoiceItem; staffOptions: StaffOption[]; staffLoading: boolean; canAssign: boolean; value: string; onChange: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 font-heading">Collection PIC Assignment</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500">{invoice.invoice_number} · {invoice.customer_name}</p>
        <label className="mt-5 block text-xs font-semibold text-slate-700">
          Staff PIC
          <select autoFocus value={value} onChange={(event) => onChange(event.target.value)} disabled={!canAssign || staffLoading || !staffOptions.length} className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-medium outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100">
            <option value="">{staffLoading ? "Loading staff..." : !canAssign ? "No assignment permission" : staffOptions.length ? "Select active staff" : "No staff available"}</option>
            {staffOptions.map((staff) => <option key={staff.employee_id} value={staff.employee_id}>{staff.full_name} ({staff.employee_id})</option>)}
          </select>
        </label>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-md border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button type="button" onClick={onSubmit} disabled={!canAssign || staffLoading || !value} className="flex-1 rounded-md bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">Save Assignment</button>
        </div>
      </div>
    </div>
  );
}

export default OverdueAlertView;
