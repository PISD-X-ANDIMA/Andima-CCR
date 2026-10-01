"use client";

import { useState } from "react";
import Pagination from "@/components/Pagination";
import { AlertCircle, ArrowLeft, ArrowRight, Calendar, Download, FileUp, Info, RefreshCw, Search, Wallet, Receipt, PieChart, Activity, HelpCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import UploadForm, { UploadResult } from "@/components/UploadForm/uploadform";

export type MacroPoint = { period_month: string; revenue: number; cost: number; sales_profit: number; total_outstanding: number };
export type MacroSummary = { revenue: number; cost: number; sales_profit: number; total_outstanding: number } | null;
export type BranchRow = { id: string; code: string; city: string; hub: string; pic: string; role: string; profit: string; profitTrend: string; cost: string; outstanding: string; status: string; sparkline: number[] };
export type AlertRow = { id: string; days: number; client: string; due: string; amount: number };

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
  branchRows?: BranchRow[];
  alerts?: AlertRow[];
  canUpload?: boolean;
};

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
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

  function openPicker() {
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
  }

  return (
    <div className="relative">
      <button type="button" onClick={openPicker} disabled={disabled} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-60" aria-expanded={isOpen} aria-haspopup="dialog">
        <Calendar className="size-4 text-indigo-600" />
        <span>{periodLabel(startPeriod)} - {periodLabel(endPeriod)}</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl" role="dialog" aria-label="Pilih rentang bulan">
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
        </div>
      )}
    </div>
  );
}

