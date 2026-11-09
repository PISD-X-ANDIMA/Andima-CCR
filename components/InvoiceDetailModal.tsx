"use client";

import React, { useEffect } from "react";
import { Check, ChevronRight, FileText, Loader2, Receipt, X } from "lucide-react";
import { CustomerInvoice } from "@/types/customer";

interface InvoiceDetailModalProps {
  invoice: CustomerInvoice;
  canRecordPayment?: boolean;
  onClose: () => void;
  onOpenCodeDetail: (code: string) => void;
  onSubmitPayment?: (event: React.FormEvent, invoice: CustomerInvoice, data: { amount: string; paymentDate: string; referenceNo: string }) => Promise<void>;
  savingPayment?: boolean;
  paymentError?: string | null;
}

const formatRupiah = (value: number | null | undefined) =>
  value == null ? "Rp 0" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export default function InvoiceDetailModal({
  invoice,
  canRecordPayment,
  onClose,
  onOpenCodeDetail,
  onSubmitPayment,
  savingPayment,
  paymentError,
}: InvoiceDetailModalProps) {
  const [amount, setAmount] = React.useState("");
  const [paymentDate, setPaymentDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = React.useState("");
  const [showPayForm, setShowPayForm] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const linkedCode = invoice.mawb || invoice.job_number || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-detail-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 font-heading">Invoice Report Details</p>
            <h2 id="invoice-detail-title" className="mt-1 text-lg font-bold text-slate-900 font-heading">
              {invoice.invoice_number}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Due Date: <span className="font-semibold text-rose-600">{invoice.due_date}</span>
              {invoice.description ? ` · ${invoice.description}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            aria-label="Close invoice details"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
          {/* Linked Customer Code Banner */}
          {linkedCode ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-blue-800">Linked Customer Code (MAWB / Job)</p>
                  <p className="mt-0.5 text-sm font-bold text-blue-950 font-mono">{linkedCode}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCodeDetail(linkedCode);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 cursor-pointer transition"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Code Sales & Reports
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              No specific MAWB or Job code linked for this invoice.
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">Invoice Total</p>
              <p className="mt-1 text-sm font-extrabold text-slate-900 font-heading">{formatRupiah(invoice.amount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500">Paid Amount</p>
              <p className="mt-1 text-sm font-extrabold text-emerald-700 font-heading">{formatRupiah(invoice.paid_amount ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold text-rose-600">Remaining Balance</p>
              <p className="mt-1 text-sm font-extrabold text-rose-700 font-heading">{formatRupiah(invoice.remaining_amount ?? invoice.amount)}</p>
            </div>
          </div>

          {/* Payment History */}
          <section>
            <h3 className="text-xs font-bold text-slate-900 font-heading flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-500" />
              Payment History ({invoice.payments?.length ?? 0} transactions)
            </h3>
            {invoice.payments?.length ? (
              <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden text-xs">
                {invoice.payments.map((p) => (
                  <div key={p.payment_id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50">
                    <div>
                      <p className="font-semibold text-slate-800">{p.reference_no}</p>
                      <p className="text-[11px] text-slate-400">{p.payment_date}</p>
                    </div>
                    <span className="font-bold text-emerald-700">{formatRupiah(p.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                No partial payments recorded yet for this invoice.
              </p>
            )}
          </section>

          {/* Record Payment Form for Staff */}
          {canRecordPayment && invoice.payment_status !== "PAID" && (
            <div className="border-t border-slate-100 pt-4">
              {!showPayForm ? (
                <button
                  type="button"
                  onClick={() => setShowPayForm(true)}
                  className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer"
                >
                  + Record Payment
                </button>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (onSubmitPayment) {
                      await onSubmitPayment(e, invoice, { amount, paymentDate, referenceNo });
                      setShowPayForm(false);
                      setAmount("");
                      setReferenceNo("");
                    }
                  }}
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="text-xs font-bold text-slate-800 font-heading">Record New Payment</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      placeholder="Amount (IDR)"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Reference No."
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  {paymentError && <p className="text-xs font-semibold text-rose-600">{paymentError}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPayForm(false)}
                      className="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingPayment}
                      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    >
                      {savingPayment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save Payment
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

