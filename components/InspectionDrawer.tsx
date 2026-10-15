"use client";

import React from "react";
import { CustomerAnalyticsItem } from "@/types/customer";

interface InspectionDrawerProps {
  customer: CustomerAnalyticsItem | null;
  loading?: boolean;
}

const formatRupiah = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(value);
const displayRupiah = (value: number | null | undefined) => value == null ? "Belum ada data" : formatRupiah(value);

export default function InspectionDrawer({ customer, loading = false }: InspectionDrawerProps) {
  if (loading) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-5" aria-label="Memuat ringkasan pelanggan" aria-busy="true"><div className="animate-pulse space-y-4"><div className="h-3 w-28 rounded bg-slate-200" /><div className="h-5 w-48 rounded bg-slate-200" /><div className="h-3 w-32 rounded bg-slate-200" /><div className="space-y-3 border-t border-slate-100 pt-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="flex justify-between gap-4"><div className="h-3 w-28 rounded bg-slate-200" /><div className="h-3 w-24 rounded bg-slate-200" /></div>)}</div></div></section>;
  }
  if (!customer) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center font-medium text-slate-400">Pilih pelanggan untuk melihat ringkasan datanya.</div>;
  }

  const metrics = [
    ["Kode pelanggan", customer.npwp],
    ["Alamat", customer.location_detail],
    ["Pendapatan periode terbaru", displayRupiah(customer.revenue)],
    ["Biaya aktual terbaru", displayRupiah(customer.cost)],
    ["Profit", displayRupiah(customer.sales_profit)],
    ["Total piutang", displayRupiah(customer.total_outstanding)],
    ["Invoice piutang", customer.active_invoices_count.toLocaleString("id-ID")],
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ringkasan pelanggan</p>
      <h2 className="mt-1 text-base font-extrabold text-slate-900">{customer.customer_name}</h2>
      <p className="mt-1 break-all text-xs font-medium text-slate-500">ID: {customer.id}</p>
      <dl className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
        {metrics.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-3 text-xs">
            <dt className="font-medium text-slate-500">{label}</dt>
            <dd className="max-w-[60%] break-words text-right font-bold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[10px] text-slate-400">Angka penjualan berdasarkan periode terbaru yang tersedia. Piutang berasal dari laporan tervalidasi.</p>
    </section>
  );
}
