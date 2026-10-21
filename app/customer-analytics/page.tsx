"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import KpiSummaryCards from "@/components/KpiSummaryCards";
import Pagination from "@/components/Pagination";
import { CustomerAnalyticsItem, KpiSummary } from "@/types/customer";
import { RefreshCw, Search } from "lucide-react";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

export default function CustomerAnalyticsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [branch, setBranch] = useState("All Branches");
  const [sortBy, setSortBy] = useState("sales_profit");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [customers, setCustomers] = useState<CustomerAnalyticsItem[]>([]);
  const [kpiSummary, setKpiSummary] = useState<KpiSummary | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const itemsPerPage = 5;

  const loadAnalyticsData = useCallback(async () => {
    if (!hydrated) return;
    setIsLoading(true);
    const apiBranch = branch === "All Branches" ? "Semua Cabang" : branch;
    const params = new URLSearchParams({ page: String(currentPage), limit: String(itemsPerPage), branch: apiBranch, search: searchQuery.trim(), sortBy, sortOrder });
    try {
      const response = await fetch(`/api/v1/customers/analytics?${params.toString()}`, { cache: "no-store" });
      const body = (await readJsonResponse<{ data?: CustomerAnalyticsItem[]; kpiSummary?: KpiSummary; pagination?: { totalItems?: number; totalPages?: number }; error?: { message?: string }; message?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(responseMessage(body, "Failed to load customer analytics data."));
      setCustomers(body.data ?? []);
      setKpiSummary(body.kpiSummary ?? null);
      setTotalItems(body.pagination?.totalItems ?? 0);
      setTotalPages(body.pagination?.totalPages ?? 1);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load customer analytics data.");
      setCustomers([]);
      setKpiSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [branch, currentPage, hydrated, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setSearchQuery(query.get("search") ?? "");
    const initialBranch = query.get("branch") ?? "All Branches";
    setBranch(initialBranch === "Semua Cabang" ? "All Branches" : initialBranch);
    setSortBy(query.get("sortBy") ?? "sales_profit");
    setSortOrder(query.get("sortOrder") === "asc" ? "asc" : "desc");
    setCurrentPage(Math.max(1, Number(query.get("page") ?? "1") || 1));
    setHydrated(true);
  }, []);
  useEffect(() => { void loadAnalyticsData(); }, [loadAnalyticsData]);

  const returnTo = `/customer-analytics?${new URLSearchParams({ branch, search: searchQuery, page: String(currentPage), sortBy, sortOrder }).toString()}`;
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      <div className="flex min-h-screen flex-col">
        <Header pageName="Customer Analytics" />
        <main className="flex-1 space-y-6 p-6 md:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-heading">CCR: Customer Analytics</h1>
              <p className="mt-1 text-xs font-medium text-slate-500">Unique company portfolio from validated C1 records.</p>
            </div>
            <button type="button" onClick={() => void loadAnalyticsData()} disabled={isLoading} className="inline-flex items-center gap-2 self-start rounded-xl bg-[#3B6FF5] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-600 disabled:opacity-60 cursor-pointer">
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />Refresh
            </button>
          </div>
          {isLoading ? <CustomerKpiSkeleton /> : kpiSummary && <KpiSummaryCards kpi={kpiSummary} />}
          {loadError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{loadError}</div>}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:w-96">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} placeholder="Search company name or code..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  Branch
                  <select value={branch} onChange={(event) => { setBranch(event.target.value); setCurrentPage(1); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700">
                    <option>All Branches</option>
                    <option>Jakarta</option>
                    <option>Semarang</option>
                    <option>Surabaya</option>
                    <option>Balikpapan</option>
                    <option>Medan</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  Sort by
                  <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setCurrentPage(1); }} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700">
                    <option value="sales_profit">Profit</option>
                    <option value="total_outstanding">Outstanding</option>
                    <option value="customer_name">Name</option>
                  </select>
                </label>
                <button type="button" onClick={() => setSortOrder((current) => current === "asc" ? "desc" : "asc")} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 cursor-pointer" aria-label="Toggle sort order">
                  {sortOrder === "asc" ? "Ascending" : "Descending"}
                </button>
              </div>
            </div>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="px-6 py-3.5">Company</th>
                    <th className="px-6 py-3.5">Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr><td colSpan={2} className="px-6 py-12 text-center font-medium text-slate-400">Loading company data...</td></tr>
                  ) : customers.length === 0 ? (
                    <tr><td colSpan={2} className="px-6 py-12 text-center font-medium text-slate-400">No companies found matching search criteria.</td></tr>
                  ) : (
                    customers.map((customer) => {
                      const initials = customer.customer_name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
                      const codes = customer.customer_codes ?? (customer.customer_code ? [customer.customer_code] : []);
                      const companyId = customer.company_group_id ?? customer.customer_id ?? customer.id;
                      const href = `/customer-analytics/${encodeURIComponent(companyId)}?returnTo=${encodeURIComponent(returnTo)}`;
                      return (
                        <tr key={companyId} className="transition-colors hover:bg-blue-50/60">
                          <td className="px-6 py-4">
                            <Link href={href} className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">{initials}</span>
                              <span className="min-w-0">
                                <span className="block font-bold text-blue-700 font-heading">{customer.customer_name}</span>
                                <span className="mt-1 block text-[11px] font-medium text-slate-500">{codes.length ? `${codes.length} customer codes` : "No customer codes"}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600">{customer.branch}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4 text-xs text-slate-500 sm:flex-row">
              <span>Showing {customers.length ? (currentPage - 1) * itemsPerPage + 1 : 0}-{(currentPage - 1) * itemsPerPage + customers.length} of {totalItems} companies</span>
              {!isLoading && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function CustomerKpiSkeleton() { return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Loading company summary" aria-busy="true">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"><div className="h-3 w-28 rounded bg-slate-200" /><div className="mt-6 h-7 w-36 rounded bg-slate-200" /><div className="mt-3 h-3 w-24 rounded bg-slate-200" /></div>)}</div>; }
