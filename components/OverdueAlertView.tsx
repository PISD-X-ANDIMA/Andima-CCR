"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  FileWarning,
  History,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Send,
  Upload,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import CustomDropdown from "@/components/CustomDropdown";
import Pagination from "@/components/Pagination";
import OverdueInvoicePreviewModal from "./OverdueInvoicePreviewModal";
import type { AssignmentRecord, OverdueInvoiceItem, OverdueKpiSummary, StaffOption } from "@/types/overdue";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

interface OverdueAlertViewProps {
  onOpenWarningLetter?: (item: OverdueInvoiceItem) => void;
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

function formatDate(value?: string | null) {
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

function followUpStatusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (s === "PROMISE_TO_PAY") return "bg-amber-100 text-amber-800 border-amber-300";
  if (s === "DISPUTE") return "bg-purple-100 text-purple-800 border-purple-300";
  if (s === "IN_PROGRESS") return "bg-blue-100 text-blue-800 border-blue-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

export const OverdueAlertView: React.FC<OverdueAlertViewProps> = ({ onOpenWarningLetter }) => {
  const router = useRouter();
  const [invoices, setInvoices] = useState<OverdueInvoiceItem[]>([]);
  const [kpiSummary, setKpiSummary] = useState<OverdueKpiSummary | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<OverdueInvoiceItem | null>(null);
  const [previewModalInvoice, setPreviewModalInvoice] = useState<OverdueInvoiceItem | null>(null);
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
  const [isAssigning, setIsAssigning] = useState(false);
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

  const refreshAssignmentHistory = useCallback((invoiceId: string) => {
    fetch(`/api/v1/overdue/${encodeURIComponent(invoiceId)}/assign?refresh=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then(async (response) => ({ ok: response.ok, body: await readJsonResponse<{ data?: AssignmentRecord[]; error?: { message?: string } }>(response) }))
      .then((result) => { if (!result.ok) throw new Error(responseMessage(result.body, "Failed to load assignment history.")); setAssignmentHistory(result.body?.data ?? []); })
      .catch(() => setAssignmentHistory([]));
  }, []);

  const selectedInvoiceId = selectedInvoice?.id;
  useEffect(() => {
    if (!selectedInvoiceId) { setAssignmentHistory([]); return; }
    refreshAssignmentHistory(selectedInvoiceId);
  }, [selectedInvoiceId, refreshAssignmentHistory]);

  const previewInvoiceId = previewModalInvoice?.id;
  useEffect(() => {
    if (previewInvoiceId) {
      refreshAssignmentHistory(previewInvoiceId);
    }
  }, [previewInvoiceId, refreshAssignmentHistory]);

  const handleProgressSaved = useCallback(() => {
    if (selectedInvoice?.id) {
      refreshAssignmentHistory(selectedInvoice.id);
    }
    loadOverdueData();
  }, [selectedInvoice?.id, refreshAssignmentHistory, loadOverdueData]);

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

  const handleAssignPicSubmit = async () => {
    if (!assignModalInvoice || !assignTargetPic || !canAssign || isAssigning) {
      if (!assignTargetPic) showToast("Pilih salah satu staf PIC.");
      return;
    }
    setIsAssigning(true);
    try {
      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(assignModalInvoice.id)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: assignTargetPic }),
      });
      const body = await readJsonResponse<{ error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Gagal menugaskan PIC."));
      const staff = staffOptions.find((item) => item.employee_id === assignTargetPic);
      showToast(`PIC ${staff?.full_name ?? assignTargetPic} berhasil ditugaskan.`);
      const currentAssignedId = assignModalInvoice.id;
      setAssignModalInvoice(null);
      setAssignTargetPic("");
      loadOverdueData();
      refreshAssignmentHistory(currentAssignedId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Penugasan gagal.");
    } finally {
      setIsAssigning(false);
    }
  };

  const kpi = kpiSummary ?? EMPTY_KPI;
  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const paginatedInvoices = invoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allVisibleChecked = invoices.length > 0 && invoices.every((invoice) => checkedIds.includes(invoice.id));

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {toastMessage && (
        <div role="status" className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
      <Header pageName="Overdue Alert" />
      <main className="mx-auto w-full max-w-[1800px] space-y-5 p-4 sm:p-6 lg:p-7">
        <section className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl font-heading">Overdue Alerts &amp; Receivables Monitoring</h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">Monitor overdue receivables, coordinate collection staff, and record follow-up progress.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleEvaluate} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60 cursor-pointer">
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />Refresh
            </button>
          </div>
        </section>

        {loading ? <KpiSkeleton /> : (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total Overdue Value" value={formatRupiah(kpi.totalOverdueValue)} detail={`${kpi.affectedInvoicesCount} invoices affected`} />
            <KpiCard label="Critical Aging (>60 Days)" value={formatRupiah(kpi.criticalAgingValue)} detail={`${kpi.criticalAgingPercent.toFixed(1)}% of portfolio`} accent="text-red-600" />
            <KpiCard label="Average DSO Delay" value={`${kpi.avgDsoDelay} days`} detail={`+${kpi.slaDiff} days above 30-day SLA`} />
            <KpiCard label="Unassigned PIC" value={`${kpi.unassignedPicCount} invoices`} detail={`Floating value ${formatRupiah(kpi.unassignedFloatingValue)}`} accent="text-blue-700" />
          </section>
        )}

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

        <section className="min-w-0 w-full">
          <InvoiceTable
            loading={loading}
            errorMessage={errorMessage}
            invoices={paginatedInvoices}
            allVisibleChecked={allVisibleChecked}
            checkedIds={checkedIds}
            selectedInvoice={selectedInvoice}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={invoices.length}
            onRetry={loadOverdueData}
            onSelect={(invoice) => { setSelectedInvoice(invoice); setCheckedIds((current) => current.includes(invoice.id) ? current.filter((id) => id === invoice.id) : [invoice.id]); }}
            onToggle={(id, checked) => setCheckedIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id))}
            onSelectAll={(checked) => setCheckedIds(checked ? invoices.map((invoice) => invoice.id) : [])}
            onAssign={setAssignModalInvoice}
            onPageChange={setCurrentPage}
            onPreview={(invoice) => setPreviewModalInvoice(invoice)}
            onEdit={(invoice) => router.push(`/overdue-alert/${encodeURIComponent(invoice.id)}/edit`)}
          />
        </section>
      </main>

      {assignModalInvoice && (
        <AssignmentModal
          invoice={assignModalInvoice}
          staffOptions={staffOptions}
          staffLoading={staffLoading}
          canAssign={canAssign}
          value={assignTargetPic}
          onChange={setAssignTargetPic}
          onClose={() => {
            if (!isAssigning) {
              setAssignModalInvoice(null);
              setAssignTargetPic("");
            }
          }}
          onSubmit={() => void handleAssignPicSubmit()}
          isSubmitting={isAssigning}
        />
      )}

      {previewModalInvoice && (
        <OverdueInvoicePreviewModal
          open={Boolean(previewModalInvoice)}
          invoice={previewModalInvoice}
          assignmentHistory={assignmentHistory}
          staffOptions={staffOptions}
          onClose={() => setPreviewModalInvoice(null)}
          onEdit={(invoice) => {
            setPreviewModalInvoice(null);
            router.push(`/overdue-alert/${encodeURIComponent(invoice.id)}/edit`);
          }}
          onAssign={(invoice) => {
            setAssignModalInvoice(invoice);
          }}
        />
      )}
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
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading overdue KPIs" aria-busy="true">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white p-4">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="mt-5 h-7 w-40 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-28 rounded bg-slate-200" />
        </div>
      ))}
    </section>
  );
}

function InvoiceTable({
  loading,
  errorMessage,
  invoices,
  allVisibleChecked,
  checkedIds,
  selectedInvoice,
  currentPage,
  totalPages,
  totalItems,
  onRetry,
  onSelect,
  onToggle,
  onSelectAll,
  onAssign,
  onPageChange,
  onPreview,
  onEdit,
}: {
  loading: boolean;
  errorMessage: string | null;
  invoices: OverdueInvoiceItem[];
  allVisibleChecked: boolean;
  checkedIds: string[];
  selectedInvoice: OverdueInvoiceItem | null;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onRetry: () => void;
  onSelect: (invoice: OverdueInvoiceItem) => void;
  onToggle: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onAssign: (invoice: OverdueInvoiceItem) => void;
  onPageChange: (page: number) => void;
  onPreview: (invoice: OverdueInvoiceItem) => void;
  onEdit: (invoice: OverdueInvoiceItem) => void;
}) {
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openActionMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openActionMenuId]);

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
      <div className="max-h-[640px] overflow-auto">
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
              <th className="px-3 py-3 text-center">PIC</th>
              <th className="w-20 px-3 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? [1, 2, 3, 4, 5].map((item) => (
              <tr key={item}><td colSpan={8} className="px-4 py-4"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
            )) : errorMessage ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
                  <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">{errorMessage}</p>
                  <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline cursor-pointer">
                    <RefreshCw className="h-3.5 w-3.5" />Try again
                  </button>
                </td>
              </tr>
            ) : !invoices.length ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center">
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
                    <td className="relative px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          aria-label={`Aksi untuk invoice ${invoice.invoice_number}`}
                          onClick={() => setOpenActionMenuId((curr) => (curr === invoice.id ? null : invoice.id))}
                          className={`flex size-8 items-center justify-center rounded-full border transition cursor-pointer ${
                            openActionMenuId === invoice.id
                              ? "border-blue-400 bg-blue-50 text-blue-700 shadow-xs"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                          }`}
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </div>

                      {openActionMenuId === invoice.id && (
                        <div
                          ref={actionMenuRef}
                          className="absolute right-3 top-12 z-30 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 text-left"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              onPreview(invoice);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer"
                          >
                            <Eye className="size-3.5 text-blue-600" />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              onEdit(invoice);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
                          >
                            <Pencil className="size-3.5 text-emerald-600" />
                            <span>Edit</span>
                          </button>
                        </div>
                      )}
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

function InvoiceDetail({
  invoice,
  assignmentHistory,
  staffOptions,
  onAssign,
  onProgressSaved,
  showToast,
  onOpenWarningLetter,
}: {
  invoice: OverdueInvoiceItem | null;
  assignmentHistory: AssignmentRecord[];
  staffOptions: StaffOption[];
  onAssign: (invoice: OverdueInvoiceItem) => void;
  onProgressSaved: () => void;
  showToast: (msg: string) => void;
  onOpenWarningLetter?: (invoice: OverdueInvoiceItem) => void;
}) {
  const [followUpStatus, setFollowUpStatus] = useState("IN_PROGRESS");
  const [followUpAction, setFollowUpAction] = useState("WhatsApp");
  const [promiseDate, setPromiseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const assignedStaff = invoice?.pic_assigned ? staffOptions.find((staff) => staff.employee_id === invoice.pic_assigned) : undefined;
  const picName = assignedStaff?.full_name || invoice?.pic_assigned || "-";
  const picInitials = invoice?.pic_initials || (picName === "-" ? "-" : initials(picName));

  const cleanPhone = invoice?.contact_person?.phone ? invoice.contact_person.phone.replace(/[^0-9]/g, "") : "";
  const waPhone = cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : cleanPhone;

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    if (!notes.trim() && !evidenceFile) {
      showToast("Tuliskan catatan progress atau unggah file bukti.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("followUpStatus", followUpStatus);
      formData.append("followUpAction", followUpAction);
      if (promiseDate) formData.append("promiseDate", promiseDate);
      if (notes.trim()) formData.append("notes", notes.trim());
      if (evidenceFile) formData.append("file", evidenceFile);

      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(invoice.id)}/progress`, {
        method: "POST",
        body: formData,
      });

      const body = await readJsonResponse<{ success?: boolean; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Gagal menyimpan progress follow-up."));

      showToast("Progress follow-up berhasil dicatat!");
      setNotes("");
      setPromiseDate("");
      setEvidenceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onProgressSaved();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal menyimpan progress follow-up.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5">
      <div className="space-y-5 overflow-y-auto p-4 sm:p-5 max-h-[calc(100vh-100px)]">
        {invoice ? (
          <>
            <div>
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 font-heading">
                  <AlertTriangle className="h-4 w-4" />Internal Overdue Alert
                </span>
                <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${agingClasses(invoice.days_overdue)}`}>
                  Aging: {invoice.days_overdue} Days
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-950 font-heading">{invoice.customer_name}</h2>
              <p className="mt-0.5 text-xs text-slate-500 font-mono">Invoice: {invoice.invoice_number}</p>
              <p className="text-[11px] text-slate-500">Tax ID: {invoice.npwp || "-"}</p>

              <div className="mt-3 flex items-end justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                <span className="text-xs font-medium text-slate-500">Total Outstanding</span>
                <strong className="text-base text-red-600 font-heading">{formatRupiah(invoice.amount_overdue)}</strong>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-2.5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${picName === "-" ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-700"}`}>
                    {picInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900">{picName}</p>
                    <p className="truncate text-[10px] text-slate-500">{picName === "-" ? "Unassigned PIC" : "Assigned Staff"}{assignedStaff ? ` · ${assignedStaff.employee_id}` : ""}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAssign(invoice)}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                >
                  {picName === "-" ? "Assign PIC" : "Change PIC"}
                </button>
              </div>

              {/* Overdue threshold callout (invoice.days_overdue >= 30) */}
              {invoice.days_overdue >= 30 ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>Overdue Threshold Active (&ge; 30 Days)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700">
                    Invoice melewati SLA 30 hari. Koordinasikan dengan customer dan perbarui progress follow-up di bawah.
                  </p>
                </div>
              ) : null}

              {/* Contact Actions */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {waPhone ? (
                  <a
                    href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Halo, konfirmasi tagihan ${invoice.invoice_number} PT Andima Transportindo.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />WhatsApp
                  </a>
                ) : (
                  <button type="button" disabled className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed">
                    <MessageSquare className="h-3.5 w-3.5" />WhatsApp
                  </button>
                )}
                <button
                  type="button"
                  disabled={!invoice.contact_person.phone || invoice.contact_person.phone === "-"}
                  onClick={() => { if (invoice.contact_person.phone && invoice.contact_person.phone !== "-") window.location.href = `tel:${invoice.contact_person.phone}`; }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-slate-600" />Call Contact
                </button>
              </div>
            </div>

            {/* Follow-up Progress Form for Assigned Staff */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3.5">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 font-heading">Update Follow-up Progress</h3>
                </div>
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">Internal Form</span>
              </div>
              <form onSubmit={(e) => void handleSubmitProgress(e)} className="mt-3 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Status Kondisi Invoice</label>
                  <select
                    value={followUpStatus}
                    onChange={(e) => setFollowUpStatus(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                  >
                    <option value="IN_PROGRESS">Dalam Proses (In Progress)</option>
                    <option value="PROMISE_TO_PAY">Janji Bayar (Promise to Pay)</option>
                    <option value="COMPLETED">Selesai / Lunas (Completed)</option>
                    <option value="DISPUTE">Sengketa / Penyesuaian (Dispute)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Tindakan / Action</label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {["WhatsApp", "Call", "Email", "Visit", "Negotiation"].map((act) => (
                      <button
                        type="button"
                        key={act}
                        onClick={() => setFollowUpAction(act)}
                        className={`rounded-md px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                          followUpAction === act
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Tanggal Janji Bayar (Opsional)</label>
                  <input
                    type="date"
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Catatan Follow-up</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Hasil komunikasi dengan customer, kendala, komitmen..."
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-xs font-medium outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Lampiran Bukti (Screenshot / Dokumen)</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    id="evidence-file-input"
                  />
                  <div className="mt-1 flex items-center gap-2">
                    <label
                      htmlFor="evidence-file-input"
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                    >
                      <Upload className="h-3.5 w-3.5 text-slate-500" />
                      {evidenceFile ? "Ubah File" : "Pilih File Bukti"}
                    </label>
                    {evidenceFile && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-600 truncate max-w-[180px]">
                        <Paperclip className="h-3 w-3 shrink-0 text-blue-600" />
                        <span className="truncate">{evidenceFile.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEvidenceFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="ml-1 text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 cursor-pointer transition"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Simpan Progress Follow-up</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Activity Log & History */}
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 font-heading">Activity &amp; Follow-up History</h3>
                <History className="h-4 w-4 text-slate-400" />
              </div>
              <div className="relative ml-2 space-y-3.5 border-l border-slate-200 pb-1">
                {assignmentHistory.map((assignment) => (
                  <div key={assignment.assignment_id} className="relative pl-4">
                    <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-white" />
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-bold text-slate-900">
                        {assignment.assigned_to}
                      </p>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {new Date(assignment.assigned_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold ${followUpStatusBadge(assignment.follow_up_status)}`}>
                        {assignment.follow_up_status}
                      </span>
                      {assignment.follow_up_action && (
                        <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          Via {assignment.follow_up_action}
                        </span>
                      )}
                    </div>

                    {assignment.promise_date && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                        <Calendar className="h-3 w-3" />
                        <span>Janji Bayar: {formatDate(assignment.promise_date)}</span>
                      </p>
                    )}

                    {assignment.notes && (
                      <p className="mt-1 rounded bg-slate-50 p-1.5 text-[11px] italic leading-relaxed text-slate-700">
                        &quot;{assignment.notes}&quot;
                      </p>
                    )}

                    {assignment.attachment_url && (
                      <a
                        href={assignment.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span>Lihat Bukti Lampiran</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </a>
                    )}
                  </div>
                ))}

                {invoice.last_log?.text && (
                  <div className="relative pl-4">
                    <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-bold text-slate-700">{invoice.last_log.logged_by || "System"}</p>
                      <span className="shrink-0 text-[10px] text-slate-400">{invoice.last_log.time}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 italic">&quot;{invoice.last_log.text}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="py-12 text-center">
            <UserRound className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-xs font-semibold text-slate-500">Pilih salah satu invoice untuk melihat detail &amp; mencatat progress.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function AssignmentModal({
  invoice,
  staffOptions,
  staffLoading,
  canAssign,
  value,
  onChange,
  onClose,
  onSubmit,
  isSubmitting = false,
}: {
  invoice: OverdueInvoiceItem;
  staffOptions: StaffOption[];
  staffLoading: boolean;
  canAssign: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}) {
  const [searchStaff, setSearchStaff] = useState("");

  const filteredStaff = React.useMemo(() => {
    const q = searchStaff.trim().toLowerCase();
    if (!q) return staffOptions;
    return staffOptions.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.employee_id.toLowerCase().includes(q)
    );
  }, [staffOptions, searchStaff]);

  const selectedStaffObj = staffOptions.find((s) => s.employee_id === value);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <UserCheck className="size-4" />
            </span>
            <div>
              <h2 id="assignment-modal-title" className="text-sm font-bold text-slate-900 font-heading">
                Penugasan PIC Penagihan
              </h2>
              <p className="text-[11px] text-slate-500">
                Pilih staf CCR untuk menangani invoice ini
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Invoice Summary Card */}
        <div className="border-b border-slate-100 bg-blue-50/40 px-5 py-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-blue-700">{invoice.invoice_number}</span>
            <span className="font-bold text-red-600 font-heading">{formatRupiah(invoice.amount_overdue)}</span>
          </div>
          <p className="mt-0.5 font-medium text-slate-800 truncate">{invoice.customer_name}</p>
        </div>

        {/* Search Bar */}
        <div className="px-5 pt-4 pb-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchStaff}
              onChange={(e) => setSearchStaff(e.target.value)}
              placeholder="Cari nama staff atau ID karyawan..."
              disabled={!canAssign || staffLoading}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-8 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            {searchStaff && (
              <button
                type="button"
                onClick={() => setSearchStaff("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
        </div>

        {/* Staff List Body */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1.5 max-h-[300px]">
          {staffLoading ? (
            <div className="py-10 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="size-5 mx-auto animate-spin text-blue-600" />
              <p>Memuat daftar staf CCR...</p>
            </div>
          ) : !canAssign ? (
            <div className="py-8 text-center text-xs text-amber-700">
              <p className="font-semibold">Akses Terbatas</p>
              <p className="text-[11px] mt-1 text-slate-500">Hanya role Management yang berwenang menugaskan PIC.</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <UserRound className="size-6 mx-auto mb-1.5 opacity-40" />
              <p className="font-medium text-slate-600">Tidak ada staf yang sesuai</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Coba kata kunci pencarian yang lain.</p>
            </div>
          ) : (
            filteredStaff.map((staff) => {
              const isSelected = value === staff.employee_id;
              const staffInit = staff.full_name
                .split(/\s+/)
                .filter(Boolean)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={staff.employee_id}
                  onClick={() => onChange(staff.employee_id)}
                  className={`flex items-center justify-between rounded-xl border p-3 transition cursor-pointer ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/80 ring-1 ring-blue-500 shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {staffInit}
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate text-xs font-bold ${isSelected ? "text-blue-950" : "text-slate-900"}`}>
                        {staff.full_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-500 font-semibold">{staff.employee_id}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 uppercase">
                          Staff CCR
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-3 shrink-0">
                    <span
                      className={`flex size-5 items-center justify-center rounded-full border transition ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="size-3 stroke-[3]" />}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Staff Indicator */}
        {selectedStaffObj && (
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 text-xs flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Staf Terpilih:</span>
            <span className="font-bold text-blue-700">
              {selectedStaffObj.full_name} ({selectedStaffObj.employee_id})
            </span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-xl border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canAssign || staffLoading || !value || isSubmitting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Menugaskan...</span>
              </>
            ) : (
              <span>Simpan Penugasan</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverdueAlertView;
