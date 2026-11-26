"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ExternalLink,
  History,
  MessageSquare,
  Paperclip,
  Phone,
  RefreshCw,
  Upload,
  UserCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import HeaderAccount from "@/components/headeraccount";
import FollowUpFormSkeleton from "@/components/FollowUpFormSkeleton";
import { DatePicker } from "@/components/CalendarModal";
import type { AssignmentRecord, OverdueInvoiceItem, StaffOption } from "@/types/overdue";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { followUpActionLabel, followUpStatusLabel } from "@/lib/followUpLabels";
import { showToast as swalToast } from "@/lib/swal";

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

function formatDate(value?: string | null, language: string = "en") {
  if (!value || value === "-") return "-";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(language === "id" ? "id-ID" : "en-US", { day: "2-digit", month: "short", year: "numeric" });
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
  if (s.includes("LEGAL") || s.includes("HIGH")) return "border-red-200 bg-red-50 text-red-700";
  if (s.includes("MEDIUM")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (s.includes("WATCHLIST")) return "border-slate-200 bg-slate-100 text-slate-700";
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
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const cleanInvoiceId = useMemo(() => {
    try {
      return decodeURIComponent(invoiceId || "").trim();
    } catch {
      return (invoiceId || "").trim();
    }
  }, [invoiceId]);

  const [invoice, setInvoice] = useState<OverdueInvoiceItem | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentRecord[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [followUpStatus, setFollowUpStatus] = useState("IN_PROGRESS");
  const [contactMethod, setContactMethod] = useState("Chat (WhatsApp / Others)");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    notes?: string;
    promiseDate?: string;
    paymentAmount?: string;
    evidenceFile?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((message: string) => {
    const isError =
      message.toLowerCase().includes("fail") ||
      message.toLowerCase().includes("gagal") ||
      message.toLowerCase().includes("required") ||
      message.toLowerCase().includes("cannot") ||
      message.toLowerCase().includes("exceeds");
    swalToast({
      title: message,
      icon: isError ? "error" : "success",
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setEvidenceFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        evidenceFile: `File size exceeds the 5MB maximum limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
      }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      setEvidenceFile(null);
      return;
    }
    setFieldErrors((prev) => ({ ...prev, evidenceFile: undefined }));
    setEvidenceFile(file);
  };

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
      fetch(`/api/v1/account/me?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }).then(async (res) => ({
        ok: res.ok,
        body: await readJsonResponse<{ data?: { app_role?: string | null } }>(res),
      })),
    ])
      .then(([invoiceRes, historyRes, staffRes, accountRes]) => {
        if (!invoiceRes.ok) {
          throw new Error(responseMessage(invoiceRes.body, "Failed to load overdue invoice data."));
        }
        if (accountRes?.body?.data?.app_role) {
          setUserRole(accountRes.body.data.app_role);
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
          throw new Error(`Invoice "${cleanInvoiceId}" not found.`);
        }

        setInvoice(found);
        setAssignmentHistory(historyRes.body?.data ?? []);
        setStaffOptions(staffRes.body?.data ?? []);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load data.";
        setErrorMessage(msg);
      })
      .finally(() => setLoading(false));
  }, [cleanInvoiceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (followUpStatus === "COMPLETED" && !paymentAmount && invoice?.amount_overdue) {
      setPaymentAmount(String(invoice.amount_overdue));
    }
  }, [followUpStatus, paymentAmount, invoice?.amount_overdue]);

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    if (userRole === "MANAGEMENT") {
      return;
    }

    const errors: {
      notes?: string;
      promiseDate?: string;
      paymentAmount?: string;
      evidenceFile?: string;
    } = {};

    if (followUpStatus === "PROMISE_TO_PAY" && !promiseDate) {
      errors.promiseDate = t("overdue.promiseDateRequired", "Promise to pay date is required.");
    }

    if (followUpStatus === "COMPLETED") {
      if (!paymentAmount.trim() || Number(paymentAmount) <= 0) {
        errors.paymentAmount = t("overdue.paymentAmountRequired", "Payment amount is required.");
      }
      if (!evidenceFile) {
        errors.evidenceFile = t("overdue.proofRequired", "Proof of payment/settlement is required.");
      }
    }

    if (!notes.trim()) {
      errors.notes = t("overdue.notesRequired", "Follow-up notes are required.");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("followUpStatus", followUpStatus);
      if (followUpStatus !== "COMPLETED") {
        formData.append("followUpAction", contactMethod);
      }
      if (promiseDate && followUpStatus === "PROMISE_TO_PAY") {
        formData.append("promiseDate", promiseDate);
      }
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }
      if (paymentAmount.trim() && followUpStatus === "COMPLETED") {
        formData.append("paymentAmount", paymentAmount.trim());
      }
      if (evidenceFile) {
        formData.append("file", evidenceFile);
      }

      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(invoice.id || cleanInvoiceId)}/progress`, {
        method: "POST",
        body: formData,
      });

      const body = await readJsonResponse<{ success?: boolean; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Failed to save follow-up progress."));

      if (followUpStatus === "COMPLETED") {
        showToast("Invoice marked as paid and settled successfully. Returning to Overdue Alerts...");
      } else {
        showToast("Follow-up progress saved successfully!");
      }
      router.push("/overdue-alert");
    } catch (err: unknown) {
      setFieldErrors((prev) => ({
        ...prev,
        notes: err instanceof Error ? err.message : "Failed to save follow-up progress.",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const assignedStaff = invoice?.pic_assigned
    ? staffOptions.find((staff) => staff.employee_id === invoice.pic_assigned)
    : undefined;
  const picName = assignedStaff?.full_name || invoice?.pic_assigned || "-";
  const picInitials = invoice?.pic_initials || (picName === "-" ? "-" : initials(picName));

  const rawPhone = invoice?.contact_person?.phone && invoice.contact_person.phone !== "-" ? invoice.contact_person.phone : "";
  const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
  const waPhone = cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : cleanPhone;
  const contactName =
    invoice?.contact_person?.name &&
      invoice.contact_person.name !== "-" &&
      invoice.contact_person.name !== "Kontak tidak tersedia" &&
      invoice.contact_person.name !== "Contact not available"
      ? invoice.contact_person.name
      : null;
  const hasContact = Boolean(contactName || rawPhone);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header bar matching Customer Analytics Detail style */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex w-full items-center justify-between px-6 py-4 md:px-8">
          <Link
            href="/overdue-alert"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-700 transition group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>{t("overdue.backToOverdue", "Back to Overdue Alerts")}</span>
          </Link>
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div
              role="group"
              aria-label={t("nav.selectLanguage", "Select language")}
              className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold"
            >
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`rounded-md px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
                  language === "en"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                aria-label={t("nav.switchToEnglish", "Switch language to English")}
                aria-pressed={language === "en"}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("id")}
                className={`rounded-md px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
                  language === "id"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                aria-label={t("nav.switchToIndonesian", "Switch language to Indonesian")}
                aria-pressed={language === "id"}
              >
                ID
              </button>
            </div>
            <HeaderAccount />
          </div>
        </div>
      </header>

      {/* Main Container stretched wide (mepet sidebar) */}
      <main className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <FollowUpFormSkeleton isInnerOnly />
        ) : errorMessage || !invoice ? (
          <div className="rounded-2xl border border-red-200 bg-white p-12 text-center shadow-sm">
            <AlertCircle className="mx-auto size-8 text-red-500 mb-3" />
            <h2 className="text-base font-bold text-slate-900 font-heading">{t("overdue.failedToLoadInvoice", "Failed to Load Invoice")}</h2>
            <p className="mt-1 text-xs text-red-600">{errorMessage || t("overdue.invoiceNotFound", "Invoice not found.")}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/overdue-alert"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t("overdue.backToOverdue", "Back to Overdue Alerts")}
              </Link>
              <button
                type="button"
                onClick={loadData}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
              >
                {t("common.tryAgain", "Try Again")}
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
                      <AlertTriangle className="size-4" /> {t("overdue.internalAlert", "Internal Overdue Alert")}
                    </span>
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${riskClasses(invoice.risk_status)}`}>
                      {invoice.risk_status}
                    </span>
                    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold ${agingClasses(invoice.days_overdue)}`}>
                      {t("overdue.colAging", "Aging")}: {invoice.days_overdue} {t("common.days", "Days")}
                    </span>
                  </div>

                  <h1 className="mt-2 text-xl font-bold text-slate-950 font-heading sm:text-2xl">
                    {invoice.customer_name}
                  </h1>
                  <p className="mt-1 text-xs font-mono text-slate-500">
                    {t("overdue.invoiceNoLabel", "Invoice No.:")} <strong className="text-slate-800">{invoice.invoice_number}</strong> · {t("common.dueDate", "Due Date")}:{" "}
                    <strong className="text-slate-800">{formatDate(invoice.due_date, language)}</strong>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {hasContact
                      ? `${contactName || t("overdue.customerContact", "Customer Contact")}${rawPhone ? ` (${rawPhone})` : ""}`
                      : t("overdue.contactUnavailable", "Contact not available")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    NPWP: {invoice.npwp || "-"}
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end gap-1.5 rounded-xl border border-red-100 bg-red-50/60 p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-heading">
                    {t("overdue.totalOutstanding", "Total Outstanding")}
                  </span>
                  <span className="text-2xl font-extrabold text-red-600 font-heading">
                    {formatRupiah(invoice.amount_overdue)}
                  </span>
                  <span className="text-[10px] text-slate-500">{invoice.payment_note || t("overdue.noPaymentsYet", "No payments yet")}</span>
                </div>
              </div>

              {/* PIC Info & Fast Contact Buttons */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${picName === "-" ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-700"
                      }`}
                  >
                    {picInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">{picName}</p>
                    <p className="text-[11px] text-slate-500">
                      {picName === "-" ? t("overdue.noPicAssigned", "No PIC assigned yet") : t("overdue.registeredOfficer", "Registered Collection Officer")}
                      {assignedStaff ? ` · ID: ${assignedStaff.employee_id}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center sm:justify-end gap-2">
                  {waPhone && hasContact ? (
                    <a
                      href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                        language === "id"
                          ? `Halo, konfirmasi tagihan ${invoice.invoice_number} sebesar ${formatRupiah(
                            invoice.amount_overdue
                          )} PT Andima Transportindo.`
                          : `Hello, payment reminder for invoice ${invoice.invoice_number} of ${formatRupiah(
                            invoice.amount_overdue
                          )} from PT Andima Transportindo.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer shadow-xs"
                    >
                      <MessageSquare className="size-3.5 text-emerald-600" />
                      <span>{t("overdue.chatWhatsappBtn", "Chat WhatsApp")}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>{t("overdue.whatsappUnavailable", "WhatsApp (Unavailable)")}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!rawPhone}
                    onClick={() => {
                      if (rawPhone) {
                        window.location.href = `tel:${rawPhone}`;
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer shadow-xs"
                  >
                    <Phone className="size-3.5 text-slate-600" />
                    <span>{t("common.call", "Call")}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Form Section takes full width */}
            {userRole === "MANAGEMENT" ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-xs space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                    <UserCheck className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-amber-950 font-heading">
                      {t("overdue.restrictedToStaffTitle", "Follow-up Creation Restricted to Staff")}
                    </h2>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {t("overdue.restrictedToStaffDesc", "Management accounts have read-only access to follow-up logs. Staff members handle daily collection progress.")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href={`/overdue-alert/${encodeURIComponent(cleanInvoiceId)}/edit`}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                  >
                    <UserCheck className="size-4" />
                    <span>{t("overdue.managePicAssignment", "Manage PIC Assignment")}</span>
                  </Link>
                  <Link
                    href="/overdue-alert"
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100 transition"
                  >
                    <ArrowLeft className="size-4" />
                    <span>{t("overdue.backToOverdue", "Back to Overdue Alerts")}</span>
                  </Link>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 font-heading">
                      {t("overdue.followUpFormTitle", "Follow-up Progress Form")}
                    </h2>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                    {t("overdue.recordProgressBadge", "Record Progress")}
                  </span>
                </div>

                <form onSubmit={(e) => void handleSubmitProgress(e)} className="space-y-5">
                  {/* Status Invoice */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      {t("overdue.invoiceStatusLabel", "Status Invoice")}
                    </label>
                    <select
                      value={followUpStatus}
                      onChange={(e) => setFollowUpStatus(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    >
                      {language === "id" ? (
                        <>
                          <option value="IN_PROGRESS">{t("overdue.statusInProgress", "Dalam Proses")}</option>
                          <option value="PROMISE_TO_PAY">{t("overdue.statusPromiseToPay", "Janji Bayar")}</option>
                          <option value="COMPLETED">{t("overdue.statusCompleted", "Selesai / Lunas")}</option>
                          <option value="DISPUTE">{t("overdue.statusDispute", "Sengketa / Dispute")}</option>
                        </>
                      ) : (
                        <>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="PROMISE_TO_PAY">Promise to Pay</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="DISPUTE">Dispute</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* Conditional Fields: Customer Contact Method (for non-completed) */}
                  {followUpStatus !== "COMPLETED" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {t("overdue.contactMethodLabel", "Customer Contact Method")}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { id: "Direct Visit", label: t("overdue.directVisit", "Direct Visit"), desc: t("overdue.directVisitDesc", "Direct in-person visit"), icon: Users },
                          { id: "Chat (WhatsApp / Others)", label: t("overdue.chatWhatsapp", "Chat (WhatsApp / Others)"), desc: t("overdue.chatWhatsappDesc", "WhatsApp or SMS message"), icon: MessageSquare },
                          { id: "Online Meeting", label: t("overdue.onlineMeeting", "Online Meeting"), desc: t("overdue.onlineMeetingDesc", "Zoom or Google Meet"), icon: Video },
                        ].map((item) => {
                          const IconComponent = item.icon;
                          const isSelected = contactMethod === item.id;
                          return (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() => setContactMethod(item.id)}
                              className={`flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer ${isSelected
                                ? "border-blue-600 bg-blue-50/80 ring-1 ring-blue-600 shadow-xs"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`flex size-6 items-center justify-center rounded-lg ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
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
                  )}

                  {/* Conditional Field: Promise to Pay Date (for Promise to Pay only) */}
                  {followUpStatus === "PROMISE_TO_PAY" && (
                    <div>
                      {fieldErrors.promiseDate && (
                        <p className="text-xs font-semibold text-red-600 mb-1.5">{fieldErrors.promiseDate}</p>
                      )}
                      <DatePicker
                        label={t("overdue.promiseDateLabel", "Promise to Pay Date")}
                        value={promiseDate}
                        onChange={(d) => {
                          setPromiseDate(d);
                          if (fieldErrors.promiseDate) {
                            setFieldErrors((prev) => ({ ...prev, promiseDate: undefined }));
                          }
                        }}
                        placeholder="YYYY-MM-DD"
                      />
                    </div>
                  )}

                  {/* Conditional Field: Jumlah Pembayaran (for Completed only) */}
                  {followUpStatus === "COMPLETED" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        {t("overdue.paymentAmountLabel", "Payment Amount (IDR)")}
                      </label>
                      {fieldErrors.paymentAmount && (
                        <p className="text-xs font-semibold text-red-600 mb-1.5">{fieldErrors.paymentAmount}</p>
                      )}
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={paymentAmount}
                          onChange={(e) => {
                            setPaymentAmount(e.target.value);
                            if (fieldErrors.paymentAmount) {
                              setFieldErrors((prev) => ({ ...prev, paymentAmount: undefined }));
                            }
                          }}
                          placeholder={t("overdue.paymentAmountPlaceholder", "Enter total payment amount")}
                          className={`w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:bg-white focus:ring-2 ${
                            fieldErrors.paymentAmount
                              ? "border-red-500 focus:border-red-600 focus:ring-red-100"
                              : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                          }`}
                        />
                      </div>
                      {paymentAmount && Number(paymentAmount) > 0 && (
                        <p className="mt-1 text-[11px] font-bold text-emerald-700">
                          {t("overdue.recordedAmountLabel", "Recorded amount:")} {formatRupiah(Number(paymentAmount))}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Follow-up Notes (dynamic label per status, mandatory) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      {followUpStatus === "DISPUTE"
                        ? t("overdue.disputeNotesLabel", "Dispute Issue Details")
                        : followUpStatus === "COMPLETED"
                          ? t("overdue.settlementNotesLabel", "Settlement Notes / Payment Description")
                          : t("overdue.notesLabel", "Follow-up Notes")}
                    </label>
                    {fieldErrors.notes && (
                      <p className="text-xs font-semibold text-red-600 mb-1.5">{fieldErrors.notes}</p>
                    )}
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        if (fieldErrors.notes) {
                          setFieldErrors((prev) => ({ ...prev, notes: undefined }));
                        }
                      }}
                      placeholder={
                        followUpStatus === "DISPUTE"
                          ? t("overdue.disputeNotesPlaceholder", "Write dispute details, differences, or disputed documents...")
                          : followUpStatus === "COMPLETED"
                            ? t("overdue.settlementNotesPlaceholder", "Write settlement notes, payment reference number, etc...")
                            : t("overdue.notesPlaceholder", "Write summary of communication with customer, commitments, etc...")
                      }
                      className={`w-full rounded-xl border bg-slate-50/50 p-3 text-xs font-medium text-slate-800 outline-none transition focus:bg-white focus:ring-2 ${
                        fieldErrors.notes
                          ? "border-red-500 focus:border-red-600 focus:ring-red-100"
                          : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
                      }`}
                    />
                  </div>

                  {/* Evidence Attachment (mandatory for Completed, available for all) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-800">
                        {followUpStatus === "COMPLETED"
                          ? t("overdue.proofOfPaymentLabel", "Proof of Payment / Settlement (Required)")
                          : followUpStatus === "DISPUTE"
                            ? t("overdue.disputeDocLabel", "Dispute Document Attachment")
                            : t("overdue.evidenceLabel", "Evidence Attachment (Chat Screenshot / Photo / Document)")}
                      </label>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {t("overdue.maxFileSizeBadge", "Maximum 5MB")}
                      </span>
                    </div>
                    {fieldErrors.evidenceFile && (
                      <p className="text-xs font-semibold text-red-600 mb-1.5">{fieldErrors.evidenceFile}</p>
                    )}
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
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
                      >
                        <Upload className="size-3.5 text-slate-500" />
                        <span>{evidenceFile ? t("overdue.changeEvidenceFile", "Change Evidence File") : t("overdue.selectEvidenceFile", "Select Evidence File")}</span>
                      </label>
                      {evidenceFile && (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-700 font-medium">
                          <Paperclip className="size-3.5 shrink-0" />
                          <span className="truncate max-w-[280px]">
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

                  {/* Action Buttons: Cancel and Confirm Follow-up */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => router.push("/overdue-alert")}
                      disabled={submitting}
                      className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      {t("common.cancel", "Cancel")}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || userRole === "MANAGEMENT"}
                      className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      {userRole === "MANAGEMENT" ? (
                        <span>{t("overdue.staffOnlySubmitBtn", "Staff Only Can Submit Log")}</span>
                      ) : submitting ? (
                        <>
                          <RefreshCw className="size-4 animate-spin" />
                          <span>{t("overdue.savingProgress", "Saving Progress...")}</span>
                        </>
                      ) : (
                        <>
                          <Check className="size-4" />
                          <span>{t("overdue.confirmFollowUp", "Confirm Follow-up")}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* Activity & Follow-up History Section moved below the form */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 font-heading">
                    {t("overdue.historyTitle", "Activity & Follow-up History")}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                  {assignmentHistory.length} {t("overdue.records", "Records")}
                </span>
              </div>

              {assignmentHistory.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <History className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-slate-600">{t("overdue.noHistoryYet", "No follow-up history yet")}</p>
                  <p className="text-[11px] mt-0.5">{t("overdue.historyEmptyDesc", "Notes submitted via the form above will be saved and displayed here.")}</p>
                </div>
              ) : (
                <div className="relative ml-2 space-y-4 border-l-2 border-slate-200 pl-4 py-2">
                  {assignmentHistory.map((record) => {
                    const isAssignmentEvent = record.follow_up_status === "ASSIGNED";
                    const statusLabel = followUpStatusLabel(record.follow_up_status, t);
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
                                <p className="text-xs font-bold text-slate-900">{t("overdue.collectionPicAssignment", "Collection PIC Assignment")}</p>
                                <p className="mt-0.5 text-xs text-slate-700">
                                  {t("overdue.assignedTo", "Assigned to:")} <strong className="text-blue-900 font-bold">{staffDisplayName}</strong>{" "}
                                  <span className="text-[11px] text-slate-500 font-mono">({record.assigned_to})</span>
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {t("overdue.assignedBy", "Assigned by:")} <strong className="text-slate-800 font-semibold">{assignerDisplayName}</strong>
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
                              {!isAssignmentEvent && statusLabel && (
                              <span
                                className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${followUpStatusBadge(
                                  record.follow_up_status
                                )}`}
                              >
                                {statusLabel}
                              </span>
                              )}
                              {record.follow_up_action && (
                                <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
                                  {t("overdue.viaChannel", "Via")} {followUpActionLabel(record.follow_up_action, t)}
                                </span>
                              )}
                              {hasPayment && (
                                <span className="inline-flex rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                  {t("overdue.paidBadge", "Paid:")} {formatRupiah(record.payment_amount!)}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="shrink-0 text-[11px] text-slate-400">
                            {new Date(record.assigned_at).toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {record.promise_date && (
                          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                            <Calendar className="size-3.5" />
                            <span>{t("overdue.promiseToPayLabel", "Promise to Pay:")} {formatDate(record.promise_date, language)}</span>
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
                            <span>{t("overdue.viewAttachment", "View Attachment")}</span>
                            <ExternalLink className="size-3 opacity-60" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
