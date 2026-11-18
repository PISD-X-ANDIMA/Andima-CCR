"use client";

import { useEffect, useState } from "react";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
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
import type { MacroPoint } from "./SalesOverview";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export type Metric = "revenue" | "cost" | "total_outstanding";

const chartConfig: Record<Metric, { labelEn: string; labelId: string; color: string; fill: string }> = {
  revenue: { labelEn: "Revenue", labelId: "Pendapatan", color: "#2563eb", fill: "#60a5fa" },
  cost: { labelEn: "Cost", labelId: "Biaya Operasional", color: "#d97706", fill: "#fbbf24" },
  total_outstanding: { labelEn: "Outstanding", labelId: "Sisa Piutang", color: "#0f766e", fill: "#2dd4bf" },
};

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const monthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthNamesId = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function periodParts(period: string) {
  const [year, month] = period.split("-").map(Number);
  return { year: year || 2026, month: month || 1 };
}

function monthLabel(period: string, isIndonesian = false) {
  const { year, month } = periodParts(period);
  const names = isIndonesian ? monthNamesId : monthNamesEn;
  return `${names[(month || 1) - 1]} ${year}`;
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

function MacroTooltip({
  active,
  payload,
  label,
  isIndonesian,
  periodLabelFallback,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ dataKey?: string | number; value?: number | string; color?: string; name?: string }>;
  label?: string;
  isIndonesian?: boolean;
  periodLabelFallback?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-44 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1.5 font-semibold text-slate-900">{label ? monthLabel(label, isIndonesian) : (periodLabelFallback || "Period")}</p>
      {payload.map((entry, index) => {
        const key = String(entry.dataKey ?? entry.name ?? "metric") as Metric;
        const config = chartConfig[key];
        const displayLabel = config ? (isIndonesian ? config.labelId : config.labelEn) : String(entry.name ?? key);
        return (
          <div key={`${key}-${index}`} className="flex items-center gap-2 py-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: config?.color ?? entry.color ?? "#64748b" }} />
            <span className="text-slate-500">{displayLabel}</span>
            <span className="ml-auto pl-3 font-mono font-medium text-slate-900">{money.format(Number(entry.value ?? 0))}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartLegend({ metrics, isIndonesian }: { metrics: Metric[]; isIndonesian: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500">
      {metrics.map((metric) => {
        const item = chartConfig[metric];
        const label = isIndonesian ? item.labelId : item.labelEn;
        return (
          <span key={metric} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
            {label}
          </span>
        );
      })}
    </div>
  );
}

export function ChartAreaStacked({
  title,
  series,
  metrics,
  startPeriod,
  endPeriod,
  loading,
  error,
}: {
  title: string;
  series: MacroPoint[];
  metrics: Metric[];
  startPeriod: string;
  endPeriod: string;
  loading: boolean;
  error: string | null;
}) {
  const { language, t } = useLanguage();
  const isId = language === "id";
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
  const trendConfig = chartConfig[trendMetric];
  const trendLabel = isId ? trendConfig.labelId : trendConfig.labelEn;

  return (
    <Card className="min-w-0 overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="gap-3 border-b border-slate-100 bg-white">
        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-3.5 w-36 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="size-4 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center gap-4 pt-1">
              {metrics.map((m) => (
                <div key={m} className="flex items-center gap-1.5">
                  <div className="size-2 animate-pulse rounded-full bg-slate-200" />
                  <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{t("salesOverview.chartsSubtitle", "Monthly validated upload data")}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-slate-400" aria-hidden="true" />
              </div>
            </div>
            <ChartLegend metrics={metrics} isIndonesian={isId} />
          </>
        )}
      </CardHeader>
      <CardContent className="pt-5">
        {loading ? (
          <div aria-label="Loading chart" className="h-72 animate-pulse rounded-lg bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
        ) : error ? (
          <div role="alert" className="flex h-72 items-center justify-center rounded-lg border border-red-100 bg-red-50 text-sm text-red-700">
            {t("salesOverview.chartLoadError", "Chart could not be loaded.")}
          </div>
        ) : !ordered.length ? (
          <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
            {t("salesOverview.noChartData", "No chart data available for this period.")}
          </div>
        ) : (
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsAreaChart data={ordered} margin={{ top: 10, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  {metrics.map((metric) => (
                    <linearGradient key={metric} id={`${chartId}-${metric}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartConfig[metric].fill} stopOpacity={0.42} />
                      <stop offset="92%" stopColor={chartConfig[metric].fill} stopOpacity={0.03} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis
                  dataKey="period_month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  height={38}
                  padding={{ left: 12, right: 12 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(p: string) => monthLabel(p, isId)}
                />
                <YAxis
                  width={70}
                  domain={[0, yMaximum]}
                  tickCount={5}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(value: number) => `Rp ${compactMoney.format(value)}`}
                />
                <Tooltip
                  cursor={{ stroke: "#94a3b8", strokeOpacity: 0.35, strokeDasharray: "4 4" }}
                  content={<MacroTooltip isIndonesian={isId} periodLabelFallback={t("salesOverview.period", "Period")} />}
                />
                {metrics.map((metric) => (
                  <Area
                    key={metric}
                    type="monotone"
                    dataKey={metric}
                    name={isId ? chartConfig[metric].labelId : chartConfig[metric].labelEn}
                    stroke={chartConfig[metric].color}
                    strokeWidth={2.2}
                    fill={`url(#${chartId}-${metric})`}
                    fillOpacity={1}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                    dot={false}
                    isAnimationActive={!reduceMotion}
                    animationDuration={650}
                  />
                ))}
              </RechartsAreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t border-slate-100 bg-white">
        {loading ? (
          <div className="grid gap-2 text-sm" aria-hidden="true">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
          </div>
        ) : (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2 font-medium leading-none text-slate-700">
              {error || change === null ? (
                t("salesOverview.changeUnavailable", "Change unavailable")
              ) : (
                <>
                  {trendLabel}{" "}
                  {change > 0 ? t("salesOverview.up", "up") : change < 0 ? t("salesOverview.down", "down") : t("salesOverview.flat", "flat")}{" "}
                  {Math.abs(change).toFixed(1)}%
                  <Trend className="size-4" />
                </>
              )}
            </div>
            <div className="leading-none text-slate-500">
              {monthLabel(startPeriod, isId)} - {monthLabel(endPeriod, isId)}
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
