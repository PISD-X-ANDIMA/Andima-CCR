"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Loader2, Receipt, RefreshCw, Search, X } from "lucide-react";
import { CustomerAnalyticsItem, InvoiceDetail } from "@/types/customer";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";
import CustomerCodeDetailModal from "@/components/CustomerCodeDetailModal";
import InvoiceDetailModal from "@/components/InvoiceDetailModal";
import CustomerPaymentTrendChart from "@/components/CustomerPaymentTrendChart";
import Pagination from "@/components/Pagination";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type CustomerInvoice = InvoiceDetail & { job_number?: string | null; mawb?: string | null; payments?: Array<{ payment_id: string; amount: number; payment_date: string; reference_no: string }> };
type Props = { customerId: string; returnTo: string };
type InvoiceResponse = { invoices?: CustomerInvoice[]; error?: { message?: string }; message?: string };
const formatRupiah = (value: number | null | undefined) => value == null ? "No data" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
function statusClass(status: string) { if (status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700"; if (status === "PARTIAL") return "border-amber-200 bg-amber-50 text-amber-700"; return "border-slate-200 bg-slate-50 text-slate-600"; }

export default function CustomerAnalyticsDetail({ customerId, returnTo }: Props) {
  const { language, t } = useLanguage();
  const [customer, setCustomer] = useState<CustomerAnalyticsItem | null>(null);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [canRecordPayment, setCanRecordPayment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<CustomerInvoice | null>(null);
  const [codeSearch, setCodeSearch] = useState("");
  const [codePage, setCodePage] = useState(1);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const cacheBuster = Date.now();
      const [analyticsResponse, invoicesResponse, accountResponse] = await Promise.all([
        fetch(`/api/v1/customers/${encodeURIComponent(customerId)}/analytics?refresh=${cacheBuster}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }),
        fetch(`/api/v1/customers/${encodeURIComponent(customerId)}/invoices?mode=overdue&refresh=${cacheBuster}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }),
        fetch(`/api/v1/account/me?refresh=${cacheBuster}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }),
      ]);
      const analyticsBody = (await readJsonResponse<{ data?: CustomerAnalyticsItem; error?: { message?: string }; message?: string }>(analyticsResponse)) ?? {};
      const invoicesBody = (await readJsonResponse<InvoiceResponse>(invoicesResponse)) ?? {};
      const accountBody = (await readJsonResponse<{ data?: { app_role?: string | null } }>(accountResponse)) ?? {};
      if (!analyticsResponse.ok) throw new Error(responseMessage(analyticsBody, "Failed to load company details."));
      if (!invoicesResponse.ok) throw new Error(responseMessage(invoicesBody, "Failed to load overdue invoices."));
      setCustomer(analyticsBody.data ?? null); setInvoices(invoicesBody.invoices ?? []); setCanRecordPayment(accountBody.data?.app_role === "STAFF");
    } catch (loadError) { setCustomer(null); setInvoices([]); setError(loadError instanceof Error ? loadError.message : "Failed to load company details."); }
    finally { setLoading(false); }
  }, [customerId]);
  useEffect(() => { void loadData(); }, [loadData]);

  const codeRows = useMemo(() => {
    if (!customer) return [];
    const aliases = customer.customer_aliases ?? [];
    const codes = customer.customer_codes ?? (customer.customer_code ? [customer.customer_code] : []);
    return codes.map((code) => {
      const normalized = code.toLowerCase().trim();
      const alias = aliases.find((item) => item.customer_code?.toLowerCase() === normalized || item.customer_name.toLowerCase().includes(normalized));
      const hasOverdueInvoice = invoices.some((inv) => {
        const remaining = inv.remaining_amount ?? inv.amount;
        if (remaining <= 0) return false;
        const mawb = inv.mawb?.toLowerCase().trim();
        const job = inv.job_number?.toLowerCase().trim();
        const invNum = inv.invoice_number?.toLowerCase().trim();
        return mawb === normalized || job === normalized || invNum === normalized;
      });
      return {
        code,
        customer_name: alias?.customer_name ?? customer.customer_name,
        customer_id: alias?.customer_id ?? customer.customer_id ?? customer.id,
        is_overdue: hasOverdueInvoice,
      };
    });
  }, [customer, invoices]);

  const filteredCodeRows = useMemo(() => {
    const q = codeSearch.trim().toLowerCase();
    if (!q) return codeRows;
    return codeRows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        (r.customer_id && String(r.customer_id).toLowerCase().includes(q))
    );
  }, [codeRows, codeSearch]);

  const CODE_PAGE_SIZE = 10;
  const totalCodePages = Math.max(1, Math.ceil(filteredCodeRows.length / CODE_PAGE_SIZE));
  const paginatedCodeRows = useMemo(() => {
    return filteredCodeRows.slice((codePage - 1) * CODE_PAGE_SIZE, codePage * CODE_PAGE_SIZE);
  }, [filteredCodeRows, codePage]);
  const startCodeIndex = filteredCodeRows.length ? (codePage - 1) * CODE_PAGE_SIZE + 1 : 0;
  const endCodeIndex = Math.min(codePage * CODE_PAGE_SIZE, filteredCodeRows.length);
  const metrics = useMemo(() => customer ? [
    [t("customerAnalytics.metricSalesProfit", "Sales Profit"), customer.sales_profit],
    [t("customerAnalytics.metricCurrentMonthCost", "Current Month Cost"), customer.current_month_cost ?? customer.cost],
    [t("customerAnalytics.metricTotalOutstanding", "Total Outstanding"), customer.total_outstanding]
  ] as const : [], [customer, t]);
  const overdueSummary = useMemo(() => {
    const today = Date.parse(new Date().toISOString().slice(0, 10));
    const value = invoices.reduce((sum, invoice) => sum + (invoice.remaining_amount ?? 0), 0);
    const averageDays = invoices.length ? invoices.reduce((sum, invoice) => sum + Math.max(0, Math.floor((today - Date.parse(invoice.due_date)) / 86400000)), 0) / invoices.length : 0;
    return { count: invoices.length, value, averageDays: Math.round(averageDays * 10) / 10 };
  }, [invoices]);

  const submitPayment = async (event: React.FormEvent, invoice: CustomerInvoice) => {
    event.preventDefault(); setSaving(true); setPaymentError(null);
    try {
      const response = await fetch(`/api/v1/customers/${encodeURIComponent(customerId)}/invoices`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RECORD_PAYMENT", invoiceNumber: invoice.invoice_number, amount: Number(amount), paymentDate, referenceNo }) });
      const body = await readJsonResponse<{ error?: { message?: string }; message?: string }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Payment failed to save."));
      setOpenInvoice(null); setAmount(""); setReferenceNo(""); await loadData();
    } catch (saveError) { setPaymentError(saveError instanceof Error ? saveError.message : "Payment failed to save."); }
    finally { setSaving(false); }
  };

  if (loading) return <DetailShell returnTo={returnTo}><CustomerDetailFullSkeleton /></DetailShell>;
  if (error || !customer) return <DetailShell returnTo={returnTo}><div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">{error ?? t("customerAnalytics.companyNotFound", "Company not found.")}</div></DetailShell>;
  const companyGroupId = customer.company_group_id ?? customer.customer_id ?? customer.id;

  return (
    <>
      <DetailShell returnTo={returnTo}>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-semibold text-slate-400 font-heading">{t("customerAnalytics.title", "Customer Analytics")}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 font-heading">{customer.customer_name}</h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">{customer.branch}</p>
          </div>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-xl bg-[#3B6FF5] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-600 disabled:opacity-60 cursor-pointer">
            <RefreshCw className="h-4 w-4" />{t("common.refresh", "Refresh")}
          </button>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 font-heading">{t("customerAnalytics.customerCodes", "Customer Codes")}</h2>
              <p className="mt-1 text-xs text-slate-500">{t("customerAnalytics.customerCodesInstructions", "Click any row to view associated Sales Overview and due dates.")}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64 sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                {language === "id" ? (
                  <input
                    type="text"
                    value={codeSearch}
                    onChange={(e) => {
                      setCodeSearch(e.target.value);
                      setCodePage(1);
                    }}
                    placeholder="Cari kode, nama, atau ID pelanggan..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                ) : (
                  <input
                    type="text"
                    value={codeSearch}
                    onChange={(e) => {
                      setCodeSearch(e.target.value);
                      setCodePage(1);
                    }}
                    placeholder="Search code, name, or customer ID..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                )}
                {codeSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setCodeSearch("");
                      setCodePage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-slate-50 text-xs font-bold text-slate-800 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">{t("customerAnalytics.colCustomerCode", "Customer Code")}</th>
                    <th className="px-4 py-3">{t("customerAnalytics.colSourceName", "Source Name")}</th>
                    <th className="px-4 py-3">{t("customerAnalytics.colCustomerId", "Customer ID")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCodeRows.map((row) => (
                    <tr
                      key={row.code}
                      onClick={() => setSelectedCode(row.code)}
                      className="hover:bg-blue-50/60 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 font-bold text-blue-700 underline-offset-2 hover:underline">
                        {row.code}
                      </td>
                      <td className="max-w-[420px] px-4 py-3 text-slate-800 font-medium">{row.customer_name}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{row.customer_id ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!codeRows.length ? (
                <p className="p-6 text-center text-xs font-medium text-slate-400">{t("customerAnalytics.noCodesAvailable", "No customer codes available.")}</p>
              ) : !filteredCodeRows.length ? (
                <p className="p-6 text-center text-xs font-medium text-slate-400">{t("customerAnalytics.noCodesFound", "No matching customer codes found.")}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {t("common.showing", "Showing")} {startCodeIndex}-{endCodeIndex} {t("common.of", "of")} {filteredCodeRows.length} {t("customerAnalytics.customerCodesCount", "customer codes")}
              </span>
              {totalCodePages > 1 && (
                <Pagination
                  currentPage={codePage}
                  totalPages={totalCodePages}
                  onPageChange={setCodePage}
                />
              )}
            </div>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {metrics.map(([label, value]) => (
            <section key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <p className="text-xs font-semibold text-slate-500 font-heading">{label}</p>
              <p className="mt-3 text-xl font-bold text-slate-900 font-heading">{formatRupiah(value)}</p>
            </section>
          ))}
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-xs">
            <p className="text-xs font-semibold text-rose-600 font-heading">{t("customerAnalytics.metricOverdueInvoices", "Overdue Invoices")}</p>
            <p className="mt-3 text-xl font-bold text-rose-700 font-heading">{formatRupiah(overdueSummary.value)}</p>
            <p className="mt-2 text-xs font-medium text-rose-600">
              {t("customerAnalytics.overdueCountAverage", "{count} invoices · average {days} days")
                .replace("{count}", String(overdueSummary.count))
                .replace("{days}", String(overdueSummary.averageDays))}
            </p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <p className="text-xs font-semibold text-slate-500 font-heading">{t("customerAnalytics.metricPaymentCycle", "Payment Cycle")}</p>
            <p className="mt-3 text-xl font-bold text-slate-900 font-heading">{Number(customer.dso_days ?? 0).toLocaleString("en-US")} {t("common.days", "days")}</p>
            <p className="mt-2 text-xs font-medium text-slate-500">{t("customerAnalytics.avgCustomerDso", "Average customer DSO")}</p>
          </section>
        </div>
        {/* Customer Payment Trend visualization (replaces static 3-Month Payment grid with dynamic monthly collection trend) */}
        <CustomerPaymentTrendChart
          data={customer.payment_trend ?? []}
          customerId={customerId}
          customerName={customer.customer_name}
        />
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 font-heading">{t("customerAnalytics.overdueInvoicesTitle", "Overdue Invoices")}</h2>
              <p className="mt-1 text-xs text-slate-500">{t("customerAnalytics.overdueInvoicesSubtitle", "Click any invoice to view detailed report and linked customer code.")}</p>
            </div>
            <Receipt className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-4 space-y-3">
            {invoices.map((invoice) => (
              <article
                key={invoice.invoice_id}
                onClick={() => setSelectedInvoiceDetail(invoice)}
                className="rounded-xl border border-slate-200 p-4 hover:border-blue-400 hover:shadow-xs transition cursor-pointer bg-white"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-blue-700">{invoice.invoice_number}</p>
                      {(invoice.mawb || invoice.job_number) && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                          Code: {invoice.mawb || invoice.job_number}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{t("common.due", "Due")} {invoice.due_date}{invoice.description ? ` · ${invoice.description}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(invoice.payment_status)}`}>{invoice.payment_status}</span>
                    <span className="text-xs font-semibold text-blue-600 inline-flex items-center">
                      {t("common.viewDetail", "View Detail")} <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-slate-500">{t("customerAnalytics.colInvoiceValue", "Invoice Value")}</p>
                    <p className="mt-1 font-bold text-slate-800 font-heading">{formatRupiah(invoice.amount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{t("customerAnalytics.colPaid", "Paid")}</p>
                    <p className="mt-1 font-bold text-slate-800 font-heading">{formatRupiah(invoice.paid_amount ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{t("customerAnalytics.colRemainingBalance", "Remaining Balance")}</p>
                    <p className="mt-1 font-bold text-slate-800 font-heading">{formatRupiah(invoice.remaining_amount ?? invoice.amount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{t("customerAnalytics.colPayments", "Payments")}</p>
                    <p className="mt-1 font-semibold text-slate-800">{invoice.payments?.length ?? 0} {t("customerAnalytics.transactionsCount", "transactions")}</p>
                  </div>
                </div>
                {!!invoice.payments?.length && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-500 font-heading">{t("customerAnalytics.paymentHistory", "Payment History")}</p>
                    <div className="mt-2 space-y-2">
                      {invoice.payments.map((payment) => (
                        <div key={payment.payment_id} className="flex flex-col justify-between gap-1 text-xs sm:flex-row">
                          <span className="text-slate-500">{payment.payment_date} · {payment.reference_no}</span>
                          <span className="font-semibold text-slate-800">{formatRupiah(payment.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {canRecordPayment && invoice.payment_status !== "PAID" && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenInvoice(openInvoice === invoice.invoice_id ? null : invoice.invoice_id);
                        setPaymentError(null);
                      }}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                    >
                      <ChevronDown className="h-4 w-4" />{t("customerAnalytics.recordPayment", "Record Payment")}
                    </button>
                    {openInvoice === invoice.invoice_id && (
                      <form
                        onSubmit={(event) => {
                          event.stopPropagation();
                          void submitPayment(event, invoice);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3"
                      >
                        <input aria-label={t("customerAnalytics.paymentAmount", "Payment amount")} value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" step="0.01" placeholder={t("customerAnalytics.paymentAmount", "Payment amount")} className="rounded-md border border-slate-200 px-3 py-2 text-xs" required />
                        <input aria-label={t("customerAnalytics.paymentDate", "Payment date")} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} type="date" className="rounded-md border border-slate-200 px-3 py-2 text-xs" required />
                        <input aria-label={t("customerAnalytics.paymentReference", "Reference number")} value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} placeholder={t("customerAnalytics.paymentReference", "Reference number")} className="rounded-md border border-slate-200 px-3 py-2 text-xs" required />
                        <div className="sm:col-span-3">
                          {paymentError && <p role="alert" className="mb-2 text-xs font-semibold text-rose-600">{paymentError}</p>}
                          <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 cursor-pointer">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{t("customerAnalytics.savePayment", "Save Payment")}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </article>
            ))}
            {!invoices.length && <p className="py-8 text-center text-xs font-medium text-slate-400">{t("customerAnalytics.noOverdueInvoices", "No overdue invoices.")}</p>}
          </div>
        </section>
      </DetailShell>
      {selectedCode && <CustomerCodeDetailModal customerId={companyGroupId} code={selectedCode} onClose={() => setSelectedCode(null)} />}
      {selectedInvoiceDetail && (
        <InvoiceDetailModal
          invoice={selectedInvoiceDetail}
          canRecordPayment={canRecordPayment}
          onClose={() => setSelectedInvoiceDetail(null)}
          onOpenCodeDetail={(code) => setSelectedCode(code)}
          onSubmitPayment={async (event, inv, form) => {
            setSaving(true);
            setPaymentError(null);
            try {
              const response = await fetch(`/api/v1/customers/${encodeURIComponent(customerId)}/invoices`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "RECORD_PAYMENT",
                  invoiceNumber: inv.invoice_number,
                  amount: Number(form.amount),
                  paymentDate: form.paymentDate,
                  referenceNo: form.referenceNo,
                }),
              });
              const body = await readJsonResponse<{ error?: { message?: string }; message?: string }>(response);
              if (!response.ok) throw new Error(responseMessage(body, "Payment failed to save."));
              setSelectedInvoiceDetail(null);
              await loadData();
            } catch (saveError) {
              setPaymentError(saveError instanceof Error ? saveError.message : "Payment failed to save.");
            } finally {
              setSaving(false);
            }
          }}
          savingPayment={saving}
          paymentError={paymentError}
        />
      )}
    </>
  );
}

function DetailShell({ returnTo, children }: { returnTo: string; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-4 md:px-8">
            <Link href={returnTo} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" />{t("customerAnalytics.backToAnalytics", "Back to Customer Analytics")}
            </Link>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function CustomerDetailFullSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading company details" aria-busy="true">
      {/* Header Skeleton */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-7 w-64 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-200" />
      </div>

      {/* Customer Codes Card Skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-9 w-64 sm:w-80 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 animate-pulse">
                <div className="h-4 w-28 rounded bg-slate-200" />
                <div className="h-4 w-52 rounded bg-slate-200 flex-1" />
                <div className="h-4 w-20 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="h-3 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </div>

      {/* 5 Metric Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-6 w-32 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Payment Trend Chart Skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-3 w-48 rounded bg-slate-100" />
          </div>
          <div className="h-8 w-36 rounded-xl bg-slate-200" />
        </div>
        <div className="mt-6 h-64 rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
      </div>

      {/* Overdue Invoices Skeleton */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3">
          <div className="space-y-1.5">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="size-5 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="mt-4 space-y-3">
          {[1, 2].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 p-4 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-100" />
                </div>
                <div className="h-6 w-20 rounded-full bg-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map((col) => (
                  <div key={col} className="space-y-1">
                    <div className="h-3 w-16 rounded bg-slate-100" />
                    <div className="h-4 w-24 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
