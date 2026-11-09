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
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import HeaderAccount from "@/components/headeraccount";
import type { AssignmentRecord, OverdueInvoiceItem, StaffOption } from "@/types/overdue";
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
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentRecord[]>([]);
  const [canAssign, setCanAssign] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [searchStaff, setSearchStaff] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingPic, setSubmittingPic] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Follow-up edit modal state
  const [editingRecord, setEditingRecord] = useState<AssignmentRecord | null>(null);
  const [editStatus, setEditStatus] = useState("IN_PROGRESS");
  const [editAction, setEditAction] = useState("Chat (WhatsApp / Others)");
  const [editPromiseDate, setEditPromiseDate] = useState("");
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // Follow-up delete modal state
  const [deletingRecord, setDeletingRecord] = useState<AssignmentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 4000);
  }, []);

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
      fetch(`/api/v1/overdue/staff?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }).then(async (res) => ({
        ok: res.ok,
        body: await readJsonResponse<{ data?: StaffOption[]; canAssign?: boolean; error?: { message?: string } }>(res),
      })),
      fetch(`/api/v1/overdue/${encodeURIComponent(cleanInvoiceId)}/assign?refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }).then(async (res) => ({
        ok: res.ok,
        body: await readJsonResponse<{ data?: AssignmentRecord[]; error?: { message?: string } }>(res),
      })),
    ])
      .then(([invoiceRes, staffRes, historyRes]) => {
        if (!invoiceRes.ok) {
          throw new Error(responseMessage(invoiceRes.body, "Failed to load overdue invoice data."));
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
        const options = staffRes.body?.data ?? [];
        setStaffOptions(options);
        setCanAssign(staffRes.body?.canAssign ?? true);
        setAssignmentHistory(historyRes.body?.data ?? []);

        // Pre-select current assigned staff if available
        if (found.pic_assigned) {
          setSelectedStaffId(found.pic_assigned);
        }
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

  const handlePicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !selectedStaffId || !canAssign || submittingPic) {
      if (!selectedStaffId) showToast("Please select a PIC staff member.");
      return;
    }

    setSubmittingPic(true);
    try {
      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(invoice.id || cleanInvoiceId)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: selectedStaffId }),
      });

      const body = await readJsonResponse<{ error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Failed to assign PIC."));

      const staff = staffOptions.find((item) => item.employee_id === selectedStaffId);
      showToast(`PIC ${staff?.full_name ?? selectedStaffId} updated successfully.`);
      refreshHistory();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to update PIC.");
    } finally {
      setSubmittingPic(false);
    }
  };

  const openEditModal = (record: AssignmentRecord) => {
    setEditingRecord(record);
    setEditStatus(record.follow_up_status || "IN_PROGRESS");
    setEditAction(record.follow_up_action || "Chat (WhatsApp / Others)");
    setEditPromiseDate(record.promise_date ? record.promise_date.slice(0, 10) : "");
    setEditPaymentAmount(record.payment_amount ? String(record.payment_amount) : "");
    setEditNotes(record.notes || "");
    setEditFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  const handleEditProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !invoice) return;

    if (editStatus === "PROMISE_TO_PAY" && !editPromiseDate) {
      showToast("Promise to pay date is required.");
      return;
    }

    if (editStatus === "COMPLETED" && (!editPaymentAmount || Number(editPaymentAmount) <= 0)) {
      showToast("Payment amount is required for Completed status.");
      return;
    }

    if (!editNotes.trim()) {
      showToast("Follow-up notes are required.");
      return;
    }

    setSavingEdit(true);
    try {
      const formData = new FormData();
      formData.append("assignmentId", editingRecord.assignment_id);
      formData.append("followUpStatus", editStatus);
      if (editStatus !== "COMPLETED") {
        formData.append("followUpAction", editAction);
      }
      if (editPromiseDate && editStatus === "PROMISE_TO_PAY") {
        formData.append("promiseDate", editPromiseDate);
      }
      if (editNotes.trim()) {
        formData.append("notes", editNotes.trim());
      }
      if (editPaymentAmount.trim() && editStatus === "COMPLETED") {
        formData.append("paymentAmount", editPaymentAmount.trim());
      }
      if (editFile) {
        formData.append("file", editFile);
      }

      const response = await fetch(`/api/v1/overdue/${encodeURIComponent(invoice.id || cleanInvoiceId)}/progress`, {
        method: "PATCH",
        body: formData,
      });

      const body = await readJsonResponse<{ success?: boolean; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Failed to update follow-up progress."));

      showToast("Follow-up progress updated successfully!");
      setEditingRecord(null);
      refreshHistory();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to update progress.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!deletingRecord || !invoice || isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/v1/overdue/${encodeURIComponent(invoice.id || cleanInvoiceId)}/progress?assignmentId=${encodeURIComponent(
          deletingRecord.assignment_id
        )}`,
        {
          method: "DELETE",
        }
      );
      const body = await readJsonResponse<{ success?: boolean; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, "Failed to delete follow-up log."));

      showToast("Follow-up log deleted successfully.");
      setDeletingRecord(null);
      refreshHistory();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to delete log.");
    } finally {
      setIsDeleting(false);
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

      {/* Header bar matching Customer Analytics Detail style */}
      <header className="border-b border-slate-200 bg-white">
        <div className="flex w-full items-center justify-between px-6 py-4 md:px-8">
          <Link
            href="/overdue-alert"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-700 transition group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Overdue Alerts</span>
          </Link>
          <HeaderAccount />
        </div>
      </header>

      {/* Wide Container stretched close to sidebar */}
      <main className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-28 rounded-2xl border border-slate-200 bg-white p-6 animate-pulse" />
            <div className="h-96 rounded-2xl border border-slate-200 bg-white p-6 animate-pulse" />
          </div>
        ) : errorMessage || !invoice ? (
          <div className="rounded-2xl border border-red-200 bg-white p-12 text-center shadow-sm">
            <AlertCircle className="mx-auto size-8 text-red-500 mb-3" />
            <h2 className="text-base font-bold text-slate-900 font-heading">Failed to Load Invoice</h2>
            <p className="mt-1 text-xs text-red-600">{errorMessage || "Invoice not found."}</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link
                href="/overdue-alert"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back to Overdue List
              </Link>
              <button
                type="button"
                onClick={loadData}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Invoice Overview Strip */}
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
                      Aging: {invoice.days_overdue} Days
                    </span>
                  </div>

                  <h1 className="mt-2 text-xl font-bold text-slate-950 font-heading sm:text-2xl">
                    {invoice.customer_name}
                  </h1>
                  <p className="mt-1 text-xs font-mono text-slate-500">
                    Invoice No.: <strong className="text-slate-800">{invoice.invoice_number}</strong> · Due Date:{" "}
                    <strong className="text-slate-800">{formatDate(invoice.due_date)}</strong>
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end gap-1.5 rounded-xl border border-red-100 bg-red-50/60 p-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-heading">
                    Total Outstanding
                  </span>
                  <span className="text-2xl font-extrabold text-red-600 font-heading">
                    {formatRupiah(invoice.amount_overdue)}
                  </span>
                  <span className="text-[10px] text-slate-500">{invoice.payment_note || "No payments yet"}</span>
                </div>
              </div>
            </section>

            {/* Section 1: Ubah PIC Card (for Management) */}
            <form
              onSubmit={(e) => void handlePicSubmit(e)}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-xs">
                    <UserCheck className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 font-heading">
                      Edit Collection PIC
                    </h2>
                    <p className="text-xs text-slate-500">
                      Update the CCR staff assigned to collect this invoice
                    </p>
                  </div>
                </div>
              </div>

              {/* Current PIC banner */}
              <div className="border-b border-slate-100 bg-blue-50/40 px-6 py-3 text-xs text-slate-700 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Current PIC:</span>
                <span className="font-bold text-slate-900">
                  {currentAssignedStaff?.full_name || invoice.pic_assigned || "No PIC assigned"}
                  {currentAssignedStaff && (
                    <span className="ml-1 text-[11px] font-normal font-mono text-slate-500">
                      ({currentAssignedStaff.employee_id})
                    </span>
                  )}
                </span>
              </div>

              {/* Staff Search Input */}
              <div className="px-6 pt-4 pb-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchStaff}
                    onChange={(e) => setSearchStaff(e.target.value)}
                    placeholder="Search staff name or employee ID..."
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
              <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2 max-h-[280px]">
                {!canAssign ? (
                  <div className="py-6 text-center text-xs text-amber-700">
                    <p className="font-semibold">Restricted Access</p>
                    <p className="text-[11px] mt-1 text-slate-500">
                      Only Management role is authorized to assign or change PIC.
                    </p>
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <UserRound className="size-7 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-600">No matching staff found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try a different search keyword.</p>
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
                            <p className={`truncate text-xs font-bold ${isSelected ? "text-blue-950" : "text-slate-900"}`}>
                              {staff.full_name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] text-slate-500 font-semibold">
                                {staff.employee_id}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 uppercase">
                                CCR Staff
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="ml-3 shrink-0">
                          <span
                            className={`flex size-5 items-center justify-center rounded-full border transition ${
                              isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
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

              {/* Selected Staff Summary & Save */}
              {canAssign && (
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                  <div className="text-xs">
                    {selectedStaffObj ? (
                      <span className="text-slate-600">
                        Selected: <strong className="text-blue-700 font-bold">{selectedStaffObj.full_name}</strong>
                      </span>
                    ) : (
                      <span className="text-slate-400">No staff selected</span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!selectedStaffId || submittingPic}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {submittingPic ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-4" />
                        <span>Save PIC Changes</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>

            {/* Section 2: Riwayat & Edit Follow-up */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <History className="size-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 font-heading">
                      Activity History &amp; Follow-up Log
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Click the edit button on any log to correct mistake status or follow-up notes
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                  {assignmentHistory.length} Records
                </span>
              </div>

              {assignmentHistory.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <History className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold text-slate-600">No follow-up history yet</p>
                  <p className="text-[11px] mt-0.5">Add progress via the Create action in the Overdue Alert table.</p>
                </div>
              ) : (
                <div className="relative ml-2 space-y-4 border-l-2 border-slate-200 pl-4 py-2">
                  {assignmentHistory.map((record) => {
                    const isAssignmentEvent = record.follow_up_status === "ASSIGNED";
                    const staffDisplayName = record.assigned_to_name || record.assigned_to;
                    const assignerDisplayName = record.assigned_by_name || "Stevanus Imanuel";
                    const hasPayment = Boolean(record.payment_amount && record.payment_amount > 0);

                    return (
                      <div key={record.assignment_id} className="relative rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-slate-50">
                        <span className="absolute -left-[25px] top-5 size-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            {isAssignmentEvent ? (
                              <div>
                                <p className="text-xs font-bold text-slate-900">Collection PIC Assignment</p>
                                <p className="mt-0.5 text-xs text-slate-700">
                                  Assigned to: <strong className="text-blue-900 font-bold">{staffDisplayName}</strong>{" "}
                                  <span className="text-[11px] text-slate-500 font-mono">({record.assigned_to})</span>
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Assigned by: <strong className="text-slate-800 font-semibold">{assignerDisplayName}</strong>
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
                                  Paid: {formatRupiah(record.payment_amount!)}
                                </span>
                              )}
                            </div>

                            {record.promise_date && (
                              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                                <Calendar className="size-3.5" />
                                <span>Promise to Pay: {formatDate(record.promise_date)}</span>
                              </p>
                            )}

                            {record.notes && (
                              <p className="mt-1.5 rounded-lg border border-slate-200/60 bg-white p-2.5 text-xs italic text-slate-700 leading-relaxed">
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
                                <span>View Attachment</span>
                                <ExternalLink className="size-3 opacity-60" />
                              </a>
                            )}
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                            <span className="text-[11px] text-slate-400">
                              {new Date(record.assigned_at).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(record)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition cursor-pointer shadow-xs"
                              >
                                <Pencil className="size-3 text-blue-600" />
                                <span>Edit Log</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingRecord(record)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition cursor-pointer shadow-xs"
                              >
                                <Trash2 className="size-3 text-red-600" />
                                <span>Delete Log</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Edit Follow-up Progress Modal */}
      {editingRecord && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <Pencil className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    Edit Follow-up Progress
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Update follow-up history record details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </header>

            <form onSubmit={(e) => void handleEditProgressSubmit(e)} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Status Invoice
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="PROMISE_TO_PAY">Promise to Pay</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DISPUTE">Dispute</option>
                </select>
              </div>

              {editStatus !== "COMPLETED" && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Customer Contact Method
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: "Direct Visit", label: "Direct Visit", icon: Users },
                      { id: "Chat (WhatsApp / Others)", label: "Chat (WhatsApp / Others)", icon: MessageSquare },
                      { id: "Online Meeting", label: "Online Meeting", icon: Video },
                    ].map((item) => {
                      const IconComponent = item.icon;
                      const isSelected = editAction === item.id;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setEditAction(item.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/80 ring-1 ring-blue-600"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <IconComponent className="size-3.5 text-blue-600" />
                          <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {editStatus === "PROMISE_TO_PAY" && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Promise to Pay Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editPromiseDate}
                    onChange={(e) => setEditPromiseDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              )}

              {editStatus === "COMPLETED" && (
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Payment Amount (IDR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={editPaymentAmount}
                      onChange={(e) => setEditPaymentAmount(e.target.value)}
                      placeholder="Enter total payment amount"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  {editPaymentAmount && Number(editPaymentAmount) > 0 && (
                    <p className="mt-1 text-[11px] font-bold text-emerald-700">
                      Recorded amount: {formatRupiah(Number(editPaymentAmount))}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Follow-up Notes
                </label>
                <textarea
                  rows={3}
                  required
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Follow-up notes details..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Update Evidence File (Optional to replace previous file)
                </label>
                <input
                  type="file"
                  ref={editFileInputRef}
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  id="edit-modal-evidence-file"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="edit-modal-evidence-file"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
                  >
                    <Upload className="size-3.5 text-slate-500" />
                    <span>{editFile ? "Replace File" : "Upload New Evidence"}</span>
                  </label>
                  {editFile ? (
                    <span className="text-xs text-blue-700 font-medium truncate max-w-[220px]">
                      {editFile.name}
                    </span>
                  ) : editingRecord.attachment_url ? (
                    <span className="text-xs text-slate-500 italic">
                      Previous attachment exists
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  disabled={savingEdit}
                  className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-60 transition cursor-pointer"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Follow-up Progress Confirmation Modal */}
      {deletingRecord && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-heading">Delete Follow-up Log</h3>
                <p className="text-[11px] text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this follow-up record
              {deletingRecord.follow_up_status ? ` with status "${deletingRecord.follow_up_status}"` : ""}?
              {deletingRecord.follow_up_status === "COMPLETED" && (
                <span className="block mt-2 font-semibold text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  Note: Deleting this Completed record will reverse the recorded settlement payment and return the invoice to overdue status.
                </span>
              )}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingRecord(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteLog}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Record</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
