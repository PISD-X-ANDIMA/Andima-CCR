"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Eye,
  FileWarning,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import CustomDropdown from "@/components/CustomDropdown";
import Pagination from "@/components/Pagination";
import OverdueInvoicePreviewModal from "./OverdueInvoicePreviewModal";
import type { AssignmentRecord, OverdueInvoiceItem, OverdueKpiSummary, StaffOption } from "@/types/overdue";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type OverdueAlertViewProps = Record<string, never>;

const EMPTY_KPI: OverdueKpiSummary = {
  totalOverdueInvoices: 0,
  totalOverdueAmount: 0,
  oldestInvoiceDays: 0,
  oldestInvoiceNumber: null,
  oldestInvoiceCustomer: null,
  activeCasesCount: 0,
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

function riskClasses(status: string) {
  const s = status.toUpperCase();
  if (s.includes("LEGAL") || s.includes("HIGH")) return "border-red-200 bg-red-50 text-red-700";
  if (s.includes("MEDIUM")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("WATCHLIST")) return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function agingClasses(days: number) {
  if (days > 60) return "bg-red-100 text-red-700";
  if (days > 30) return "bg-orange-50 text-orange-700";
  return "bg-blue-50 text-blue-700";
}

export const OverdueAlertView: React.FC<OverdueAlertViewProps> = () => {
  const { t } = useLanguage();
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
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [onlyOverdue30, setOnlyOverdue30] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
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
      branch: "All Branches",
      search: searchQuery,
      status: selectedStatus === "All" ? "all" : selectedStatus,
      agingBucket: agingBucket === "All Buckets" ? "all" : agingBucket,
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


  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (canAssign) {
        try {
          await fetch(`/api/v1/overdue/evaluate?refresh=${Date.now()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
        } catch {
          // ignore evaluation failure during refresh
        }
      }
      loadOverdueData();
      if (selectedInvoice?.id) {
        refreshAssignmentHistory(selectedInvoice.id);
      }
      fetch(`/api/v1/overdue/staff?refresh=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
        .then(async (res) => (await readJsonResponse<{ staff?: StaffOption[] }>(res))?.staff)
        .then((staff) => { if (staff) setStaffOptions(staff); })
        .catch(() => {});
      showToast("Overdue alerts data refreshed.");
    } finally {
      // loading state managed by loadOverdueData
    }
  };

  const kpi = kpiSummary ?? EMPTY_KPI;
  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const paginatedInvoices = invoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
            <p className="mt-1 max-w-2xl text-xs text-slate-500">{t("overdue.subtitle", "Monitor overdue receivables and track customer collection status.")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void handleRefresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-wait disabled:opacity-60 cursor-pointer">
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />{t("common.refresh", "Refresh")}
            </button>
          </div>
        </section>

        {loading ? <KpiSkeleton /> : (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={t("overdue.cardTotalInvoices", "Total Overdue Invoices")}
              value={`${kpi.totalOverdueInvoices ?? kpi.affectedInvoicesCount}`}
              detail={t("overdue.cardTotalInvoicesDetail", "Total quantity of overdue invoices")}
            />
            <KpiCard
              label={t("overdue.cardTotalAmount", "Total Overdue Amount")}
              value={formatRupiah(kpi.totalOverdueAmount ?? kpi.totalOverdueValue)}
              detail={t("overdue.cardTotalAmountDetail", "Accumulated unpaid receivables")}
            />
            <KpiCard
              label={t("overdue.cardOldestInvoice", "Oldest Invoice")}
              value={`${kpi.oldestInvoiceDays ?? 0} ${t("common.days", "Days")}`}
              detail={kpi.oldestInvoiceNumber ? `${kpi.oldestInvoiceNumber} · ${kpi.oldestInvoiceCustomer ?? ""}` : t("overdue.cardOldestInvoiceDetail", "Longest overdue delay")}
              accent="text-red-600"
            />
            <KpiCard
              label={t("overdue.cardActiveCases", "Active Cases")}
              value={`${kpi.activeCasesCount ?? kpi.totalActiveCustomers} ${t("common.customer", "Customers")}`}
              detail={t("overdue.cardActiveCasesDetail", "Customers with active overdue receivables")}
              accent="text-blue-700"
            />
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <label className="relative block min-w-0 flex-1 xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("overdue.searchPlaceholder", "Search invoice number, customer, or tax ID...")} className="w-full rounded-md border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
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
                  items={[
                    { id: "all", label: "All" },
                    { id: "high", label: "High Risk" },
                    { id: "medium", label: "Medium Risk" },
                    { id: "watch", label: "Watchlist" },
                    { id: "nego", label: "Negotiation" },
                  ]}
                  value={selectedStatus}
                  onChange={(item) => setSelectedStatus(item.label)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0 w-full">
          <InvoiceTable
            loading={loading}
            errorMessage={errorMessage}
            invoices={paginatedInvoices}
            selectedInvoice={selectedInvoice}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={invoices.length}
            onRetry={loadOverdueData}
            onSelect={(invoice) => { setSelectedInvoice(invoice); setCheckedIds((current) => current.includes(invoice.id) ? current.filter((id) => id === invoice.id) : [invoice.id]); }}
            onPageChange={setCurrentPage}
            onPreview={(invoice) => setPreviewModalInvoice(invoice)}
            onEdit={(invoice) => router.push(`/overdue-alert/${encodeURIComponent(invoice.id)}/edit`)}
            onCreate={(invoice) => router.push(`/overdue-alert/${encodeURIComponent(invoice.id)}/create`)}
            canAssign={canAssign}
          />
        </section>
      </main>

      {previewModalInvoice && (
        <OverdueInvoicePreviewModal
          open={Boolean(previewModalInvoice)}
          invoice={previewModalInvoice}
          assignmentHistory={assignmentHistory}
          staffOptions={staffOptions}
          canAssign={canAssign}
          onClose={() => setPreviewModalInvoice(null)}
          onEdit={(invoice) => {
            setPreviewModalInvoice(null);
            router.push(`/overdue-alert/${encodeURIComponent(invoice.id)}/edit`);
          }}
          onCreate={(invoice) => {
            setPreviewModalInvoice(null);
            router.push(`/overdue-alert/${encodeURIComponent(invoice.id)}/create`);
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
  selectedInvoice,
  currentPage,
  totalPages,
  totalItems,
  onRetry,
  onSelect,
  onPageChange,
  onPreview,
  onEdit,
  onCreate,
  canAssign = false,
}: {
  loading: boolean;
  errorMessage: string | null;
  invoices: OverdueInvoiceItem[];
  selectedInvoice: OverdueInvoiceItem | null;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onRetry: () => void;
  onSelect: (invoice: OverdueInvoiceItem) => void;
  onPageChange: (page: number) => void;
  onPreview: (invoice: OverdueInvoiceItem) => void;
  onEdit: (invoice: OverdueInvoiceItem) => void;
  onCreate: (invoice: OverdueInvoiceItem) => void;
  canAssign?: boolean;
}) {
  const { t } = useLanguage();
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const [menuInvoice, setMenuInvoice] = useState<OverdueInvoiceItem | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openActionMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionMenuId(null);
        setMenuCoords(null);
        setMenuInvoice(null);
      }
    };
    const handleDismiss = () => {
      setOpenActionMenuId(null);
      setMenuCoords(null);
      setMenuInvoice(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [openActionMenuId]);

  const toggleActionMenu = (e: React.MouseEvent<HTMLButtonElement>, inv: OverdueInvoiceItem) => {
    e.stopPropagation();
    if (openActionMenuId === inv.id) {
      setOpenActionMenuId(null);
      setMenuCoords(null);
      setMenuInvoice(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 136;
    const menuWidth = 144;
    const spaceBelow = window.innerHeight - rect.bottom;
    const isUpward = spaceBelow < menuHeight + 20;

    setMenuCoords({
      top: isUpward ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
    setOpenActionMenuId(inv.id);
    setMenuInvoice(inv);
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 font-heading">{t("overdue.tableTitle", "Overdue Invoices List")}</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">{totalItems} {t("overdue.tableSubtitle", "invoices from validated data")}</p>
        </div>
      </div>
      <div className="overflow-x-auto min-h-[440px]">
        <table className="w-full min-w-[840px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold text-slate-600">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-3">{t("overdue.colInvoice", "Invoice")}</th>
              <th className="px-3 py-3">{t("overdue.colCustomer", "Customer")}</th>
              <th className="px-3 py-3 text-right">{t("overdue.colOutstanding", "Outstanding")}</th>
              <th className="px-3 py-3 text-center">{t("overdue.colAging", "Aging")}</th>
              <th className="px-3 py-3 text-center">{t("overdue.colRiskStatus", "Risk Status")}</th>
              <th className="w-20 px-3 py-3 text-center">{t("overdue.colAction", "Action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? [1, 2, 3, 4, 5].map((item) => (
              <tr key={item}><td colSpan={6} className="px-4 py-4"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
            )) : errorMessage ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">{errorMessage}</p>
                  <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline cursor-pointer">
                    <RefreshCw className="h-3.5 w-3.5" />{t("common.refresh", "Try again")}
                  </button>
                </td>
              </tr>
            ) : !invoices.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <FileWarning className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">{t("overdue.emptyFilter", "No invoices match the selected filter.")}</p>
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const contactText = invoice.contact_person?.name && invoice.contact_person.name !== "-" && invoice.contact_person.name !== "Kontak tidak tersedia" && invoice.contact_person.name !== "Contact not available"
                  ? `${invoice.contact_person.name}${invoice.contact_person.phone && invoice.contact_person.phone !== "-" && invoice.contact_person.phone !== "Kontak tidak tersedia" && invoice.contact_person.phone !== "Contact not available" ? ` (${invoice.contact_person.phone})` : ""}`
                  : "Contact not available";
                return (
                  <tr
                    key={invoice.id}
                    onClick={() => onSelect(invoice)}
                    className={`cursor-pointer transition hover:bg-blue-50/40 ${selectedInvoice?.id === invoice.id ? "bg-blue-50/70" : "bg-white"} ${
                      openActionMenuId === invoice.id ? "relative z-30" : ""
                    }`}
                  >
                    <td className="px-3 py-3">
                      <p className="font-semibold text-blue-700">{invoice.invoice_number}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(invoice.due_date)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">{invoice.customer_name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{contactText}</p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="font-semibold text-slate-900">{formatRupiah(invoice.amount_overdue)}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{invoice.payment_note || "No payments yet"}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${agingClasses(invoice.days_overdue)}`}>{invoice.days_overdue} {t("common.days", "days")}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskClasses(invoice.risk_status)}`}>{invoice.risk_status}</span>
                    </td>
                    <td className="px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          aria-label={`Action for invoice ${invoice.invoice_number}`}
                          onClick={(event) => toggleActionMenu(event, invoice)}
                          className={`flex size-8 items-center justify-center rounded-full border transition cursor-pointer ${
                            openActionMenuId === invoice.id
                              ? "border-blue-400 bg-blue-50 text-blue-700 shadow-xs"
                              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                          }`}
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {openActionMenuId && menuCoords && menuInvoice && (
        <div
          ref={actionMenuRef}
          style={{
            position: "fixed",
            top: `${menuCoords.top}px`,
            left: `${menuCoords.left}px`,
            zIndex: 9999,
          }}
          className="w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const target = menuInvoice;
              setOpenActionMenuId(null);
              setMenuCoords(null);
              setMenuInvoice(null);
              onPreview(target);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer"
          >
            <Eye className="size-3.5 text-blue-600" />
            <span>{t("common.preview", "Preview")}</span>
          </button>
          {!canAssign && (
            <button
              type="button"
              onClick={() => {
                const target = menuInvoice;
                setOpenActionMenuId(null);
                setMenuCoords(null);
                setMenuInvoice(null);
                onCreate(target);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer"
            >
              <Plus className="size-3.5 text-blue-600" />
              <span>{t("overdue.addProgress", "Add Progress")}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const target = menuInvoice;
              setOpenActionMenuId(null);
              setMenuCoords(null);
              setMenuInvoice(null);
              onEdit(target);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition cursor-pointer"
          >
            <Pencil className="size-3.5 text-blue-600" />
            <span>{t("overdue.editLog", "Edit Log")}</span>
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {t("common.showing", "Showing")} {totalItems ? (currentPage - 1) * PAGE_SIZE + 1 : 0}-{Math.min(currentPage * PAGE_SIZE, totalItems)} {t("common.of", "of")} {totalItems} {t("common.invoices", "invoices")}
        </span>
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}

export default OverdueAlertView;
