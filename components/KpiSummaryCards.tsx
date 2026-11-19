"use client";

import React from "react";
import { KpiSummary } from "@/types/customer";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface KpiSummaryCardsProps {
  kpi: KpiSummary;
}

const formatRupiah = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
}).format(value);

const displayRupiah = (value: number | null | undefined) => value == null ? "-" : formatRupiah(value);

export default function KpiSummaryCards({ kpi }: KpiSummaryCardsProps) {
  const { t, language } = useLanguage();
  const numberLocale = language === "id" ? "id-ID" : "en-US";
  const cards = [
    {
      label: t("customerAnalytics.totalCustomer", "Total Customer"),
      value: (kpi.totalActiveCustomers ?? kpi.totalCustomers ?? 0).toLocaleString(numberLocale),
      detail: t("customerAnalytics.totalCustomerDetail", "Unique customers from validated C1 data"),
      color: "text-blue-700",
      icon: "01",
    },
    {
      label: `${t("customerAnalytics.salesProfit", "Sales Profit")}${kpi.period ? ` · ${kpi.period.slice(0, 7)}` : ""}`,
      value: displayRupiah(kpi.currentMonthSalesProfit ?? ((kpi.totalRevenue ?? 0) - (kpi.totalCost ?? 0))),
      detail: t("customerAnalytics.salesProfitDetail", "Profit across the latest period"),
      color: "text-emerald-700",
      icon: "02",
    },
    {
      label: `${t("customerAnalytics.cost", "Cost")}${kpi.period ? ` · ${kpi.period.slice(0, 7)}` : ""}`,
      value: displayRupiah(kpi.currentMonthCost ?? kpi.totalCost),
      detail: t("customerAnalytics.costDetail", "Operational cost across the latest period"),
      color: "text-amber-700",
      icon: "03",
    },
    {
      label: t("customerAnalytics.totalOutstanding", "Total Outstanding"),
      value: displayRupiah(kpi.totalOutstanding),
      detail: t("customerAnalytics.totalOutstandingDetail", "Outstanding balance from validated uploads"),
      color: "text-slate-800",
      icon: "04",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 font-sans sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <section key={card.icon} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500 font-heading">{card.label}</p>
              <p className={`text-xl font-bold tracking-tight font-heading ${card.color}`}>{card.value}</p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">{card.icon}</span>
          </div>
          <p className="mt-4 text-[11px] font-medium text-slate-500">{card.detail}</p>
        </section>
      ))}
    </div>
  );
}
