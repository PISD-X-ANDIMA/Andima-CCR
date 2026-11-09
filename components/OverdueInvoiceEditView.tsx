"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  RefreshCw,
  Search,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import type { OverdueInvoiceItem, StaffOption } from "@/types/overdue";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

interface OverdueInvoiceEditViewProps {
  invoiceId: string;
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value || value === "-") return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function riskClasses(status: string) {
  const s = status.toUpperCase();
  if (s === "LEGAL ESCALATION") return "border-red-200 bg-red-50 text-red-700";
  if (s === "HIGH RISK") return "border-amber-200 bg-amber-50 text-amber-700";
  if (s === "WATCHLIST") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function agingClasses(days: number) {
  if (days > 60) return "bg-red-100 text-red-700";
  if (days > 30) return "bg-orange-50 text-orange-700";
  return "bg-blue-50 text-blue-700";
}

export default function OverdueInvoiceEditView({ invoiceId }: OverdueInvoiceEditViewProps) {
  const router = useRouter();
  const cleanInvoiceId = useMemo(() => {
    try {
      return decodeURIComponent(invoiceId || "").trim();
    } catch {
      return (invoiceId || "").trim();
    }
  }, [invoiceId]);

  const [invoice, setInvoice] = useState<OverdueInvoiceItem | null>(null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [canAssign, setCanAssign] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [searchStaff, setSearchStaff] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    setErrorMessage(null);

    Promise.all([
      fetch(`/api/v1/overdue?search=${encodeURIComponent(cleanInvoiceId)}&onlyOverdue30=false&refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }).then(async (res) => ({
        ok: res.ok,
        body: await readJsonResponse<{ invoices?: OverdueInvoiceItem[]; error?: { message?: string } }>(res),
      })),
      fetch(`/api/v1/overdue/staff?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }).then(async (res) => ({
        ok: res.ok,
        body: await readJsonResponse<{ data?: StaffOption[]; canAssign?: boolean; error?: { message?: string } }>(res),
      })),
    ])
      .then(([invoiceRes, staffRes]) => {
        if (!invoiceRes.ok) {
          throw new Error(responseMessage(invoiceRes.body, "Gagal memuat data invoice overdue."));
        }

        const normalizedTarget = cleanInvoiceId.toLowerCase();
        const found = (invoiceRes.body?.invoices ?? []).find(
          (inv) =>
            inv.id.trim().toLowerCase() === normalizedTarget ||
            inv.invoice_number.trim().toLowerCase() === normalizedTarget ||
            inv.id.trim() === cleanInvoiceId ||
            inv.invoice_number.trim() === cleanInvoiceId
        );

        if (!found) {
          throw new Error(`Invoice "${cleanInvoiceId}" tidak ditemukan.`);
        }

        setInvoice(found);
        const options = staffRes.body?.data ?? [];
        setStaffOptions(options);
        setCanAssign(staffRes.body?.canAssign ?? true);

        // Pre-select current assigned staff if available
        if (found.pic_assigned) {
          setSelectedStaffId(found.pic_assigned);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Gagal memuat data.";
        setErrorMessage(msg);
      })
      .finally(() => setLoading(false));
  }, [cleanInvoiceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredStaff = useMemo(() => {
    const q = searchStaff.trim().toLowerCase();
    if (!q) return staffOptions;
    return staffOptions.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.employee_id.toLowerCase().includes(q)
    );
  }, [staffOptions, searchStaff]);

  const selectedStaffObj = useMemo(
    () => staffOptions.find((s) => s.employee_id === selectedStaffId),
    [staffOptions, selectedStaffId]
  );

  const currentAssignedStaff = useMemo(
    () => (invoice?.pic_assigned ? staffOptions.find((s) => s.employee_id === invoice.pic_assigned) : undefined),
    [invoice?.pic_assigned, staffOptions]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !selectedStaffId || !canAssign || submitting) {
      if (!selectedStaffId) showToast("Pilih salah satu staf PIC.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(invoice.id || cleanInvoiceId)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: selectedStaffId }),
      });

      const body = await readJsonResponse<{ error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Gagal menugaskan PIC."));

      const staff = staffOptions.find((item) => item.employee_id === selectedStaffId);
      showToast(`PIC ${staff?.full_name ?? selectedStaffId} berhasil diperbarui.`);

      // Redirect back to overdue alerts after short delay
      setTimeout(() => {
        router.push("/overdue-alert");
      }, 1000);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal memperbarui PIC.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {toastMessage && (
        <div
          role="status"
          className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in slide-in-from-top-2"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Header pageName="Overdue Alert - Ubah PIC Penagihan" />

      <main className="mx-auto w-full max-w-2xl py-6 sm:py-10 px-4">
        {/* Top Back Navigation */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/overdue-alert"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 transition group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Kembali ke Overdue Alerts</span>
          </Link>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4 animate-pulse">
            <div className="h-6 w-48 rounded bg-slate-200" />
            <div className="h-16 rounded-xl bg-slate-100" />
            <div className="h-10 rounded-xl bg-slate-100" />
            <div className="h-40 rounded-xl bg-slate-100" />
            <div className="h-10 rounded-xl bg-slate-200" />
          </div>
        ) : errorMessage || !invoice ? (
          <div className="rounded-2xl border border-red-200 bg-white p-10 text-center shadow-sm">
            <AlertCircle className="mx-auto size-8 text-red-500 mb-3" />
            <h2 className="text-base font-bold text-slate-900 font-heading">Gagal Memuat Invoice</h2>
            <p className="mt-1 text-xs text-red-600">{errorMessage || "Invoice tidak ditemukan."}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/overdue-alert"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Kembali ke Daftar Overdue
              </Link>
              <button
                type="button"
                onClick={loadData}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        ) : (
          /* Compact Ganti PIC Card */
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-xs">
                  <UserCheck className="size-5" />
                </span>
                <div>
                  <h1 className="text-base font-bold text-slate-900 font-heading">
                    Ubah PIC Penagihan
                  </h1>
                  <p className="text-xs text-slate-500">
                    Perbarui staf CCR yang ditugaskan untuk menangani invoice ini
                  </p>
                </div>
              </div>
            </div>

            {/* Invoice Summary Strip */}
            <div className="border-b border-slate-100 bg-blue-50/40 px-6 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-blue-700">
                  {invoice.invoice_number}
                </span>
                <span className="text-base font-extrabold text-red-600 font-heading">
                  {formatRupiah(invoice.amount_overdue)}
                </span>
              </div>
              <p className="font-semibold text-slate-900 text-xs truncate">
                {invoice.customer_name}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${riskClasses(invoice.risk_status)}`}>
                  {invoice.risk_status}
                </span>
                <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold ${agingClasses(invoice.days_overdue)}`}>
                  Overdue {invoice.days_overdue} Hari
                </span>
                <span className="text-[11px] text-slate-500">
                  Jatuh Tempo: <strong className="text-slate-700">{formatDate(invoice.due_date)}</strong>
                </span>
              </div>

              {/* Current PIC banner */}
              <div className="mt-2 rounded-lg border border-slate-200 bg-white/80 p-2.5 text-xs text-slate-700 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">PIC Saat Ini:</span>
                <span className="font-bold text-slate-900">
                  {currentAssignedStaff?.full_name || invoice.pic_assigned || "Belum ada PIC"}
                  {currentAssignedStaff && (
                    <span className="ml-1 text-[11px] font-normal font-mono text-slate-500">
                      ({currentAssignedStaff.employee_id})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Staff Search Input */}
            <div className="px-6 pt-4 pb-2">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={searchStaff}
                  onChange={(e) => setSearchStaff(e.target.value)}
                  placeholder="Cari nama staff atau ID karyawan..."
                  disabled={!canAssign}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-9 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                {searchStaff && (
                  <button
                    type="button"
                    onClick={() => setSearchStaff("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </label>
            </div>

            {/* Staff List */}
            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2 max-h-[340px]">
              {!canAssign ? (
                <div className="py-8 text-center text-xs text-amber-700">
                  <p className="font-semibold">Akses Terbatas</p>
                  <p className="text-[11px] mt-1 text-slate-500">
                    Hanya role Management yang berwenang menugaskan PIC.
                  </p>
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  <UserRound className="size-7 mx-auto mb-2 opacity-40" />
                  <p className="font-semibold text-slate-600">Tidak ada staf yang sesuai</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Coba kata kunci pencarian yang lain.
                  </p>
                </div>
              ) : (
                filteredStaff.map((staff) => {
                  const isSelected = selectedStaffId === staff.employee_id;
                  const staffInit = staff.full_name
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={staff.employee_id}
                      onClick={() => setSelectedStaffId(staff.employee_id)}
                      className={`flex items-center justify-between rounded-xl border p-3.5 transition cursor-pointer ${
                        isSelected
                          ? "border-blue-500 bg-blue-50/80 ring-1 ring-blue-500 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {staffInit}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`truncate text-xs font-bold ${
                              isSelected ? "text-blue-950" : "text-slate-900"
                            }`}
                          >
                            {staff.full_name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] text-slate-500 font-semibold">
                              {staff.employee_id}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 uppercase">
                              Staff CCR
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="ml-3 shrink-0">
                        <span
                          className={`flex size-5 items-center justify-center rounded-full border transition ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="size-3 stroke-[3]" />}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Staff Summary */}
            {selectedStaffObj && (
              <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3 text-xs flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Staf Terpilih:</span>
                <span className="font-bold text-blue-700">
                  {selectedStaffObj.full_name} ({selectedStaffObj.employee_id})
                </span>
              </div>
            )}

            {/* Card Footer Actions */}
            <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => router.push("/overdue-alert")}
                disabled={submitting}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!canAssign || !selectedStaffId || submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    <span>Simpan Perubahan PIC</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
