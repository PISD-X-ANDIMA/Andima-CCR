"use client";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { MacroPoint } from "./SalesOverview";
export type Metric = "revenue" | "cost" | "total_outstanding";
const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  cost: { label: "Cost", color: "var(--chart-2)" },
  total_outstanding: { label: "Total Outstanding", color: "var(--chart-3)" },
} satisfies ChartConfig;
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const monthFormat = new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric", timeZone: "UTC" });
function monthLabel(period: string) { return monthFormat.format(new Date(`${period.slice(0,7)}-01T00:00:00Z`)); }
export function ChartAreaStacked({ title, series, metrics, startPeriod, endPeriod, loading, error }: {
  title: string; series: MacroPoint[]; metrics: Metric[]; startPeriod: string; endPeriod: string; loading: boolean; error: string | null;
}) {
  const ordered = [...series].sort((a,b) => a.period_month.localeCompare(b.period_month));
  const maximum = Math.max(0, ...ordered.map(point => metrics.reduce((sum, metric) => sum + point[metric], 0)));
  const yMaximum = maximum > 0 ? maximum * 1.15 : 1;
  const trendMetric = metrics.length > 1 ? "revenue" : metrics[0];
  const latest = ordered.at(-1); const previous = ordered.at(-2);
  const change = latest && previous && previous[trendMetric] !== 0 ? ((latest[trendMetric] - previous[trendMetric]) / previous[trendMetric]) * 100 : null;
  const Trend = change !== null && change < 0 ? TrendingDown : TrendingUp;
  const config = Object.fromEntries(metrics.map(key => [key, chartConfig[key]]));
  return <Card className="sales-chart">
    <CardHeader><CardTitle>{title}</CardTitle><CardDescription>Data hasil upload tervalidasi per bulan</CardDescription></CardHeader>
    <CardContent>
      {loading ? <div aria-label="Memuat chart" className="h-72 animate-pulse rounded-lg bg-slate-100" />
        : error ? <div role="alert" className="flex h-72 items-center justify-center rounded-lg bg-red-50 text-sm text-red-700">Chart tidak dapat dimuat.</div>
        : !ordered.length ? <div className="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">Belum ada data chart pada periode ini.</div>
        : <ChartContainer config={config}><AreaChart accessibilityLayer data={ordered} margin={{ top: 16, left: 0, right: 16, bottom: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="period_month" tickLine={false} axisLine={false} tickMargin={10} height={44} padding={{ left: 24, right: 24 }} interval="preserveStartEnd" minTickGap={24} tick={{ fontSize: 10 }} tickFormatter={monthLabel} />
          <YAxis width={74} domain={[0, yMaximum]} tickCount={5} tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 10 }} tickFormatter={(value: number) => `Rp ${compactMoney.format(value)}`} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" formatter={value => money.format(value)} labelFormatter={monthLabel} />} />
          {[...metrics].reverse().map(key => <Area key={key} dataKey={key} name={chartConfig[key].label} type="natural" fill={`var(--color-${key})`} fillOpacity={0.4} stroke={`var(--color-${key})`} stackId="a" />)}
        </AreaChart></ChartContainer>}
    </CardContent>
    <CardFooter><div className="grid gap-2 text-sm">
      <div className="flex items-center gap-2 font-medium leading-none">{loading || error || change === null ? "Perubahan belum tersedia" : <>{chartConfig[trendMetric].label} {change > 0 ? "naik" : change < 0 ? "turun" : "tetap"} {Math.abs(change).toFixed(1)}%<Trend className="h-4 w-4" /></>}</div>
      <div className="leading-none text-slate-500">{monthLabel(startPeriod)} - {monthLabel(endPeriod)}</div>
    </div></CardFooter>
  </Card>;
}
