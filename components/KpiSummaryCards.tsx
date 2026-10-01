"use client";

import React from "react";
import { KpiSummary } from "@/types/customer";

interface KpiSummaryCardsProps {
  kpi: KpiSummary;
}

export const KpiSummaryCards: React.FC<KpiSummaryCardsProps> = ({ kpi }) => {
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {/* Card 1: Total Active Customers */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              TOTAL ACTIVE CUSTOMERS
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {kpi.totalActiveCustomers}
              </span>
              <span className="text-xs font-semibold text-slate-500">PeLanggan</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>

        {/* Branch breakdown pill tags */}
        <div className="mt-4 flex items-center gap-1.5 flex-wrap text-center">
          <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg py-1 px-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">JKT</div>
            <div className="text-xs font-bold text-slate-800">{kpi.branchBreakdown.jkt}</div>
          </div>
          <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg py-1 px-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">SUB</div>
            <div className="text-xs font-bold text-slate-800">{kpi.branchBreakdown.sub}</div>
          </div>
          <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg py-1 px-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">SMG</div>
            <div className="text-xs font-bold text-slate-800">{kpi.branchBreakdown.smg}</div>
          </div>
          <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg py-1 px-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">BPN</div>
            <div className="text-xs font-bold text-slate-800">{kpi.branchBreakdown.bpn}</div>
          </div>
        </div>
      </div>

      {/* Card 2: Average Payment Cycle */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              AVERAGE PAYMENT CYCLE
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {kpi.averagePaymentCycle}
              </span>
              <span className="text-xs font-semibold text-slate-500">Hari</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Batas aman (&lt; 30 Hari)
          </div>
          <div className="px-2 py-1 rounded-full bg-cyan-50 text-cyan-700 text-[11px] font-bold">
            {kpi.paymentCycleDiffVsQ2}h vs Q2
          </div>
        </div>
      </div>

      {/* Card 3: High Risk Outstanding */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block mb-1">
              HIGH RISK OUTSTANDING
            </span>
            <div className="text-2xl font-extrabold text-[#D72C46] tracking-tight">
              {formatRupiah(kpi.highRiskOutstanding)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Note and Growth Badge */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 truncate">
            Overdue &gt; 30 hari ({kpi.highRiskAccountCount} Rekening)
          </span>
          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[11px] font-bold shrink-0">
            +{kpi.highRiskGrowthPercent}%
          </span>
        </div>
      </div>

      {/* Card 4: Top Contributing Customer */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              TOP CONTRIBUTING CUSTOMER
            </span>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              {kpi.topContributingCustomer.name}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center justify-center shrink-0">
            #{kpi.topContributingCustomer.rank}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500">Total Volume Logistik</span>
          <span className="text-xs font-bold text-blue-600">
            {formatRupiah(kpi.topContributingCustomer.totalLogisticsVolume)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default KpiSummaryCards;
