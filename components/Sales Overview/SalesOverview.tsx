"use client";

import { useState, useRef, useEffect } from "react";
import Pagination from "@/components/Pagination";
import { AlertCircle, ArrowLeft, ArrowRight, Calendar, Download, RefreshCw, Wallet, Receipt, PieChart, Activity, HelpCircle } from "lucide-react";
import { ChartAreaStacked } from "./chart";
import { QUICK_PERIODS, matchingQuickPeriod, quickPeriodRange } from "@/lib/salesOverviewPeriod";
import { DocumentPreviewModal, RecentDocumentsPanel } from "./DocumentsPanel";
import type { RecentDocument } from "@/lib/salesOverviewDocuments";
import type { StaffOption } from "@/types/overdue";

export type { RecentDocument } from "@/lib/salesOverviewDocuments";

export type MacroPoint = { period_month: string; revenue: number; cost: number; sales_profit: number; total_outstanding: number };
export type MacroSummary = { revenue: number; cost: number; sales_profit: number; total_outstanding: number } | null;
export type AlertRow = {
  id: string;
  days: number;
  client: string;
  due: string;
  amount: number;
  riskStatus?: string;
  branch?: string;
  branchCode?: string;
  picAssigned?: string | null;
  customerId?: string;
};

type Props = {
  summary: MacroSummary;
  series: MacroPoint[];
  startPeriod: string;
  endPeriod: string;
  onStartPeriodChange: (value: string) => void;
  onEndPeriodChange: (value: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  error: string | null;
  alerts?: AlertRow[];
  documents: RecentDocument[];
  documentsLoading: boolean;
  documentsError: string | null;
  staffOptions?: StaffOption[];
  staffLoading?: boolean;
  canAssign?: boolean;
};

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function periodParts(period: string) {
  const [year, month] = period.split("-").map(Number);
  return { year, month };
}

function periodIndex(period: string) {
  const { year, month } = periodParts(period);
  return year * 12 + month;
}

function periodLabel(period: string) {
  const { year, month } = periodParts(period);
  return `${monthNames[(month || 1) - 1]} ${year}`;
}

function MonthRangePicker({ startPeriod, endPeriod, onStartPeriodChange, onEndPeriodChange, disabled, buttonLabel }: Pick<Props, "startPeriod" | "endPeriod" | "onStartPeriodChange" | "onEndPeriodChange"> & { disabled: boolean; buttonLabel?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => periodParts(endPeriod).year);
  const [draftStart, setDraftStart] = useState(startPeriod);
  const [draftEnd, setDraftEnd] = useState(endPeriod);
  const [selecting, setSelecting] = useState<"start" | "end">("start");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setSelecting("start");
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setIsOpen(false); setSelecting("start"); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [isOpen]);

  function cancelPicker() {
    setDraftStart(startPeriod); setDraftEnd(endPeriod); setSelecting("start"); setIsOpen(false); triggerRef.current?.focus();
  }

  function openPicker() {
    if (isOpen) { cancelPicker(); return; }
    setDraftStart(startPeriod);
    setDraftEnd(endPeriod);
    setCalendarYear(periodParts(endPeriod).year);
    setSelecting("start");
    setIsOpen(true);
  }

  function chooseMonth(month: number) {
    const value = `${calendarYear}-${String(month).padStart(2, "0")}`;
    if (selecting === "start") {
      setDraftStart(value);
      setDraftEnd("");
      setSelecting("end");
      return;
    }

    const normalizedStart = periodIndex(value) < periodIndex(draftStart) ? value : draftStart;
    const normalizedEnd = periodIndex(value) < periodIndex(draftStart) ? draftStart : value;
    setDraftStart(normalizedStart);
    setDraftEnd(normalizedEnd);
    onStartPeriodChange(normalizedStart);
    onEndPeriodChange(normalizedEnd);
    setIsOpen(false);
    setSelecting("start");
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <button ref={triggerRef} type="button" onClick={openPicker} disabled={disabled} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${buttonLabel ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50" : "border-slate-200 bg-white text-slate-600"}`} aria-label={buttonLabel ? `${buttonLabel}: ${periodLabel(startPeriod)} - ${periodLabel(endPeriod)}` : undefined} aria-expanded={isOpen} aria-haspopup="dialog">
        <Calendar className="size-4 text-indigo-600" />
        <span>{buttonLabel ?? `${periodLabel(startPeriod)} - ${periodLabel(endPeriod)}`}</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-30 sm:left-auto sm:right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl" role="dialog" aria-label="Select month range">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setCalendarYear((year) => year - 1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Previous year"><ArrowLeft className="size-4" /></button>
            <span className="text-sm font-bold text-slate-900 font-heading">{calendarYear}</span>
            <button type="button" onClick={() => setCalendarYear((year) => year + 1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Next year"><ArrowRight className="size-4" /></button>
          </div>
          <p className="mb-3 text-xs text-slate-500">{selecting === "start" ? "Select start month" : "Select end month"}</p>
          <div className="grid grid-cols-3 gap-2">
            {monthNames.map((name, index) => {
              const value = `${calendarYear}-${String(index + 1).padStart(2, "0")}`;
              const isStart = value === draftStart;
              const isEnd = value === draftEnd;
              const inRange = draftStart && draftEnd && periodIndex(value) > periodIndex(draftStart) && periodIndex(value) < periodIndex(draftEnd);
              return <button key={value} type="button" onClick={() => chooseMonth(index + 1)} className={`rounded-md px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${isEnd ? "bg-[#3B6FF5] text-white" : isStart ? "bg-blue-200 text-blue-900" : inRange ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-100"}`}>{name}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-500">
            <span><i className="mr-1 inline-block size-2 rounded-sm bg-blue-200" />Start</span>
            <span><i className="mr-1 inline-block size-2 rounded-sm bg-[#3B6FF5]" />End</span>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {selecting === "end" && <button type="button" onClick={() => { setSelecting("start"); setDraftStart(startPeriod); setDraftEnd(endPeriod); }} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 cursor-pointer">Back</button>}
            <button type="button" onClick={cancelPicker} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickPeriodFilters({ startPeriod, endPeriod, onStartPeriodChange, onEndPeriodChange, disabled }: Pick<Props, "startPeriod" | "endPeriod" | "onStartPeriodChange" | "onEndPeriodChange"> & { disabled: boolean }) {
  const activeMonths = matchingQuickPeriod(startPeriod, endPeriod);
  return <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1" role="group" aria-label="Quick period filters">
    {QUICK_PERIODS.map((period) => {
      const active = activeMonths === period.months;
      return <button key={period.months} type="button" onClick={() => { const range = quickPeriodRange(endPeriod, period.months); onStartPeriodChange(range.startPeriod); onEndPeriodChange(range.endPeriod); }} disabled={disabled} aria-pressed={active} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${active ? "bg-[#3B6FF5] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>{period.label}</button>;
    })}
    <MonthRangePicker startPeriod={startPeriod} endPeriod={endPeriod} onStartPeriodChange={onStartPeriodChange} onEndPeriodChange={onEndPeriodChange} disabled={disabled} buttonLabel="Custom" />
  </div>;
}

export default function SalesOverview({ summary, series, startPeriod, endPeriod, onStartPeriodChange, onEndPeriodChange, onRefresh, isLoading, error, alerts = [], documents, documentsLoading, documentsError, staffOptions = [], staffLoading = false, canAssign = false }: Props) {
  const hasMacro = Boolean(summary);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  async function exportCsv() {
    if (isExporting || isLoading) return;
    setIsExporting(true);
    try {
      const response = await fetch(`/api/v1/analytics/macro/export?start_period=${startPeriod}&end_period=${endPeriod}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to export CSV.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales-overview-${startPeriod}-${endPeriod}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }
  function openOriginal(documentId: string) {
    window.open(`/api/v1/documents/${documentId}/download`, "_blank", "noopener,noreferrer");
  }
  return (
    <main className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-heading">Sales Overview</h1>
          <div className="flex flex-wrap items-center gap-3">
            <QuickPeriodFilters startPeriod={startPeriod} endPeriod={endPeriod} onStartPeriodChange={onStartPeriodChange} onEndPeriodChange={onEndPeriodChange} disabled={isLoading} />
            <button type="button" onClick={() => void exportCsv()} disabled={isLoading || isExporting} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer" aria-label="Export analytics summary"><Download className="size-4" />{isExporting ? "Exporting..." : "Export CSV"}</button>
            <button type="button" onClick={onRefresh} disabled={isLoading} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60 cursor-pointer"><RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />Refresh</button>
          </div>
        </header>
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold text-slate-500 font-heading">Monthly Macro Analytics</h2></div>
          {error ? <PanelError message={error} onRetry={onRefresh} /> : isLoading ? <MetricSkeleton /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"><MetricCard label="Sales Profit Period" value={hasMacro ? money.format(summary?.sales_profit ?? 0) : "-"} detail="Total Revenue - Cost" formula="Sales Profit = Revenue - Cost" icon={<Wallet className="size-4" />} empty={!hasMacro} /><MetricCard label="Cost Requirement Period" value={hasMacro ? money.format(summary?.cost ?? 0) : "-"} detail="Total operational costs" icon={<Receipt className="size-4" />} empty={!hasMacro} /><MetricCard label="Outstanding Period" value={hasMacro ? money.format(summary?.total_outstanding ?? 0) : "-"} detail="Total uncollected invoices" icon={<AlertCircle className="size-4" />} empty={!hasMacro} /><MetricCard label="Net Margin Ratio" value={summary && summary.revenue ? `${((summary.sales_profit / summary.revenue) * 100).toFixed(1)}%` : "-"} detail="Ratio across selected period" formula="Net Margin Ratio = (Sales Profit / Revenue) x 100" icon={<PieChart className="size-4" />} empty={!hasMacro} /></div>}
        </section>
        <PeakMetrics series={series} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
        <section aria-label="Sales Overview Charts" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartAreaStacked title="Sales & Cost Performance Trend" series={series} metrics={["revenue", "cost", "total_outstanding"]} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
          <ChartAreaStacked title="Revenue" series={series} metrics={["revenue"]} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
          <ChartAreaStacked title="Cost" series={series} metrics={["cost"]} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
          <ChartAreaStacked title="Total Outstanding" series={series} metrics={["total_outstanding"]} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
        </section>
        <AlertPanel alerts={alerts} loading={isLoading} staffOptions={staffOptions} staffLoading={staffLoading} canAssign={canAssign} onRefresh={onRefresh} />
        <RecentDocumentsPanel documents={documents} loading={documentsLoading} error={documentsError} onPreview={setPreviewDocumentId} onOpenOriginal={(id) => void openOriginal(id)} />
      </div>
      {previewDocumentId && <DocumentPreviewModal documentId={previewDocumentId} onClose={() => setPreviewDocumentId(null)} />}
    </main>
  );
}

function MetricCard({ label, value, detail, formula, icon, empty }: { label: string; value: string; detail: string; formula?: string; icon: React.ReactNode; empty: boolean }) { return <article className="min-h-32 rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><div className="flex items-center gap-1.5"><h3 className="text-xs font-semibold text-slate-600 font-heading">{label}</h3>{formula && <span className="group relative inline-flex"><button type="button" className="inline-flex size-4 items-center justify-center rounded-full border border-blue-200 text-blue-600" aria-label={`Formula for ${label}`} title={formula}><HelpCircle className="size-3" /></button><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-2 text-left text-[11px] font-medium normal-case tracking-normal text-white shadow-lg group-hover:block group-focus-within:block">{formula}</span></span>}</div><p className="text-[11px] text-slate-400">{detail}</p></div><span className="rounded bg-blue-50 p-1.5 text-blue-600">{icon}</span></div><p className={`mt-4 text-2xl font-bold tracking-tight font-heading ${empty ? "text-slate-400" : "text-slate-900"}`}>{value}</p><div className="mt-3 flex items-center gap-1 text-xs text-slate-500">{empty ? "No data yet" : <><Activity className="size-3.5 text-teal-600" />Validated</>}</div></article>; }
function AlertPanel({ alerts, loading, staffOptions, staffLoading, canAssign, onRefresh }: { alerts: AlertRow[]; loading: boolean; staffOptions: StaffOption[]; staffLoading: boolean; canAssign: boolean; onRefresh: () => void }) {
  const pageSize = 5;
  const alertsVersion = alerts.map((alert) => `${alert.id}:${alert.due}:${alert.amount}`).join("|");
  const [pageState, setPageState] = useState({ version: alertsVersion, page: 1 });
  const ordered = [...alerts].sort((a, b) => a.due.localeCompare(b.due));
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = pageState.version === alertsVersion ? Math.min(pageState.page, totalPages) : 1;
  const visible = ordered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900 font-heading">Overdue Alerts List</h2><p className="mb-4 text-xs text-slate-500">Validated invoices exceeding 30 days, sorted by oldest due date.</p>{loading ? <AlertSkeleton /> : ordered.length ? <><div className="space-y-3">{visible.map((alert, index) => <AlertCard key={`alert-row-${alert.id}-${alert.due}-${(currentPage - 1) * pageSize + index}`} alert={alert} staffOptions={staffOptions} staffLoading={staffLoading} canAssign={canAssign} onRefresh={onRefresh} />)}</div>{totalPages > 1 && <div className="mt-5 flex min-w-0 justify-center overflow-hidden"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(nextPage) => setPageState({ version: alertsVersion, page: nextPage })} /></div>}</> : <PanelEmpty text="No overdue alert data found." />}</section>;
}

function AlertCard({ alert, staffOptions, staffLoading, canAssign, onRefresh }: { alert: AlertRow; staffOptions: StaffOption[]; staffLoading: boolean; canAssign: boolean; onRefresh: () => void }) {
  const [selectedStaff, setSelectedStaff] = useState("");
  const [saving, setSaving] = useState(false);
  async function assign() {
    if (!selectedStaff || !canAssign) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(alert.id)}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedTo: selectedStaff }) });
      if (!response.ok) throw new Error("Assignment failed.");
      setSelectedStaff("");
      onRefresh();
    } finally { setSaving(false); }
  }
  return <div className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between text-xs font-bold"><span>{alert.id}</span><span className="text-red-600">{alert.days} Days</span></div><p className="mt-1 text-sm font-semibold text-indigo-700">{alert.client}</p><p className="text-[10px] text-slate-500">Due: {alert.due} · {money.format(alert.amount)}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><span>{alert.branch || "Branch unavailable"}</span>{alert.picAssigned && <span>PIC: {alert.picAssigned}</span>}{alert.riskStatus && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">{alert.riskStatus}</span>}</div>{!alert.picAssigned && <div className="mt-2 flex gap-2"><select value={selectedStaff} onChange={(event) => setSelectedStaff(event.target.value)} disabled={!canAssign || staffLoading || !staffOptions.length} className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px]" aria-label={`Select PIC for ${alert.id}`}><option value="">{staffLoading ? "Loading staff..." : !canAssign ? "Unauthorized" : "Select PIC"}</option>{staffOptions.map((staff) => <option key={staff.employee_id} value={staff.employee_id}>{staff.full_name} ({staff.employee_id})</option>)}</select><button type="button" onClick={() => void assign()} disabled={!selectedStaff || saving || !canAssign} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50 cursor-pointer">{saving ? "..." : "Assign PIC"}</button></div>}</div>;
}
function PeakMetrics({ series, startPeriod, endPeriod, loading, error }: { series: MacroPoint[]; startPeriod: string; endPeriod: string; loading: boolean; error: string | null }) {
  const selected = series.filter(point => point.period_month >= startPeriod && point.period_month <= endPeriod).sort((a, b) => b.period_month.localeCompare(a.period_month));
  const metrics = [{ key: "revenue", label: "Peak Revenue", icon: <Wallet className="size-4" /> }, { key: "cost", label: "Peak Cost", icon: <Receipt className="size-4" /> }, { key: "total_outstanding", label: "Peak Outstanding", icon: <AlertCircle className="size-4" /> }] as const;
  return <section aria-label="Peak metrics" className="space-y-3"><div className="text-xs font-semibold text-slate-500">{periodLabel(startPeriod)} - {periodLabel(endPeriod)}</div><div className="grid grid-cols-1 gap-4 md:grid-cols-3">{metrics.map(metric => {
    const maximum = selected.length ? Math.max(...selected.map(point => point[metric.key])) : null;
    const matching = selected.filter(point => point[metric.key] === maximum);
    return <article key={metric.key} aria-label={metric.label} aria-busy={loading} className="min-w-0 rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-700 font-heading">{metric.label}</h3><span className="rounded bg-blue-50 p-1.5 text-blue-600">{metric.icon}</span></div>{loading ? <div className="mt-4 animate-pulse space-y-3" aria-label={`Loading ${metric.label}`}><div className="h-7 w-3/4 rounded bg-slate-200" /><div className="h-3 w-1/2 rounded bg-slate-200" /><div className="h-3 w-2/3 rounded bg-slate-200" /></div> : error ? <p role="alert" className="mt-4 text-sm text-red-700">Data could not be loaded.</p> : maximum === null ? <p className="mt-4 text-sm text-slate-500">No data yet</p> : <><p className="mt-4 break-words text-2xl font-bold text-slate-900 font-heading">{money.format(maximum)}</p><p className="mt-2 text-sm text-slate-500">{periodLabel(matching[0].period_month)}</p>{matching.length > 1 && <p className="mt-2 text-xs text-slate-500">The same value was also reached in {matching.length - 1} other months.</p>}</>}</article>;
  })}</div></section>;
}
function MetricSkeleton() { return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-white p-5"><div className="h-3 w-32 rounded bg-slate-200" /><div className="mt-6 h-7 w-40 rounded bg-slate-200" /><div className="mt-3 h-3 w-24 rounded bg-slate-200" /></div>)}</div>; }
function AlertSkeleton() { return <div className="space-y-3" aria-label="Loading alerts">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="animate-pulse rounded-lg bg-slate-50 p-3"><div className="flex justify-between"><div className="h-3 w-24 rounded bg-slate-200" /><div className="h-3 w-14 rounded bg-slate-200" /></div><div className="mt-3 h-4 w-36 rounded bg-slate-200" /><div className="mt-2 h-3 w-48 rounded bg-slate-200" /><div className="mt-3 h-5 w-20 rounded bg-slate-200" /></div>)}</div>; }
function PanelEmpty({ text }: { text: string }) { return <div className="my-6 rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">{text}</div>; }
function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="my-6 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700"><AlertCircle className="mx-auto mb-2 size-5" />{message}{onRetry && <button type="button" onClick={onRetry} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RefreshCw className="size-3" />Retry</button>}</div>; }
