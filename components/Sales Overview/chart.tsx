"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, Calendar, Filter, TrendingDown, TrendingUp } from "lucide-react";
import {
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart as RechartsAreaChart,
} from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { quickPeriodRange } from "@/lib/salesOverviewPeriod";
import type { MacroPoint } from "./SalesOverview";

export type Metric = "revenue" | "cost" | "total_outstanding";

const chartConfig: Record<Metric, { label: string; color: string; fill: string }> = {
  revenue: { label: "Revenue", color: "#2563eb", fill: "#60a5fa" },
  cost: { label: "Cost", color: "#d97706", fill: "#fbbf24" },
  total_outstanding: { label: "Outstanding", color: "#0f766e", fill: "#2dd4bf" },
};

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function periodParts(period: string) {
  const [year, month] = period.split("-").map(Number);
  return { year: year || 2026, month: month || 1 };
}

function periodIndex(period: string) {
  const { year, month } = periodParts(period);
  return year * 12 + month;
}

function monthLabel(period: string) {
  const { year, month } = periodParts(period);
  return `${monthNamesEn[(month || 1) - 1]} ${year}`;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function MacroTooltip({ active, payload, label }: { active?: boolean; payload?: ReadonlyArray<{ dataKey?: string | number; value?: number | string; color?: string; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="min-w-44 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
    <p className="mb-1.5 font-semibold text-slate-900">{label ? monthLabel(label) : "Period"}</p>
    {payload.map((entry, index) => {
      const key = String(entry.dataKey ?? entry.name ?? "metric") as Metric;
      const config = chartConfig[key] ?? { label: key, color: entry.color ?? "#64748b" };
      return <div key={`${key}-${index}`} className="flex items-center gap-2 py-1">
        <span className="size-2 rounded-full" style={{ backgroundColor: config.color }} />
        <span className="text-slate-500">{config.label}</span>
        <span className="ml-auto pl-3 font-mono font-medium text-slate-900">{money.format(Number(entry.value ?? 0))}</span>
      </div>;
    })}
  </div>;
}

function ChartLegend({ metrics }: { metrics: Metric[] }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500">
    {metrics.map((metric) => <span key={metric} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: chartConfig[metric].color }} />{chartConfig[metric].label}</span>)}
  </div>;
}

function ChartPeriodFilter({
  startPeriod,
  endPeriod,
  onStartPeriodChange,
  onEndPeriodChange,
}: {
  startPeriod: string;
  endPeriod: string;
  onStartPeriodChange: (val: string) => void;
  onEndPeriodChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => periodParts(endPeriod).year);
  const [draftStart, setDraftStart] = useState(startPeriod);
  const [draftEnd, setDraftEnd] = useState(endPeriod);
  const [selecting, setSelecting] = useState<"start" | "end">("start");

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !popoverRef.current?.contains(event.target)) {
        setIsOpen(false);
        setShowCustom(false);
        setSelecting("start");
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setShowCustom(false);
        setSelecting("start");
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [isOpen]);

  function applyMonths(months: number) {
    const range = quickPeriodRange(endPeriod, months);
    onStartPeriodChange(range.startPeriod);
    onEndPeriodChange(range.endPeriod);
    setIsOpen(false);
    setShowCustom(false);
  }

  function chooseCustomMonth(month: number) {
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
    setShowCustom(false);
    setSelecting("start");
  }

  return (
    <div ref={popoverRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setShowCustom(false);
          setDraftStart(startPeriod);
          setDraftEnd(endPeriod);
          setCalendarYear(periodParts(endPeriod).year);
        }}
        aria-label="Filter chart period"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <Filter className="size-3.5 text-blue-600" />
        <span>Filter</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Select chart period range"
          className="absolute right-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-900 font-heading">Chart Period</span>
            <span className="text-[10px] text-slate-400">
              {monthLabel(startPeriod)} - {monthLabel(endPeriod)}
            </span>
          </div>

          {!showCustom ? (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => applyMonths(3)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <span>3 Months</span>
                <span className="text-[10px] text-slate-400">Trailing 3M</span>
              </button>
              <button
                type="button"
                onClick={() => applyMonths(6)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <span>6 Months</span>
                <span className="text-[10px] text-slate-400">Trailing 6M</span>
              </button>
              <button
                type="button"
                onClick={() => applyMonths(12)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <span>12 Months</span>
                <span className="text-[10px] text-slate-400">Trailing 1Y</span>
              </button>
              <div className="border-t border-slate-100 pt-1.5">
                <button
                  type="button"
                  onClick={() => setShowCustom(true)}
                  className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <Calendar className="size-3.5 text-blue-600" />
                  <span>Custom Month</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCalendarYear((year) => year - 1)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                  aria-label="Previous year"
                >
                  <ArrowLeft className="size-3.5" />
                </button>
                <span className="text-xs font-bold text-slate-900 font-heading">{calendarYear}</span>
                <button
                  type="button"
                  onClick={() => setCalendarYear((year) => year + 1)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                  aria-label="Next year"
                >
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
              <p className="mb-2 text-[11px] text-slate-600">
                {selecting === "start" ? "Select start month" : "Select end month"}
              </p>
              <p className="mb-2.5 text-[10px] text-slate-400">
                Click start month, then click end month to select period range.
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {monthNamesEn.map((name, index) => {
                  const value = `${calendarYear}-${String(index + 1).padStart(2, "0")}`;
                  const isStart = value === draftStart;
                  const isEnd = value === draftEnd;
                  const inRange =
                    draftStart && draftEnd && periodIndex(value) > periodIndex(draftStart) && periodIndex(value) < periodIndex(draftEnd);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => chooseCustomMonth(index + 1)}
                      className={`rounded-md px-1.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                        isEnd
                          ? "bg-[#3B6FF5] text-white"
                          : isStart
                          ? "bg-blue-200 text-blue-900"
                          : inRange
                          ? "bg-blue-50 text-blue-800"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2.5 flex justify-end gap-1.5 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ChartAreaStacked({
  title,
  series,
  metrics,
  startPeriod,
  endPeriod,
  onStartPeriodChange,
  onEndPeriodChange,
  loading,
  error,
}: {
  title: string;
  series: MacroPoint[];
  metrics: Metric[];
  startPeriod: string;
  endPeriod: string;
  onStartPeriodChange?: (value: string) => void;
  onEndPeriodChange?: (value: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const ordered = [...series].sort((a, b) => a.period_month.localeCompare(b.period_month));
  const maximum = Math.max(0, ...ordered.flatMap((point) => metrics.map((metric) => point[metric])));
  const yMaximum = maximum > 0 ? maximum * 1.18 : 1;
  const trendMetric = metrics.includes("revenue") ? "revenue" : metrics[0];
  const latest = ordered.at(-1);
  const previous = ordered.at(-2);
  const change = latest && previous && previous[trendMetric] !== 0
    ? ((latest[trendMetric] - previous[trendMetric]) / previous[trendMetric]) * 100
    : null;
  const Trend = change !== null && change < 0 ? TrendingDown : TrendingUp;
  const chartId = `sales-chart-${metrics.join("-")}`;

  return <Card className="min-w-0 overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
    <CardHeader className="gap-3 border-b border-slate-100 bg-slate-50/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle>{title}</CardTitle><CardDescription>Monthly validated upload data</CardDescription></div>
        <div className="flex items-center gap-2">
          {onStartPeriodChange && onEndPeriodChange && (
            <ChartPeriodFilter
              startPeriod={startPeriod}
              endPeriod={endPeriod}
              onStartPeriodChange={onStartPeriodChange}
              onEndPeriodChange={onEndPeriodChange}
            />
          )}
          <Activity className="size-4 text-slate-400" aria-hidden="true" />
        </div>
      </div>
      <ChartLegend metrics={metrics} />
    </CardHeader>
    <CardContent className="pt-5">
      {loading ? <div aria-label="Loading chart" className="h-72 animate-pulse rounded-lg bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
        : error ? <div role="alert" className="flex h-72 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-sm text-red-700">Chart could not be loaded.</div>
          : !ordered.length ? <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">No chart data available for this period.</div>
            : <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsAreaChart data={ordered} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                  <defs>
                    {metrics.map((metric) => <linearGradient key={metric} id={`${chartId}-${metric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartConfig[metric].fill} stopOpacity={0.42} />
                      <stop offset="92%" stopColor={chartConfig[metric].fill} stopOpacity={0.03} />
                    </linearGradient>)}
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="period_month" tickLine={false} axisLine={false} tickMargin={10} height={38} padding={{ left: 12, right: 12 }} interval="preserveStartEnd" minTickGap={24} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={monthLabel} />
                  <YAxis width={70} domain={[0, yMaximum]} tickCount={5} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(value: number) => `Rp ${compactMoney.format(value)}`} />
                  <Tooltip cursor={{ stroke: "#94a3b8", strokeOpacity: 0.35, strokeDasharray: "4 4" }} content={<MacroTooltip />} />
                  {metrics.map((metric) => <Area key={metric} type="monotone" dataKey={metric} name={chartConfig[metric].label} stroke={chartConfig[metric].color} strokeWidth={2.2} fill={`url(#${chartId}-${metric})`} fillOpacity={1} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} dot={false} isAnimationActive={!reduceMotion} animationDuration={650} />)}
                </RechartsAreaChart>
              </ResponsiveContainer>
            </div>}
    </CardContent>
    <CardFooter className="border-t border-slate-100 bg-slate-50/40">
      <div className="grid gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none text-slate-700">{loading || error || change === null ? "Change unavailable" : <>{chartConfig[trendMetric].label} {change > 0 ? "up" : change < 0 ? "down" : "flat"} {Math.abs(change).toFixed(1)}%<Trend className="size-4" /></>}</div>
        <div className="leading-none text-slate-500">{monthLabel(startPeriod)} - {monthLabel(endPeriod)}</div>
      </div>
    </CardFooter>
  </Card>;
}
