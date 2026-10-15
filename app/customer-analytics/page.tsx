"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import KpiSummaryCards from "@/components/KpiSummaryCards";
import InspectionDrawer from "@/components/InspectionDrawer";
import Pagination from "@/components/Pagination";
import { CustomerAnalyticsItem, KpiSummary } from "@/types/customer";
import { RefreshCw, Search } from "lucide-react";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

export default function CustomerAnalyticsPage() {
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("sales_profit");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(5);

  // Data states
  const [customers, setCustomers] = useState<CustomerAnalyticsItem[]>([]);
  const [kpiSummary, setKpiSummary] = useState<KpiSummary | null>(null);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected customer for Inspection Profile Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAnalyticsItem | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };
  const displayRupiah = (val: number | null) => val == null ? "—" : formatRupiah(val);

  // Fetch data from REST API handler (/api/v1/customers/analytics)
  const loadAnalyticsData = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: itemsPerPage.toString(),
      search: searchQuery,
      sortBy: sortBy,
      sortOrder: sortOrder,
    });

    fetch(`/api/v1/customers/analytics?${params.toString()}`)
      .then(async (res) => {
        const resData = await readJsonResponse<{
          data?: CustomerAnalyticsItem[];
          kpiSummary?: KpiSummary;
          pagination?: { totalItems?: number; totalPages?: number };
        } & { error?: { message?: string }; message?: string }>(res);
        if (!res.ok) throw new Error(responseMessage(resData, "Gagal memuat data dari Supabase."));
        if (!resData) throw new Error("Respons analytics kosong.");
        setLoadError(null);
        if (resData.data) {
          setCustomers(resData.data);
          setKpiSummary(resData.kpiSummary ?? null);
          setTotalItems(resData.pagination?.totalItems ?? 0);
          setTotalPages(resData.pagination?.totalPages ?? 1);

          setSelectedCustomer((current) => current ? resData.data!.find((item: CustomerAnalyticsItem) => item.id === current.id) ?? null : null);
          setCheckedIds((current) => current.filter((id) => resData.data!.some((item: CustomerAnalyticsItem) => item.id === id)));
        }
      })
      .catch((err) => {
        console.error("Error fetching analytics data:", err);
        setLoadError(err.message || "Gagal memuat data dari Supabase.");
        setCustomers([]);
        setKpiSummary(null);
        setSelectedCustomer(null);
      })
      .finally(() => setIsLoading(false));
  }, [currentPage, itemsPerPage, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  const handleToggleCheckRow = (id: string) => {
    if (checkedIds.includes(id)) {
      setCheckedIds(checkedIds.filter((item) => item !== id));
    } else {
      setCheckedIds([...checkedIds, id]);
    }
  };
  // Checkbox bulk selection keeps the previous toggle behavior:
  // setCheckedIds((current) => current.includes(c.id) ? current : [...current, c.id])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      <div className="flex min-h-screen flex-col">
        {/* Top Header */}
        <Header pageName="Customer Analytics" />

        {/* View Switcher: Statement of Account OR Main Customer Analytics View */}
          <main className="flex-1 p-6 md:p-8 space-y-6 w-full">
            {/* Page Header Title & Subheader Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  CCR: CUSTOMER ANALYTICS
                </h1>
              </div>

              {/* Sub-header Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={loadAnalyticsData}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#3B6FF5] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  <RefreshCw className={`w-4 h-4 text-white ${isLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>

              </div>
            </div>

            {/* KPI Summary Cards */}
            {isLoading ? <CustomerKpiSkeleton /> : kpiSummary && <KpiSummaryCards kpi={kpiSummary} />}
            {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{loadError}</div>}
            {isLoading && <div className="h-11 animate-pulse rounded-2xl bg-white" aria-label="Memuat filter pelanggan" />}

            {/* Search & Filter Controls Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                {/* Left Search Box */}
                <div className="w-full lg:w-96 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Cari nama, kode pelanggan..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

              </div>

            </div>

            {/* Split View: Left Table & Right Inspection Profile Panel */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Customer Analytics Table */}
              <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-162.5">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold text-[10px] tracking-wider uppercase">
                        <th className="w-10 px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={customers.length > 0 && customers.every((c) => checkedIds.includes(c.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCheckedIds(customers.map((c) => c.id));
                              } else {
                                setCheckedIds([]);
                              }
                            }}
                            className="w-4 h-4 rounded accent-[#203d70]"
                          />
                        </th>

                        <th
                          onClick={() => handleSort("customer_name")}
                          className="px-4 py-3.5 cursor-pointer hover:text-slate-800 transition"
                        >
                          <div className="flex items-center gap-1">
                            <span>CUSTOMER NAME &amp; ID</span>
                            {sortBy === "customer_name" && (sortOrder === "asc" ? "▲" : "▼")}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSort("sales_profit")}
                          className="px-4 py-3.5 text-right cursor-pointer hover:text-slate-800 transition"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>PROFIT PERIODE TERBARU</span>
                            {sortBy === "sales_profit" && (sortOrder === "asc" ? "▲" : "▼")}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSort("cost")}
                          className="px-4 py-3.5 text-right cursor-pointer hover:text-slate-800 transition"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>BIAYA AKTUAL TERBARU</span>
                            {sortBy === "cost" && (sortOrder === "asc" ? "▲" : "▼")}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSort("total_outstanding")}
                          className="px-4 py-3.5 text-right cursor-pointer hover:text-slate-800 transition"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>TOTAL PIUTANG</span>
                            {sortBy === "total_outstanding" && (sortOrder === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                            Memuat data pelanggan...
                          </td>
                        </tr>
                      ) : customers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                            Tidak ada pelanggan ditemukan sesuai filter.
                          </td>
                        </tr>
                      ) : (
                        customers.map((c) => {
                          const isSelected = selectedCustomer?.id === c.id;
                          const isChecked = checkedIds.includes(c.id);
                          const initials = c.customer_name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();

                          return (
                            <tr
                              key={c.id}
                              onClick={() => {
                                setSelectedCustomer(c);
                                setCheckedIds([c.id]);
                              }}
                              className={`transition-colors cursor-pointer ${
                                isSelected ? "bg-blue-50/70" : "hover:bg-slate-50/80"
                              }`}
                            >
                              <td
                                className="px-4 py-4 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleCheckRow(c.id)}
                                  className="w-4 h-4 rounded accent-[#203d70]"
                                />
                              </td>

                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-xs shrink-0">
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="font-extrabold text-blue-600 hover:underline">
                                      {c.customer_name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                      ID: {c.id} / Kode: {c.npwp}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="hidden" aria-hidden="true">
                                <div className="font-semibold text-slate-700">{c.branch_office_badge}</div>
                                <div className="mt-1 text-[10px] text-slate-500">
                                  {c.job_count ?? 0} job · {c.issue_count ?? 0} kendala
                                </div>
                              </td>

                              <td className="px-4 py-4 text-right">
                                <div className="font-extrabold text-emerald-600 flex items-center justify-end gap-1">
                                  <span>{displayRupiah(c.sales_profit)}</span>
                                </div>
                              </td>

                              <td className="px-4 py-4 text-right font-extrabold text-slate-500">
                                {displayRupiah(c.cost)}
                              </td>

                              <td className="px-4 py-4 text-right font-extrabold text-slate-900">
                                {displayRupiah(c.total_outstanding)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer with Pagination */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className={`text-xs text-slate-500 font-medium ${isLoading ? "h-3 w-52 animate-pulse rounded bg-slate-200 text-transparent" : ""}`}>
                    {isLoading ? "Memuat" : <>
                    Menampilkan <span className="font-bold text-slate-800">{customers.length ? (currentPage - 1) * itemsPerPage + 1 : 0} - {(currentPage - 1) * itemsPerPage + customers.length}</span> dari{" "}
                    <span className="font-bold text-slate-800">{totalItems}</span> pelanggan
                    </>}
                  </div>

                  {!isLoading && <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setCurrentPage(p)}
                  />}
                </div>
              </div>

              {/* Right Inspection Target Profile Drawer */}
              <div className="xl:col-span-4">
                <InspectionDrawer customer={selectedCustomer} loading={isLoading} />
              </div>
            </div>
          </main>
      </div>
    </div>
  );
}

function CustomerKpiSkeleton() {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Memuat ringkasan pelanggan" aria-busy="true">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"><div className="h-3 w-28 rounded bg-slate-200" /><div className="mt-6 h-7 w-36 rounded bg-slate-200" /><div className="mt-3 h-3 w-24 rounded bg-slate-200" /></div>)}</div>;
}
