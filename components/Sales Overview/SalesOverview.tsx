"use client";

import { useState, useRef, useEffect } from "react";
import Pagination from "@/components/Pagination";
import { AlertCircle, ArrowLeft, ArrowRight, Calendar, Download, FileUp, RefreshCw, Wallet, Receipt, PieChart, Activity, HelpCircle } from "lucide-react";
import { ChartAreaStacked } from "./chart";
import UploadForm, { UploadResult } from "@/components/UploadForm/uploadform";

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
  canUpload?: boolean;
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

function MonthRangePicker({ startPeriod, endPeriod, onStartPeriodChange, onEndPeriodChange, disabled }: Pick<Props, "startPeriod" | "endPeriod" | "onStartPeriodChange" | "onEndPeriodChange"> & { disabled: boolean }) {
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
      <button ref={triggerRef} type="button" onClick={openPicker} disabled={disabled} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-60" aria-expanded={isOpen} aria-haspopup="dialog">
        <Calendar className="size-4 text-indigo-600" />
        <span>{periodLabel(startPeriod)} - {periodLabel(endPeriod)}</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-30 sm:left-auto sm:right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl" role="dialog" aria-label="Pilih rentang bulan">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setCalendarYear((year) => year - 1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tahun sebelumnya"><ArrowLeft className="size-4" /></button>
            <span className="text-sm font-bold text-slate-900">{calendarYear}</span>
            <button type="button" onClick={() => setCalendarYear((year) => year + 1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Tahun berikutnya"><ArrowRight className="size-4" /></button>
          </div>
          <p className="mb-3 text-xs text-slate-500">{selecting === "start" ? "Pilih bulan mulai" : "Pilih bulan akhir"}</p>
          <div className="grid grid-cols-3 gap-2">
            {monthNames.map((name, index) => {
              const value = `${calendarYear}-${String(index + 1).padStart(2, "0")}`;
              const isStart = value === draftStart;
              const isEnd = value === draftEnd;
              const inRange = draftStart && draftEnd && periodIndex(value) > periodIndex(draftStart) && periodIndex(value) < periodIndex(draftEnd);
              return <button key={value} type="button" onClick={() => chooseMonth(index + 1)} className={`rounded-md px-2 py-2 text-xs font-semibold transition-colors ${isEnd ? "bg-[#203d70] text-white" : isStart ? "bg-blue-200 text-blue-900" : inRange ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-100"}`}>{name}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-500">
            <span><i className="mr-1 inline-block size-2 rounded-sm bg-blue-200" />Mulai</span>
            <span><i className="mr-1 inline-block size-2 rounded-sm bg-[#203d70]" />Akhir</span>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            {selecting === "end" && <button type="button" onClick={() => { setSelecting("start"); setDraftStart(startPeriod); setDraftEnd(endPeriod); }} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Kembali</button>}
            <button type="button" onClick={cancelPicker} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesOverview({ summary, series, startPeriod, endPeriod, onStartPeriodChange, onEndPeriodChange, onRefresh, isLoading, error, alerts = [], canUpload = false }: Props) {
  const hasMacro = Boolean(summary);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  function handleUploadCompleted(result: UploadResult) {
    if (result.validationStatus === "validated") onRefresh();
  }
  return (
    <main className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">Sales Overview</h1>
          <div className="flex flex-wrap items-center gap-3">
            <MonthRangePicker startPeriod={startPeriod} endPeriod={endPeriod} onStartPeriodChange={onStartPeriodChange} onEndPeriodChange={onEndPeriodChange} disabled={isLoading} />
            <button type="button" onClick={onRefresh} disabled={isLoading} className="inline-flex items-center gap-2 rounded-md bg-[#203d70] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"><RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />Refresh</button>
          </div>
        </header>
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Monthly Macro Analytics</h2></div>
          {error ? <PanelError message={error} onRetry={onRefresh} /> : isLoading ? <MetricSkeleton /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"><MetricCard label="Sales Profit Bulanan" value={hasMacro ? money.format(summary?.sales_profit ?? 0) : "-"} detail="Revenue - Cost" formula="Sales Profit = Revenue - Cost" icon={<Wallet className="size-4" />} empty={!hasMacro} /><MetricCard label="Kebutuhan Cost Bulanan" value={hasMacro ? money.format(summary?.cost ?? 0) : "-"} detail="Real Operational Cost" icon={<Receipt className="size-4" />} empty={!hasMacro} /><MetricCard label="Total Outstanding" value={hasMacro ? money.format(summary?.total_outstanding ?? 0) : "-"} detail="Uncollected Invoices" icon={<AlertCircle className="size-4" />} empty={!hasMacro} /><MetricCard label="Net Margin Ratio" value={summary && summary.revenue ? `${((summary.sales_profit / summary.revenue) * 100).toFixed(1)}%` : "-"} detail="Operating Threshold" formula="Net Margin Ratio = (Sales Profit / Revenue) x 100" icon={<PieChart className="size-4" />} empty={!hasMacro} /></div>}
        </section>
        <section aria-label="Grafik Sales Overview" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartAreaStacked title="Pergerakan Performa Sales & Cost" series={series} metrics={["revenue", "cost", "total_outstanding"]} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
          <ChartAreaStacked title="Revenue" series={series} metrics={["revenue"]} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
          <ChartAreaStacked title="Cost" series={series} metrics={["cost"]} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
          <ChartAreaStacked title="Total Outstanding" series={series} metrics={["total_outstanding"]} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
        </section>
        <AlertPanel alerts={alerts} loading={isLoading} />
        <PeakMetrics series={series} startPeriod={startPeriod} endPeriod={endPeriod} loading={isLoading} error={error} />
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {canUpload && <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-2"><h2 className="text-lg font-bold text-slate-900">Unggah & Ekspor Dokumen</h2><p className="mt-1 text-sm text-slate-500">Unggah Company Sales Report atau Data Outstanding untuk memperbarui dashboard.</p><button type="button" onClick={() => setIsUploadOpen(true)} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#3B6FF5] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-600"><FileUp className="size-4" />Unggah Berkas Report</button></div>}
          <div className={`rounded-xl border border-slate-100 bg-slate-50 p-6 shadow-sm ${canUpload ? "" : "md:col-span-3"}`}><h2 className="text-base font-bold text-slate-900">Ekspor Ringkasan Analitik</h2><p className="mt-2 text-sm text-slate-500">Export belum tersedia.</p><button type="button" disabled className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-300 py-3 text-sm font-bold text-slate-500"><Download className="size-4" />Ekspor (Segera)</button></div>
        </section>
      </div>
      {canUpload && <UploadForm open={isUploadOpen} onClose={() => setIsUploadOpen(false)} onCompleted={handleUploadCompleted} />}
    </main>
  );
}

function MetricCard({ label, value, detail, formula, icon, empty }: { label: string; value: string; detail: string; formula?: string; icon: React.ReactNode; empty: boolean }) { return <article className="min-h-32 rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><div className="flex items-center gap-1.5"><h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</h3>{formula && <span className="group relative inline-flex"><button type="button" className="inline-flex size-4 items-center justify-center rounded-full border border-blue-200 text-blue-600" aria-label={`Rumus ${label}`} title={formula}><HelpCircle className="size-3" /></button><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-2 text-left text-[11px] font-medium normal-case tracking-normal text-white shadow-lg group-hover:block group-focus-within:block">{formula}</span></span>}</div><p className="text-[10px] text-slate-400">{detail}</p></div><span className="rounded bg-blue-50 p-1.5 text-blue-600">{icon}</span></div><p className={`mt-4 text-2xl font-bold tracking-tight ${empty ? "text-slate-400" : "text-slate-900"}`}>{value}</p><div className="mt-3 flex items-center gap-1 text-xs text-slate-500">{empty ? "Belum ada data" : <><Activity className="size-3.5 text-teal-600" />Validated</>}</div></article>; }
function AlertPanel({ alerts, loading }: { alerts: AlertRow[]; loading: boolean }) {
  const pageSize = 5;
  const alertsVersion = alerts.map((alert) => `${alert.id}:${alert.due}:${alert.amount}`).join("|");
  const [pageState, setPageState] = useState({ version: alertsVersion, page: 1 });
  const ordered = [...alerts].sort((a, b) => a.due.localeCompare(b.due));
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = pageState.version === alertsVersion ? Math.min(pageState.page, totalPages) : 1;
  const visible = ordered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Daftar Alerts Overdue</h2><p className="mb-4 text-xs text-slate-500">Invoice tervalidasi yang melewati 30 hari, diurutkan dari yang paling lama.</p>{loading ? <AlertSkeleton /> : ordered.length ? <><div className="space-y-3">{visible.map((alert, index) => <div key={`alert-row-${alert.id}-${alert.due}-${(currentPage - 1) * pageSize + index}`} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between text-xs font-bold"><span>{alert.id}</span><span className="text-red-600">{alert.days} Hari</span></div><p className="mt-1 text-sm font-semibold text-indigo-700">{alert.client}</p><p className="text-[10px] text-slate-500">Due: {alert.due} - {money.format(alert.amount)}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><span>{alert.branch || "Cabang belum tersedia"}</span>{alert.picAssigned && <span>PIC: {alert.picAssigned}</span>}{alert.riskStatus && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">{alert.riskStatus}</span>}</div><button type="button" disabled className="mt-2 rounded bg-slate-300 px-2 py-1 text-[10px] text-slate-500">Assign (Segera)</button></div>)}</div>{totalPages > 1 && <div className="mt-5 flex min-w-0 justify-center overflow-hidden"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={(nextPage) => setPageState({ version: alertsVersion, page: nextPage })} /></div>}</> : <PanelEmpty text="Belum ada data overdue alert." />}</section>;
}
function PeakMetrics({ series, startPeriod, endPeriod, loading, error }: { series: MacroPoint[]; startPeriod: string; endPeriod: string; loading: boolean; error: string | null }) {
  const selected = series.filter(point => point.period_month >= startPeriod && point.period_month <= endPeriod).sort((a, b) => b.period_month.localeCompare(a.period_month));
  const metrics = [{ key: "revenue", label: "Revenue Tertinggi", icon: <Wallet className="size-4" /> }, { key: "cost", label: "Cost Tertinggi", icon: <Receipt className="size-4" /> }, { key: "total_outstanding", label: "Outstanding Tertinggi", icon: <AlertCircle className="size-4" /> }] as const;
  return <section aria-label="Nilai bulanan tertinggi" className="space-y-4"><div><h2 className="text-lg font-bold text-slate-900">Nilai Bulanan Tertinggi dalam Periode</h2><p className="text-sm text-slate-500">{periodLabel(startPeriod)} - {periodLabel(endPeriod)}</p></div><div className="grid grid-cols-1 gap-4 md:grid-cols-3">{metrics.map(metric => {
    const maximum = selected.length ? Math.max(...selected.map(point => point[metric.key])) : null;
    const matching = selected.filter(point => point[metric.key] === maximum);
    return <article key={metric.key} aria-label={metric.label} aria-busy={loading} className="min-w-0 rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-700">{metric.label}</h3><span className="rounded bg-blue-50 p-1.5 text-blue-600">{metric.icon}</span></div>{loading ? <div className="mt-4 animate-pulse space-y-3" aria-label={`Memuat ${metric.label}`}><div className="h-7 w-3/4 rounded bg-slate-200" /><div className="h-3 w-1/2 rounded bg-slate-200" /><div className="h-3 w-2/3 rounded bg-slate-200" /></div> : error ? <p role="alert" className="mt-4 text-sm text-red-700">Data tidak dapat dimuat.</p> : maximum === null ? <p className="mt-4 text-sm text-slate-500">Belum ada data</p> : <><p className="mt-4 break-words text-2xl font-bold text-slate-900">{money.format(maximum)}</p><p className="mt-2 text-sm text-slate-500">{periodLabel(matching[0].period_month)}</p>{matching.length > 1 && <p className="mt-2 text-xs text-slate-500">Nilai yang sama juga dicapai pada {matching.length - 1} bulan lain.</p>}</>}</article>;
  })}</div></section>;
}
function MetricSkeleton() { return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-white p-5"><div className="h-3 w-32 rounded bg-slate-200" /><div className="mt-6 h-7 w-40 rounded bg-slate-200" /><div className="mt-3 h-3 w-24 rounded bg-slate-200" /></div>)}</div>; }
function AlertSkeleton() { return <div className="space-y-3" aria-label="Memuat alerts">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="animate-pulse rounded-lg bg-slate-50 p-3"><div className="flex justify-between"><div className="h-3 w-24 rounded bg-slate-200" /><div className="h-3 w-14 rounded bg-slate-200" /></div><div className="mt-3 h-4 w-36 rounded bg-slate-200" /><div className="mt-2 h-3 w-48 rounded bg-slate-200" /><div className="mt-3 h-5 w-20 rounded bg-slate-200" /></div>)}</div>; }
function PanelEmpty({ text }: { text: string }) { return <div className="my-6 rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">{text}</div>; }
function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="my-6 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700"><AlertCircle className="mx-auto mb-2 size-5" />{message}{onRetry && <button type="button" onClick={onRetry} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RefreshCw className="size-3" />Retry</button>}</div>; }
