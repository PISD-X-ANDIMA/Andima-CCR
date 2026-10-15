"use client";

import React from "react";
import { KpiSummary } from "@/types/customer";

interface KpiSummaryCardsProps {
  kpi: KpiSummary;
}

const formatRupiah = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(value);
const displayRupiah = (value: number | null | undefined) => value == null ? "—" : formatRupiah(value);

export default function KpiSummaryCards({ kpi }: KpiSummaryCardsProps) {
  const cards = [
    { label: "Pelanggan Terdata", value: (kpi.totalCustomers ?? 0).toLocaleString("id-ID"), detail: "Dari daftar perusahaan dan data transaksi", color: "text-blue-700", icon: "01" },
    { label: `Pendapatan${kpi.period ? ` · ${kpi.period.slice(0, 7)}` : ""}`, value: displayRupiah(kpi.totalRevenue), detail: "Total revenue pada periode terbaru", color: "text-emerald-700", icon: "02" },
    { label: "Biaya Aktual", value: displayRupiah(kpi.totalCost), detail: "Dari laporan biaya terbaru per pelanggan", color: "text-slate-700", icon: "03" },
    { label: "Piutang Jatuh Tempo", value: displayRupiah(kpi.overdueOutstanding), detail: `Total piutang ${displayRupiah(kpi.totalOutstanding)}`, color: "text-rose-700", icon: "04" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 font-sans sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <section key={card.label} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{card.label}</p>
              <p className={`text-xl font-extrabold tracking-tight ${card.color}`}>{card.value}</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-extrabold text-slate-500">{card.icon}</span>
          </div>
          <p className="mt-4 text-[11px] font-medium text-slate-500">{card.detail}</p>
        </section>
      ))}
    </div>
  );
}
