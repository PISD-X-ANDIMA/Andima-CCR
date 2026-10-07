"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import KpiSummaryCards from "@/components/KpiSummaryCards";
import InspectionDrawer from "@/components/InspectionDrawer";
import StatementOfAccountView from "@/components/StatementOfAccountView";
import CustomDropdown from "@/components/CustomDropdown";
import Pagination from "@/components/Pagination";
import { CustomerAnalyticsItem, KpiSummary, BranchLocation } from "@/types/customer";

export default function CustomerAnalyticsPage() {
  const [activeMenu, setActiveMenu] = useState("customer-analytics");
  const [activeView, setActiveView] = useState<"analytics" | "statement">("analytics");
  const [statementCustomerId, setStatementCustomerId] = useState<string>("CUST-0192");

  // Filter & Search states
  const [selectedBranch, setSelectedBranch] = useState<string>("Semua Cabang");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [paymentCycleFilter, setPaymentCycleFilter] = useState<string>("Semua Siklus Pembayaran");
  const [sortBy, setSortBy] = useState<string>("sales_profit");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(5);

  // Data states
  const [customers, setCustomers] = useState<CustomerAnalyticsItem[]>([]);
  const [kpiSummary, setKpiSummary] = useState<KpiSummary | null>(null);
  const [totalItems, setTotalItems] = useState<number>(148);
  const [totalPages, setTotalPages] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected customer for Inspection Profile Drawer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAnalyticsItem | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>(["CUST-0192"]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Fetch data from REST API handler (/api/v1/customers/analytics)
  const loadAnalyticsData = () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: itemsPerPage.toString(),
      branch: selectedBranch,
      search: searchQuery,
      paymentCycle: paymentCycleFilter,
      sortBy: sortBy,
      sortOrder: sortOrder,
    });

    fetch(`/api/v1/customers/analytics?${params.toString()}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.data) {
          setCustomers(resData.data);
          setKpiSummary(resData.kpiSummary);
          setTotalItems(resData.pagination.totalItems);
          setTotalPages(resData.pagination.totalPages);

          // Auto-select first item or current selected item
          if (resData.data.length > 0) {
            const exists = resData.data.find((item: CustomerAnalyticsItem) => item.id === selectedCustomer?.id);
            if (!exists) {
              setSelectedCustomer(resData.data[0]);
            }
          }
        }
      })
      .catch((err) => console.error("Error fetching analytics data:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [currentPage, selectedBranch, searchQuery, paymentCycleFilter, sortBy, sortOrder]);

  const handleOpenStatement = (customerId: string) => {
    setStatementCustomerId(customerId);
    setActiveView("statement");
  };

  const handleToggleCheckRow = (id: string) => {
    if (checkedIds.includes(id)) {
      setCheckedIds(checkedIds.filter((item) => item !== id));
    } else {
      setCheckedIds([...checkedIds, id]);
    }
  };

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
        <Header pageName={activeView === "statement" ? "Statement of Account" : "Customer Analytics"} />

        {/* View Switcher: Statement of Account OR Main Customer Analytics View */}
        {activeView === "statement" ? (
          <StatementOfAccountView
            customerId={statementCustomerId}
            onBack={() => setActiveView("analytics")}
          />
        ) : (
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
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs">
                  <span>📅 Kuartal Berjalan:</span>
                  <span className="font-extrabold text-slate-900">Q3-2026 (Juli - Sep)</span>
                </div>

                <button
                  onClick={loadAnalyticsData}
                  className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Sinkronisasi Data</span>
                </button>

                <button className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-md transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Ekspor Portofolio (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            {kpiSummary && <KpiSummaryCards kpi={kpiSummary} />}

            {/* Search & Filter Controls Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                {/* Left Search Box */}
                <div className="w-full lg:w-96 relative">
                  <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search Customer name, NPWP..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Right Filter Dropdowns */}
                <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                  <div className="w-56">
                    <CustomDropdown
                      placeholder={paymentCycleFilter}
                      categoryTitle="SIKLUS PEMBAYARAN"
                      categoryBadge="Filter"
                      items={[
                        { id: "all", label: "Semua Siklus Pembayaran" },
                        { id: "safe", label: "Lancar (< 30 Hari)" },
                        { id: "overdue", label: "Overdue (> 30 Hari)" },
                      ]}
                      value={paymentCycleFilter}
                      onChange={(item) => {
                        setPaymentCycleFilter(item.label);
                        setCurrentPage(1);
                      }}
                    />
                  </div>

                  <button className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Unduh CSV</span>
                  </button>
                </div>
              </div>

              {/* Branch Filter Tabs (KANTOR CABANG:) */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs">
                <span className="font-extrabold text-slate-400 uppercase tracking-wider mr-2 text-[10px]">
                  KANTOR CABANG:
                </span>

                {[
                  { label: "Semua Cabang", count: 148 },
                  { label: "Jakarta", count: 62 },
                  { label: "Semarang", count: 26 },
                  { label: "Surabaya", count: 38 },
                  { label: "Balikpapan", count: 22 },
                  { label: "Medan", count: 14 },
                ].map((b) => {
                  const isSelected = selectedBranch === b.label;
                  return (
                    <button
                      key={b.label}
                      onClick={() => {
                        setSelectedBranch(b.label);
                        setCurrentPage(1);
                      }}
                      className={`px-3.5 py-1.5 rounded-full font-bold transition-all ${
                        isSelected
                          ? "bg-[#0F172A] text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {b.label} ({b.count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Split View: Left Table & Right Inspection Profile Panel */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Customer Analytics Table */}
              <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[650px]">
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
                            className="w-4 h-4 rounded accent-[#0F172A]"
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

                        <th className="px-4 py-3.5">BRANCH OFFICE</th>

                        <th
                          onClick={() => handleSort("sales_profit")}
                          className="px-4 py-3.5 text-right cursor-pointer hover:text-slate-800 transition"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>SALES PROFIT (MO.)</span>
                            {sortBy === "sales_profit" && (sortOrder === "asc" ? "▲" : "▼")}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSort("cost")}
                          className="px-4 py-3.5 text-right cursor-pointer hover:text-slate-800 transition"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>COST (MO.)</span>
                            {sortBy === "cost" && (sortOrder === "asc" ? "▲" : "▼")}
                          </div>
                        </th>

                        <th
                          onClick={() => handleSort("total_outstanding")}
                          className="px-4 py-3.5 text-right cursor-pointer hover:text-slate-800 transition"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>TOTAL OUTSTANDING</span>
                            {sortBy === "total_outstanding" && (sortOrder === "asc" ? "▲" : "▼")}
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                            Memuat data pelanggan...
                          </td>
                        </tr>
                      ) : customers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
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
                              onClick={() => setSelectedCustomer(c)}
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
                                  className="w-4 h-4 rounded accent-[#0F172A]"
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
                                      {c.id} / NPWP: {c.npwp}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 font-bold text-[11px]">
                                  {c.branch_office_badge}
                                </span>
                              </td>

                              <td className="px-4 py-4 text-right">
                                <div className="font-extrabold text-emerald-600 flex items-center justify-end gap-1">
                                  <span>{formatRupiah(c.sales_profit)}</span>
                                  <span className="text-[10px]">▲</span>
                                </div>
                              </td>

                              <td className="px-4 py-4 text-right font-extrabold text-slate-500">
                                {formatRupiah(c.cost)}
                              </td>

                              <td className="px-4 py-4 text-right font-extrabold text-slate-900">
                                {formatRupiah(c.total_outstanding)}
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
                  <div className="text-xs text-slate-500 font-medium">
                    Menampilkan <span className="font-bold text-slate-800">1 - {customers.length}</span> dari{" "}
                    <span className="font-bold text-slate-800">{totalItems}</span> pelanggan
                  </div>

                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setCurrentPage(p)}
                  />
                </div>
              </div>

              {/* Right Inspection Target Profile Drawer */}
              <div className="xl:col-span-4">
                <InspectionDrawer
                  customer={selectedCustomer}
                  onOpenStatement={handleOpenStatement}
                  onRefreshData={loadAnalyticsData}
                />
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
