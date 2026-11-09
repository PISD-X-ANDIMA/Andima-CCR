"use client";

import React, { useMemo } from "react";
import { Activity, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PaymentTrendPoint } from "@/types/customer";

interface CustomerPaymentTrendChartProps {
  data: PaymentTrendPoint[];
}

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const monthFormat = new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric", timeZone: "UTC" });

function monthLabel(period: string) {
  if (!period) return "";
  try {
    return monthFormat.format(new Date(`${period.slice(0, 7)}-01T00:00:00Z`));
  } catch {
    return period;
  }
}

function PaymentTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="min-w-44 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-semibold text-slate-900">{label ? monthLabel(label) : "Period"}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-slate-500">Collected Payment:</span>
        <span className="font-mono font-bold text-blue-700">{money.format(value)}</span>
      </div>
    </div>
  );
}

export default function CustomerPaymentTrendChart({ data }: CustomerPaymentTrendChartProps) {
  const chartData = useMemo(() => {
    return [...data].sort((a, b) => a.period_month.localeCompare(b.period_month));
  }, [data]);

  const maximum = Math.max(0, ...chartData.map((d) => d.amount));
  const yMaximum = maximum > 0 ? maximum * 1.18 : 1000000;

  const latest = chartData.at(-1);
  const previous = chartData.at(-2);
  const changePercent =
    latest && previous && previous.amount > 0
      ? ((latest.amount - previous.amount) / previous.amount) * 100
      : null;

  const TrendIcon = changePercent !== null && changePercent < 0 ? TrendingDown : TrendingUp;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800 font-heading">Payment Trend</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Historical and latest recorded payment collection trajectory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {changePercent !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                changePercent >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {changePercent >= 0 ? "+" : ""}
              {changePercent.toFixed(1)}% vs prev month
            </span>
          )}
          <Wallet className="h-5 w-5 text-slate-400" />
        </div>
      </div>

      <div className="pt-4">
        {!chartData.length ? (
          <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
            No payment transaction data recorded yet.
          </div>
        ) : (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="paymentTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="90%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="4 4" />
                <XAxis
                  dataKey="period_month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickFormatter={monthLabel}
                />
                <YAxis
                  width={68}
                  domain={[0, yMaximum]}
                  tickCount={5}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(val: number) => `Rp ${compactMoney.format(val)}`}
                />
                <Tooltip content={<PaymentTooltip />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#paymentTrendGradient)"
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

