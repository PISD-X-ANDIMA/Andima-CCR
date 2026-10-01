"use client";

import React, { useState, useEffect } from "react";
import { CustomerAnalyticsItem, InvoiceDetail } from "@/types/customer";

interface InspectionDrawerProps {
  customer: CustomerAnalyticsItem | null;
  onOpenStatement?: (customerId: string) => void;
  onRefreshData?: () => void;
}

export const InspectionDrawer: React.FC<InspectionDrawerProps> = ({
  customer,
  onOpenStatement,
  onRefreshData,
}) => {
  const [isBulkDrawerOpen, setIsBulkDrawerOpen] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceDetail[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isSubmittingBulkClose, setIsSubmittingBulkClose] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Fetch pending invoices when opening bulk close drawer
  useEffect(() => {
    if (isBulkDrawerOpen && customer) {
      setIsLoadingInvoices(true);
      fetch(`/api/v1/customers/${customer.id}/invoices?bulk_close_status=PENDING`)
        .then((res) => res.json())
        .then((data) => {
          if (data.invoices) {
            setInvoices(data.invoices);
            setSelectedInvoiceIds(data.invoices.map((inv: InvoiceDetail) => inv.invoice_id));
          }
        })
        .catch((err) => console.error("Error loading pending invoices:", err))
        .finally(() => setIsLoadingInvoices(false));
    }
  }, [isBulkDrawerOpen, customer]);

  if (!customer) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 font-medium">
        Pilih pelanggan dari tabel untuk melihat rincian target.
      </div>
    );
  }

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedInvoiceIds(invoices.map((inv) => inv.invoice_id));
    } else {
      setSelectedInvoiceIds([]);
    }
  };

  const handleToggleInvoice = (id: string) => {
    if (selectedInvoiceIds.includes(id)) {
      setSelectedInvoiceIds(selectedInvoiceIds.filter((item) => item !== id));
    } else {
      setSelectedInvoiceIds([...selectedInvoiceIds, id]);
    }
  };

  const handleExecuteBulkClose = async () => {
    if (selectedInvoiceIds.length === 0) return;
    setIsSubmittingBulkClose(true);
    try {
      const res = await fetch(`/api/v1/customers/${customer.id}/invoices`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: selectedInvoiceIds,
          action: "BULK_CLOSE",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlertMessage(`Sukses! ${selectedInvoiceIds.length} Faktur berhasil di-close.`);
        setTimeout(() => {
          setAlertMessage(null);
          setIsBulkDrawerOpen(false);
          onRefreshData?.();
        }, 1500);
      } else {
        setAlertMessage(`Gagal: ${data.message || "Error saat bulk close"}`);
      }
    } catch (err: any) {
      setAlertMessage(`Error: ${err.message}`);
    } finally {
      setIsSubmittingBulkClose(false);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Inspection Target Profile Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        {/* Header Title & Badge */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              INSPECTION TARGET PROFILE
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
              {customer.customer_name}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              ID: {customer.id} | {customer.location_detail}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-cyan-100 text-cyan-800 text-[11px] font-extrabold tracking-wide uppercase">
            ON-TIME
          </span>
        </div>

        {/* 4 Metric Box Grid */}
        <div className="grid grid-cols-2 gap-3 py-4 border-b border-slate-100">
          <div className="bg-slate-50/80 p-2.5 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              Credit Limit Disetujui
            </span>
            <span className="text-xs font-extrabold text-slate-900 block mt-0.5">
              {formatRupiah(customer.credit_limit)}
            </span>
          </div>

          <div className="bg-slate-50/80 p-2.5 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              Tingkat Ketepatan Bayar
            </span>
            <span className="text-xs font-extrabold text-emerald-600 block mt-0.5">
              {customer.payment_accuracy}%
            </span>
          </div>

          <div className="bg-slate-50/80 p-2.5 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              Cabang Terdaftar
            </span>
            <span className="text-xs font-extrabold text-slate-900 block mt-0.5">
              {customer.branch_office_badge}
            </span>
          </div>

          <div className="bg-slate-50/80 p-2.5 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              Faktur Beredar
            </span>
            <span className="text-xs font-extrabold text-blue-600 block mt-0.5">
              {customer.active_invoices_count} Berkas
            </span>
          </div>
        </div>

        {/* DSO Days Payment Trend Bars */}
        <div className="py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              TREN HARI PEMBAYARAN (DSO)
            </span>
            <span className="text-xs font-semibold text-emerald-600">
              Stabil ~{customer.dso_trend.july_2026} Hari
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-slate-500 font-medium mb-1 text-[11px]">
                <span>Mei 2026</span>
                <span className="font-bold text-slate-800">{customer.dso_trend.may_2026} Hari</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${Math.min(100, (customer.dso_trend.may_2026 / 40) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-500 font-medium mb-1 text-[11px]">
                <span>Juni 2026</span>
                <span className="font-bold text-slate-800">{customer.dso_trend.june_2026} Hari</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${Math.min(100, (customer.dso_trend.june_2026 / 40) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-500 font-medium mb-1 text-[11px]">
                <span>Juli 2026 (Bulan Ini)</span>
                <span className="font-bold text-blue-600">{customer.dso_trend.july_2026} Hari</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${Math.min(100, (customer.dso_trend.july_2026 / 40) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Officer PIC Card */}
        <div className="py-3 flex items-center justify-between bg-blue-50/60 rounded-xl p-3 my-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Account Officer / PIC
              </span>
              <span className="text-xs font-bold text-slate-900 block">
                {customer.pic.name}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {customer.pic.phone}
              </span>
            </div>
          </div>
          <button className="p-2 bg-white rounded-lg text-blue-600 hover:bg-blue-100 border border-blue-200 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => onOpenStatement?.(customer.id)}
            className="w-full py-3 bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Buka Kartu Piutang Pelanggan
          </button>

          <button
            onClick={() => setIsBulkDrawerOpen(true)}
            className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rekonsiliasi Faktur Belum Lunas
          </button>
        </div>

        {/* Connected Logistics Hub Routes */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              HUB LOGISTIK TERKONEKSI
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              {customer.connected_routes.length} Rute Aktif
            </span>
          </div>

          <div className="space-y-2">
            {customer.connected_routes.map((rt, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="font-semibold text-slate-800">{rt.route}</span>
                </div>
                <span className="font-bold text-slate-500 text-[11px]">{rt.volume}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Close Pending Invoices Modal Drawer (Aurora Blue Theme #3B6FF5) */}
      {isBulkDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col font-sans">
            {/* Drawer Header (Aurora Blue #3B6FF5 Accent) */}
            <div className="p-6 bg-[#3B6FF5] text-white flex items-center justify-between">
              <div>
                <span className="text-xs font-bold tracking-wider text-blue-100 uppercase block">
                  AURORA BLUE DRAWER INVOICE RECONCILIATION
                </span>
                <h2 className="text-xl font-extrabold mt-1">
                  Bulk Close Pending Invoices
                </h2>
                <p className="text-xs text-blue-100 mt-0.5">
                  Pelanggan: {customer.customer_name} ({customer.id})
                </p>
              </div>
              <button
                onClick={() => setIsBulkDrawerOpen(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Alert Message Banner */}
            {alertMessage && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center justify-between">
                <span>{alertMessage}</span>
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invoices.length > 0 && selectedInvoiceIds.length === invoices.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 accent-[#3B6FF5] rounded"
                  />
                  <span>Pilih Semua Faktur Pending ({invoices.length})</span>
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  Terpilih: {selectedInvoiceIds.length} Faktur
                </span>
              </div>

              {isLoadingInvoices ? (
                <div className="py-12 text-center text-slate-400 font-medium">
                  Memuat daftar faktur pending...
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Tidak ada faktur pending yang perlu di-close saat ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv) => {
                    const isSelected = selectedInvoiceIds.includes(inv.invoice_id);
                    return (
                      <div
                        key={inv.invoice_id}
                        onClick={() => handleToggleInvoice(inv.invoice_id)}
                        className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "border-[#3B6FF5] bg-blue-50/50 shadow-xs"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleInvoice(inv.invoice_id)}
                            className="mt-1 w-4 h-4 accent-[#3B6FF5] rounded"
                          />
                          <div>
                            <div className="font-extrabold text-sm text-slate-900">
                              {inv.invoice_number}
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              {inv.description}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              Jatuh Tempo: {inv.due_date} | Ref: {inv.bl_number || "-"}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-extrabold text-[#3B6FF5]">
                            {formatRupiah(inv.amount)}
                          </div>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            {inv.bulk_close_status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsBulkDrawerOpen(false)}
                className="px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={selectedInvoiceIds.length === 0 || isSubmittingBulkClose}
                onClick={handleExecuteBulkClose}
                className="flex-1 py-3 bg-[#3B6FF5] hover:bg-blue-600 disabled:bg-slate-300 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/30 transition flex items-center justify-center gap-2"
              >
                {isSubmittingBulkClose ? (
                  <span>Memproses Bulk Close...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Bulk Close ({selectedInvoiceIds.length}) Pending Invoices</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionDrawer;
