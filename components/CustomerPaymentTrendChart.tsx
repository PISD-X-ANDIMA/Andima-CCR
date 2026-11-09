"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Check, History, Loader2, Receipt, RefreshCw, TrendingDown, TrendingUp, Wallet, X } from "lucide-react";
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
  customerId?: string;
  customerName?: string;
}

interface RecentPaymentRecord {
  payment_id: string;
  invoice_number: string;
  amount: number;
  payment_date: string;
  reference_no: string;
  created_at?: string;
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

export default function CustomerPaymentTrendChart({
  data,
  customerId,
  customerName,
}: CustomerPaymentTrendChartProps) {
  const [showRecentModal, setShowRecentModal] = useState(false);
  const [recentPayments, setRecentPayments] = useState<RecentPaymentRecord[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  const loadRecentPayments = useCallback(async () => {
    if (!customerId) return;
    setLoadingRecent(true);
    setRecentError(null);
    try {
      const res = await fetch(`/api/v1/customers/${encodeURIComponent(customerId)}/payments?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || "Failed to load recent payments.");
      setRecentPayments(body.payments || []);
    } catch (err) {
      setRecentError(err instanceof Error ? err.message : "Failed to load recent payments.");
    } finally {
      setLoadingRecent(false);
    }
  }, [customerId]);

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
        <div className="flex flex-wrap items-center gap-2">
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
          {customerId && (
            <button
              type="button"
              onClick={() => {
                setShowRecentModal(true);
                void loadRecentPayments();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer shadow-xs"
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Recent Payments</span>
            </button>
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

      {/* Recent Settled Payments Modal */}
      {showRecentModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/80">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-heading">
                  Recent Settled Payments
                </h3>
                <p className="text-[11px] text-slate-500">
                  {customerName || "Customer"} · Invoices settled through overdue collections &amp; direct payments
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadRecentPayments()}
                  disabled={loadingRecent}
                  title="Refresh payments"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`size-4 ${loadingRecent ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowRecentModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingRecent ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="size-6 animate-spin text-blue-600" />
                  <span>Loading recent payments...</span>
                </div>
              ) : recentError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
                  {recentError}
                </div>
              ) : recentPayments.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400">
                  <History className="size-8 mb-2 opacity-40" />
                  <p className="text-xs font-semibold text-slate-600">No settled payments recorded yet</p>
                  <p className="text-[11px] mt-0.5 text-slate-400">
                    Settlements processed via Overdue Alerts or invoice payments will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-xs font-bold text-slate-800 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Invoice Number</th>
                        <th className="px-4 py-3 text-right">Settled Amount</th>
                        <th className="px-4 py-3">Payment Date</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentPayments.map((p) => (
                        <tr key={p.payment_id} className="hover:bg-blue-50/40 transition">
                          <td className="px-4 py-3 font-bold text-blue-700">
                            {p.invoice_number}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {money.format(Number(p.amount) || 0)}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-600">
                            {p.payment_date || "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {p.reference_no || "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              <Check className="size-3" />
                              Lunas
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 bg-slate-50/50">
              <span className="text-[11px] font-medium text-slate-500">
                Total {recentPayments.length} recorded payments
              </span>
              <button
                type="button"
                onClick={() => setShowRecentModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

