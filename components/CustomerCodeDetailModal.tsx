"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { CustomerCodeDetail } from "@/types/customer";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

type Props = {
  customerId: string;
  code: string;
  onClose: () => void;
};

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function CustomerCodeDetailModal({ customerId, code, onClose }: Props) {
  const [detail, setDetail] = useState<CustomerCodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);
    fetch(`/api/v1/customers/${encodeURIComponent(customerId)}/codes/${encodeURIComponent(code)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await readJsonResponse<{ data?: CustomerCodeDetail; error?: { message?: string }; message?: string }>(response);
        if (!response.ok) throw new Error(responseMessage(body, "Failed to load customer code details."));
        setDetail(body?.data ?? null);
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load customer code details.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [code, customerId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const salesSummary = useMemo(() => (detail?.sales_rows ?? []).reduce((summary, row) => ({
    revenue: summary.revenue + row.revenue,
    trucking: summary.trucking + row.trucking_cost,
    handling: summary.handling + row.handling_cost,
    storage: summary.storage + row.storage_cost,
    other: summary.other + row.other_operational_cost,
    cost: summary.cost + row.total_cost,
    profit: summary.profit + row.sales_profit,
  }), { revenue: 0, trucking: 0, handling: 0, storage: 0, other: 0, cost: 0, profit: 0 }), [detail]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="customer-code-detail-title" className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 md:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 font-heading">Customer Code Details</p>
            <h2 id="customer-code-detail-title" className="mt-1 truncate text-lg font-bold text-slate-900 font-heading">{code}</h2>
            {detail?.aliases[0] && <p className="mt-1 truncate text-xs font-semibold text-slate-600">{detail.aliases[0].customer_name} <span className="font-medium text-slate-400">· {detail.aliases[0].customer_id}</span></p>}
            <p className="mt-1 text-xs text-slate-500">Validated Sales Overview and Outstanding Report.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer" aria-label="Close customer code details" title="Close">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {loading && <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-semibold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading code details...</div>}
          {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}
          {!loading && !error && detail && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {detail.aliases.map((alias) => (
                  <span key={alias.customer_id} className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{alias.customer_name}{alias.customer_code ? ` · ${alias.customer_code}` : ""}</span>
                ))}
              </div>
              <section>
                <h3 className="text-sm font-bold text-slate-800 font-heading">Sales Overview Summary</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                  {[
                    ["Revenue", salesSummary.revenue],
                    ["Trucking", salesSummary.trucking],
                    ["Handling", salesSummary.handling],
                    ["Storage", salesSummary.storage],
                    ["Other Cost", salesSummary.other],
                    ["Total Cost", salesSummary.cost],
                    ["Sales Profit", salesSummary.profit],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-500 font-heading">{label}</p>
                      <p className="mt-2 text-xs font-bold text-slate-900 font-heading">{money(Number(value))}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-bold text-slate-800 font-heading">All Sales Report Rows</h3>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-[1180px] w-full text-left text-xs">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        {["Period", "Source Name", "Revenue", "Trucking", "Handling", "Storage", "Other Cost", "Total Cost", "Sales Profit"].map((label) => (
                          <th key={label} className="whitespace-nowrap px-3 py-3">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.sales_rows.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{row.period_month.slice(0, 7)}</td>
                          <td className="min-w-64 px-3 py-3 text-slate-600">{row.customer_name}</td>
                          <td className="whitespace-nowrap px-3 py-3">{money(row.revenue)}</td>
                          <td className="whitespace-nowrap px-3 py-3">{money(row.trucking_cost)}</td>
                          <td className="whitespace-nowrap px-3 py-3">{money(row.handling_cost)}</td>
                          <td className="whitespace-nowrap px-3 py-3">{money(row.storage_cost)}</td>
                          <td className="whitespace-nowrap px-3 py-3">{money(row.other_operational_cost)}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold">{money(row.total_cost)}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-bold text-emerald-700">{money(row.sales_profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!detail.sales_rows.length && <p className="p-6 text-center text-xs font-medium text-slate-400">No validated Sales Report rows for this code.</p>}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-bold text-slate-800 font-heading">Outstanding Report Due Dates</h3>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-[980px] w-full text-left text-xs">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        {["Invoice", "Source Name", "Amount", "Due Date", "Job", "MAWB", "Bulk Close"].map((label) => (
                          <th key={label} className="whitespace-nowrap px-3 py-3">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.outstanding_rows.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-3 py-3 font-bold text-blue-700">{row.invoice_number}</td>
                          <td className="px-3 py-3 text-slate-600">{row.customer_name}</td>
                          <td className="whitespace-nowrap px-3 py-3">{money(row.outstanding_amount)}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{row.due_date}</td>
                          <td className="px-3 py-3">{row.job_number ?? "-"}</td>
                          <td className="px-3 py-3">{row.mawb ?? "-"}</td>
                          <td className="px-3 py-3 font-semibold">{row.bulk_close_status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!detail.outstanding_rows.length && <p className="p-6 text-center text-xs font-medium text-slate-400">No validated Outstanding Report rows for this code.</p>}
                </div>
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
