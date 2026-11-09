"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  FileText,
  History,
  MessageSquare,
  Paperclip,
  Phone,
  RefreshCw,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import type { AssignmentRecord, OverdueInvoiceItem, StaffOption } from "@/types/overdue";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

interface OverdueInvoiceCreateViewProps {
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

function initials(name?: string) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "-"
  );
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

function followUpStatusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (s === "PROMISE_TO_PAY") return "bg-amber-100 text-amber-800 border-amber-300";
  if (s === "DISPUTE") return "bg-purple-100 text-purple-800 border-purple-300";
  if (s === "IN_PROGRESS") return "bg-blue-100 text-blue-800 border-blue-300";
  return "bg-slate-100 text-slate-700 border-slate-300";
}

export default function OverdueInvoiceCreateView({ invoiceId }: OverdueInvoiceCreateViewProps) {
  const router = useRouter();
  const cleanInvoiceId = React.useMemo(() => {
    try {
      return decodeURIComponent(invoiceId || "").trim();
    } catch {
      return (invoiceId || "").trim();
    }
  }, [invoiceId]);

  const [invoice, setInvoice] = useState<OverdueInvoiceItem | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentRecord[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states
  const [followUpStatus, setFollowUpStatus] = useState("IN_PROGRESS");
  const [contactMethod, setContactMethod] = useState("Chat (WhatsApp / Lainnya)");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setEvidenceFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(`Ukuran file melebihi batas maksimal 5MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setEvidenceFile(null);
      return;
    }
    setEvidenceFile(file);
  };

  const refreshHistory = useCallback(() => {
    fetch(`/api/v1/overdue/${encodeURIComponent(cleanInvoiceId)}/assign?refresh=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    })
      .then(async (response) => ({
        ok: response.ok,
        body: await readJsonResponse<{ data?: AssignmentRecord[]; error?: { message?: string } }>(response),
      }))
      .then((result) => {
        if (result.ok && result.body?.data) {
          setAssignmentHistory(result.body.data);
        }
      })
      .catch(() => {});
  }, [cleanInvoiceId]);

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
      fetch(`/api/v1/overdue/${encodeURIComponent(cleanInvoiceId)}/assign?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }).then(async (res) => ({
        ok: res.ok,
        body: await readJsonResponse<{ data?: AssignmentRecord[]; error?: { message?: string } }>(res),
      })),
      fetch(`/api/v1/overdue/staff?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }).then(async (res) => ({
        ok: res.ok,
        body: await readJsonResponse<{ data?: StaffOption[]; error?: { message?: string } }>(res),
      })),
    ])
      .then(([invoiceRes, historyRes, staffRes]) => {
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
        setAssignmentHistory(historyRes.body?.data ?? []);
        setStaffOptions(staffRes.body?.data ?? []);
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

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    if (!notes.trim() && !evidenceFile && !paymentAmount.trim()) {
      showToast("Tuliskan catatan progress, masukkan jumlah bayar, atau unggah file bukti.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("followUpStatus", followUpStatus);
      formData.append("followUpAction", contactMethod);
      if (promiseDate) formData.append("promiseDate", promiseDate);
      if (notes.trim()) formData.append("notes", notes.trim());
      if (paymentAmount.trim()) formData.append("paymentAmount", paymentAmount.trim());
      if (evidenceFile) formData.append("file", evidenceFile);

      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(invoice.id || cleanInvoiceId)}/progress`, {
        method: "POST",
        body: formData,
      });

      const body = await readJsonResponse<{ success?: boolean; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Gagal menyimpan progress follow-up."));

      showToast("Progress follow-up berhasil disimpan!");
      setNotes("");
      setPromiseDate("");
      setPaymentAmount("");
      setEvidenceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      refreshHistory();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal menyimpan progress follow-up.");
    } finally {
      setSubmitting(false);
    }
  };

  const assignedStaff = invoice?.pic_assigned
    ? staffOptions.find((staff) => staff.employee_id === invoice.pic_assigned)
    : undefined;
  const picName = assignedStaff?.full_name || invoice?.pic_assigned || "-";
  const picInitials = invoice?.pic_initials || (picName === "-" ? "-" : initials(picName));

  const cleanPhone = invoice?.contact_person?.phone
    ? invoice.contact_person.phone.replace(/[^0-9]/g, "")
    : "";
  const waPhone = cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : cleanPhone;

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

      <Header pageName="Overdue Alert - Tambah Progres Follow-up" />

      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Top Back Navigation Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
          <Link
            href="/overdue-alert"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 transition group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Kembali ke Overdue Alerts</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="h-28 rounded-2xl border border-slate-200 bg-white p-6 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-96 rounded-2xl border border-slate-200 bg-white p-6 animate-pulse" />
              <div className="h-96 rounded-2xl border border-slate-200 bg-white p-6 animate-pulse" />
            </div>
          </div>
        ) : errorMessage || !invoice ? (
          <div className="rounded-2xl border border-red-200 bg-white p-12 text-center shadow-sm">
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
          <>
            {/* Invoice Overview Card */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 font-heading">
                      <AlertTriangle className="size-4" /> Internal Overdue Alert
                    </span>
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${riskClasses(invoice.risk_status)}`}>
                      {invoice.risk_status}
                    </span>
                    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold ${agingClasses(invoice.days_overdue)}`}>
                      Aging: {invoice.days_overdue} Hari
                    </span>
                  </div>

                  <h1 className="mt-2 text-xl font-bold text-slate-950 font-heading sm:text-2xl">
                    {invoice.customer_name}
                  </h1>
                  <p className="mt-1 text-xs font-mono text-slate-500">
                    No. Invoice: <strong className="text-slate-800">{invoice.invoice_number}</strong> · Jatuh Tempo:{" "}
                    <strong className="text-slate-800">{formatDate(invoice.due_date)}</strong>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Cabang: {invoice.branch || "Pusat"} {invoice.branch_code ? `(${invoice.branch_code})` : ""} · NPWP: {invoice.npwp || "-"}
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end gap-1.5 rounded-xl border border-red-100 bg-red-50/60 p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-heading">
                    Total Outstanding
                  </span>
                  <span className="text-2xl font-extrabold text-red-600 font-heading">
                    {formatRupiah(invoice.amount_overdue)}
                  </span>
                  <span className="text-[10px] text-slate-500">{invoice.payment_note || "Belum ada pembayaran"}</span>
                </div>
              </div>

              {invoice.days_overdue >= 30 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <Clock className="size-4 shrink-0 text-amber-600" />
                    <span>Overdue Threshold Active (&ge; 30 Days)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700">
                    Invoice ini telah melewati batas waktu 30 hari. Catat setiap follow-up dan bukti kontak di bawah ini.
                  </p>
                </div>
              )}

              {/* PIC Info & Fast Contact Buttons */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      picName === "-" ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {picInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">{picName}</p>
                    <p className="text-[11px] text-slate-500">
                      {picName === "-" ? "Belum ada PIC ditugaskan" : "Petugas Penagihan Terdaftar"}
                      {assignedStaff ? ` · ID: ${assignedStaff.employee_id}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center sm:justify-end gap-2">
                  {waPhone ? (
                    <a
                      href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                        `Halo, konfirmasi tagihan ${invoice.invoice_number} sebesar ${formatRupiah(
                          invoice.amount_overdue
                        )} PT Andima Transportindo.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer shadow-xs"
                    >
                      <MessageSquare className="size-3.5 text-emerald-600" />
                      <span>Chat WhatsApp</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>WhatsApp (Tidak Ada)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!invoice.contact_person?.phone || invoice.contact_person.phone === "-"}
                    onClick={() => {
                      if (invoice.contact_person?.phone && invoice.contact_person.phone !== "-") {
                        window.location.href = `tel:${invoice.contact_person.phone}`;
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer shadow-xs"
                  >
                    <Phone className="size-3.5 text-slate-600" />
                    <span>Telepon Kontak</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Main 2-Column Layout: Form & History */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
              {/* Left Column: Update Follow-up Form */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                      <FileText className="size-4" />
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 font-heading">
                      Form Progres Follow-up
                    </h2>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                    Input Progres
                  </span>
                </div>

                <form onSubmit={(e) => void handleSubmitProgress(e)} className="space-y-4">
                  {/* Status Kondisi Invoice */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Status Kondisi Invoice
                    </label>
                    <select
                      value={followUpStatus}
                      onChange={(e) => setFollowUpStatus(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="IN_PROGRESS">Dalam Proses (In Progress)</option>
                      <option value="PROMISE_TO_PAY">Janji Bayar (Promise to Pay)</option>
                      <option value="COMPLETED">Selesai / Lunas (Completed)</option>
                      <option value="DISPUTE">Sengketa / Penyesuaian (Dispute)</option>
                    </select>
                  </div>

                  {/* Cara Menghubungi Customer */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Cara Menghubungi Customer
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { id: "Tatap Muka", label: "Tatap Muka", desc: "Kunjungan langsung", icon: Users },
                        { id: "Chat (WhatsApp / Lainnya)", label: "Chat (WA / Lainnya)", desc: "Pesan WhatsApp/SMS", icon: MessageSquare },
                        { id: "Online Meeting", label: "Online Meeting", desc: "Zoom / GMeet", icon: Video },
                      ].map((item) => {
                        const IconComponent = item.icon;
                        const isSelected = contactMethod === item.id;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => setContactMethod(item.id)}
                            className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              isSelected
                                ? "border-blue-600 bg-blue-50/80 ring-1 ring-blue-600 shadow-xs"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex size-6 items-center justify-center rounded-lg ${
                                  isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <IconComponent className="size-3.5" />
                              </span>
                              <span className={`text-xs font-bold ${isSelected ? "text-blue-950" : "text-slate-800"}`}>
                                {item.label}
                              </span>
                            </div>
                            <span className="mt-1 text-[10px] text-slate-500">{item.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Jumlah Pembayaran (Rp) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Jumlah Pembayaran (Rp) <span className="text-slate-400 font-normal">(Opsional / Jika ada pelunasan)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Contoh: 1500000"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    {paymentAmount && Number(paymentAmount) > 0 && (
                      <p className="mt-1 text-[11px] font-bold text-emerald-700">
                        Nominal tercatat: {formatRupiah(Number(paymentAmount))}
                      </p>
                    )}
                  </div>

                  {/* Tanggal Janji Bayar */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Tanggal Janji Bayar <span className="text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="date"
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Catatan Follow-up */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Catatan Follow-up
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Tuliskan ringkasan komunikasi dengan pelanggan, komitmen tanggal transfer, kendala pembayaran..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Lampiran Bukti (Maks 5MB) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-800">
                        Lampiran Bukti (Screenshot Chat / Foto / Bukti TF)
                      </label>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Maksimal 5MB
                      </span>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,.pdf,.doc,.docx"
                      className="hidden"
                      id="create-page-evidence-file"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <label
                        htmlFor="create-page-evidence-file"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
                      >
                        <Upload className="size-3.5 text-slate-500" />
                        <span>{evidenceFile ? "Ganti File Bukti" : "Pilih File Bukti"}</span>
                      </label>
                      {evidenceFile && (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-700 font-medium">
                          <Paperclip className="size-3.5 shrink-0" />
                          <span className="truncate max-w-[220px]">
                            {evidenceFile.name} ({(evidenceFile.size / (1024 * 1024)).toFixed(2)} MB)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEvidenceFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="text-slate-400 hover:text-red-600 cursor-pointer ml-1"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons: Cancel and Konfirmasi Follow-up */}
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => router.push("/overdue-alert")}
                      disabled={submitting}
                      className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60 transition cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="size-4 animate-spin" />
                          <span>Menyimpan Progress...</span>
                        </>
                      ) : (
                        <>
                          <Check className="size-4" />
                          <span>Konfirmasi Follow-up</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>

              {/* Right Column: Activity History Timeline */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <History className="size-4" />
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 font-heading">
                      Riwayat Aktivitas &amp; Log Follow-up
                    </h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                    {assignmentHistory.length} Riwayat
                  </span>
                </div>

                {assignmentHistory.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <History className="size-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-slate-600">Belum ada riwayat follow-up</p>
                    <p className="text-[11px] mt-0.5">Catatan yang diisi melalui form di sebelah kiri akan muncul di sini.</p>
                  </div>
                ) : (
                  <div className="relative ml-2 space-y-4 border-l-2 border-slate-200 pl-4 py-2">
                    {assignmentHistory.map((record) => {
                      const isAssignmentEvent = record.follow_up_status === "ASSIGNED";
                      const staffDisplayName = record.assigned_to_name || record.assigned_to;
                      const assignerDisplayName = record.assigned_by_name || "Stevanus Imanuel";
                      const hasPayment = Boolean(record.payment_amount && record.payment_amount > 0);

                      return (
                        <div key={record.assignment_id} className="relative">
                          <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              {isAssignmentEvent ? (
                                <div>
                                  <p className="text-xs font-bold text-slate-900">Penugasan PIC Penagihan</p>
                                  <p className="mt-0.5 text-xs text-slate-700">
                                    Ditugaskan kepada: <strong className="text-blue-900 font-bold">{staffDisplayName}</strong>{" "}
                                    <span className="text-[11px] text-slate-500 font-mono">({record.assigned_to})</span>
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    Ditugaskan oleh: <strong className="text-slate-800 font-semibold">{assignerDisplayName}</strong>
                                    {record.assigned_by_role && (
                                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 uppercase">
                                        {record.assigned_by_role}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-slate-900">{staffDisplayName}</p>
                                    <span className="text-[10px] text-slate-500 font-mono">({record.assigned_to})</span>
                                  </div>
                                </div>
                              )}

                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${followUpStatusBadge(
                                    record.follow_up_status
                                  )}`}
                                >
                                  {record.follow_up_status}
                                </span>
                                {record.follow_up_action && (
                                  <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
                                    Via {record.follow_up_action}
                                  </span>
                                )}
                                {hasPayment && (
                                  <span className="inline-flex rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                    Bayar: {formatRupiah(record.payment_amount!)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <span className="shrink-0 text-[11px] text-slate-400">
                              {new Date(record.assigned_at).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>

                          {record.promise_date && (
                            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                              <Calendar className="size-3.5" />
                              <span>Janji Bayar: {formatDate(record.promise_date)}</span>
                            </p>
                          )}

                          {record.notes && (
                            <p className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs italic text-slate-700 leading-relaxed">
                              &quot;{record.notes}&quot;
                            </p>
                          )}

                          {record.attachment_url && (
                            <a
                              href={record.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                            >
                              <Paperclip className="size-3" />
                              <span>Lihat Bukti Lampiran</span>
                              <ExternalLink className="size-3 opacity-60" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