export default function SalesOverview({ summary, series, startPeriod, endPeriod, onStartPeriodChange, onEndPeriodChange, onRefresh, isLoading, error, branchRows = [], alerts = [], canUpload = false }: Props) {
  const hasMacro = Boolean(summary);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  function handleUploadCompleted(result: UploadResult) {
    if (result.validationStatus === "validated") onRefresh();
  }
  return (
    <main className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">CCR: Sales Overview</h1>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input placeholder="Search Customer, Invoice, or Period..." className="w-72 rounded-md border-0 bg-slate-100 py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500" disabled={isLoading} />
            </label>
            <MonthRangePicker startPeriod={startPeriod} endPeriod={endPeriod} onStartPeriodChange={onStartPeriodChange} onEndPeriodChange={onEndPeriodChange} disabled={isLoading} />
            <button type="button" onClick={onRefresh} disabled={isLoading} className="inline-flex items-center gap-2 rounded-md bg-[#203d70] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"><RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />Refresh</button>
          </div>
        </header>
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Monthly Macro Analytics</h2><span className="text-xs text-slate-500">Live Reconciliation</span></div>
          {error ? <PanelError message={error} onRetry={onRefresh} /> : isLoading ? <MetricSkeleton /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"><MetricCard label="Sales Profit Bulanan" value={hasMacro ? money.format(summary?.sales_profit ?? 0) : "-"} detail="Revenue - Cost" formula="Sales Profit = Revenue - Cost" icon={<Wallet className="size-4" />} empty={!hasMacro} /><MetricCard label="Kebutuhan Cost Bulanan" value={hasMacro ? money.format(summary?.cost ?? 0) : "-"} detail="Real Operational Cost" icon={<Receipt className="size-4" />} empty={!hasMacro} /><MetricCard label="Total Outstanding" value={hasMacro ? money.format(summary?.total_outstanding ?? 0) : "-"} detail="Uncollected Invoices" icon={<AlertCircle className="size-4" />} empty={!hasMacro} /><MetricCard label="Net Margin Ratio" value={summary && summary.revenue ? `${((summary.sales_profit / summary.revenue) * 100).toFixed(1)}%` : "-"} detail="Operating Threshold" formula="Net Margin Ratio = (Sales Profit / Revenue) x 100" icon={<PieChart className="size-4" />} empty={!hasMacro} /></div>}
        </section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><ChartPanel series={series} loading={isLoading} error={error} /><AlertPanel alerts={alerts} loading={isLoading} /></div>
        <BranchPanel rows={branchRows} />
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {canUpload && <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm md:col-span-2"><h2 className="text-lg font-bold text-slate-900">4. Unggah & Ekspor Dokumen</h2><p className="mt-1 text-sm text-slate-500">Unggah Company Sales Report atau Data Outstanding untuk memperbarui dashboard.</p><button type="button" onClick={() => setIsUploadOpen(true)} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#3B6FF5] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-600"><FileUp className="size-4" />Unggah Berkas Report</button></div>}
          <div className={`rounded-xl border border-slate-100 bg-slate-50 p-6 shadow-sm ${canUpload ? "" : "md:col-span-3"}`}><h2 className="text-base font-bold text-slate-900">Ekspor Ringkasan Analitik</h2><p className="mt-2 text-sm text-slate-500">Export belum tersedia.</p><button type="button" disabled className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-300 py-3 text-sm font-bold text-slate-500"><Download className="size-4" />Ekspor (Segera)</button></div>
        </section>
      </div>
      {canUpload && <UploadForm open={isUploadOpen} onClose={() => setIsUploadOpen(false)} onCompleted={handleUploadCompleted} />}
    </main>
  );
}

function MetricCard({ label, value, detail, formula, icon, empty }: { label: string; value: string; detail: string; formula?: string; icon: React.ReactNode; empty: boolean }) { return <article className="min-h-32 rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><div className="flex items-center gap-1.5"><h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</h3>{formula && <span className="group relative inline-flex"><button type="button" className="inline-flex size-4 items-center justify-center rounded-full border border-blue-200 text-blue-600" aria-label={`Rumus ${label}`} title={formula}><HelpCircle className="size-3" /></button><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-2 text-left text-[11px] font-medium normal-case tracking-normal text-white shadow-lg group-hover:block group-focus-within:block">{formula}</span></span>}</div><p className="text-[10px] text-slate-400">{detail}</p></div><span className="rounded bg-blue-50 p-1.5 text-blue-600">{icon}</span></div><p className={`mt-4 text-2xl font-bold tracking-tight ${empty ? "text-slate-400" : "text-slate-900"}`}>{value}</p><div className="mt-3 flex items-center gap-1 text-xs text-slate-500">{empty ? "Belum ada data" : <><Activity className="size-3.5 text-teal-600" />Validated</>}</div></article>; }
function ChartPanel({ series, loading, error }: { series: MacroPoint[]; loading: boolean; error: string | null }) { return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2"><h2 className="text-lg font-bold text-slate-900">Pergerakan Performa Sales & Cost</h2><p className="text-sm text-slate-500">Konsolidasi revenue, cost, dan outstanding tervalidasi.</p>{loading ? <ChartSkeleton /> : error ? <PanelError message="Chart tidak dapat dimuat." /> : !series.length ? <PanelEmpty text="Belum ada data chart pada periode ini." /> : <><div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600"><ChartLegend color="#0d9488" label="Revenue" /><ChartLegend color="#4f46e5" label="Cost" /><ChartLegend color="#f59e0b" label="Outstanding" /></div><div className="mt-4 h-72 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{ top: 8, right: 12, bottom: 8, left: 18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="period_month" tick={{ fontSize: 11 }} tickMargin={8} /><YAxis width={72} tick={{ fontSize: 11 }} tickFormatter={(value: number) => compactMoney.format(value)} tickMargin={6} /><Tooltip formatter={(value: unknown) => money.format(Number(value ?? 0))} /><Area type="monotone" dataKey="revenue" stroke="#0d9488" fill="#99f6e4" fillOpacity={0.45} /><Line type="monotone" dataKey="cost" stroke="#4f46e5" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="total_outstanding" stroke="#f59e0b" strokeWidth={2} dot={false} /></AreaChart></ResponsiveContainer></div></>}</section>; }
function ChartLegend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ backgroundColor: color }} />{label}</span>; }
function AlertPanel({ alerts, loading }: { alerts: AlertRow[]; loading: boolean }) {
  const pageSize = 5;
  const [page, setPage] = useState(1);
  const ordered = [...alerts].sort((a, b) => a.due.localeCompare(b.due));
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visible = ordered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Daftar Alerts Overdue</h2><p className="mb-4 text-xs text-slate-500">Invoice tervalidasi yang melewati due date, diurutkan dari yang paling lama.</p>{loading ? <AlertSkeleton /> : ordered.length ? <><div className="space-y-3">{visible.map((alert, index) => <div key={`${alert.id}-${alert.due}-${index}`} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between text-xs font-bold"><span>{alert.id}</span><span className="text-red-600">{alert.days} Hari</span></div><p className="mt-1 text-sm font-semibold text-indigo-700">{alert.client}</p><p className="text-[10px] text-slate-500">Due: {alert.due} - {money.format(alert.amount)}</p><button type="button" disabled className="mt-2 rounded bg-slate-300 px-2 py-1 text-[10px] text-slate-500">Assign (Segera)</button></div>)}</div>{totalPages > 1 && <div className="mt-5 flex min-w-0 justify-center overflow-hidden"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} /></div>}</> : <PanelEmpty text="Belum ada data overdue alert." />}</section>;
}
function BranchPanel({ rows }: { rows: BranchRow[] }) { return <section className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Performa Finansial Berdasarkan Cabang Operasional</h2><p className="text-sm text-slate-500">Belum ada sumber data cabang yang tersedia.</p></div><Info className="size-4 text-slate-400" /></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-slate-50 uppercase tracking-wider text-slate-500"><tr><th className="p-3">Hub Operasional</th><th>PIC Cabang</th><th>Sales Profit</th><th>Real Cost</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="p-3"><b>{row.hub}</b><br /><span className="text-slate-400">{row.code} - {row.city}</span></td><td>{row.pic}<br /><span className="text-slate-400">{row.role}</span></td><td>{row.profit}<br /><span className="text-teal-600">{row.profitTrend}</span></td><td>{row.cost}</td><td className="font-bold">{row.outstanding}</td><td><span className="rounded-full bg-teal-100 px-2 py-1 text-teal-700">{row.status}</span></td></tr>)}</tbody></table></div> : <PanelEmpty text="Belum ada data performa cabang." />}</section>; }
function MetricSkeleton() { return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-white p-5"><div className="h-3 w-32 rounded bg-slate-200" /><div className="mt-6 h-7 w-40 rounded bg-slate-200" /><div className="mt-3 h-3 w-24 rounded bg-slate-200" /></div>)}</div>; }
function ChartSkeleton() { return <div className="mt-6 h-72 animate-pulse rounded-lg bg-slate-100" />; }
function AlertSkeleton() { return <div className="space-y-3" aria-label="Memuat alerts">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="animate-pulse rounded-lg bg-slate-50 p-3"><div className="flex justify-between"><div className="h-3 w-24 rounded bg-slate-200" /><div className="h-3 w-14 rounded bg-slate-200" /></div><div className="mt-3 h-4 w-36 rounded bg-slate-200" /><div className="mt-2 h-3 w-48 rounded bg-slate-200" /><div className="mt-3 h-5 w-20 rounded bg-slate-200" /></div>)}</div>; }
function PanelEmpty({ text }: { text: string }) { return <div className="my-6 rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">{text}</div>; }
function PanelError({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="my-6 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-700"><AlertCircle className="mx-auto mb-2 size-5" />{message}{onRetry && <button type="button" onClick={onRetry} className="ml-2 inline-flex items-center gap-1 font-bold underline"><RefreshCw className="size-3" />Retry</button>}</div>; }
