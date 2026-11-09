"use client";

import React from "react";
import {
  Calendar,
  ExternalLink,
  History,
  MessageSquare,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  UserCheck,
  X,
} from "lucide-react";
import type { AssignmentRecord, OverdueInvoiceItem, StaffOption } from "@/types/overdue";

interface OverdueInvoicePreviewModalProps {
  open: boolean;
  onClose: () => void;
  invoice: OverdueInvoiceItem | null;
  assignmentHistory: AssignmentRecord[];
  staffOptions?: StaffOption[];
  canAssign?: boolean;
  onEdit: (invoice: OverdueInvoiceItem) => void;
  onCreate?: (invoice: OverdueInvoiceItem) => void;
  onAssign?: (invoice: OverdueInvoiceItem) => void;
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

export default function OverdueInvoicePreviewModal({
  open,
  onClose,
  invoice,
  assignmentHistory,
  staffOptions = [],
  canAssign = false,
  onEdit,
  onCreate,
  onAssign,
}: OverdueInvoicePreviewModalProps) {
  if (!open || !invoice) return null;

  const assignedStaff = invoice.pic_assigned
    ? staffOptions.find((staff) => staff.employee_id === invoice.pic_assigned)
    : undefined;
  const picName = assignedStaff?.full_name || invoice.pic_assigned || "-";
  const picInitials = invoice.pic_initials || (picName === "-" ? "-" : initials(picName));

  const rawPhone = invoice.contact_person?.phone && invoice.contact_person.phone !== "-" ? invoice.contact_person.phone : "";
  const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
  const waPhone = cleanPhone.startsWith("0") ? `62${cleanPhone.slice(1)}` : cleanPhone;
  const contactName =
    invoice.contact_person?.name &&
    invoice.contact_person.name !== "-" &&
    invoice.contact_person.name !== "Kontak tidak tersedia" &&
    invoice.contact_person.name !== "Contact not available"
      ? invoice.contact_person.name
      : null;
  const contactPhone = rawPhone || null;
  const hasContact = Boolean(contactName || contactPhone);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="preview-modal-title" className="text-base font-bold text-slate-900 font-heading">
                Preview Invoice {invoice.invoice_number}
              </h2>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${riskClasses(invoice.risk_status)}`}>
                {invoice.risk_status}
              </span>
            </div>
            <p className="text-xs text-slate-500">{invoice.customer_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading">
                Total Outstanding
              </span>
              <p className="mt-1 text-lg font-extrabold text-red-600 font-heading">
                {formatRupiah(invoice.amount_overdue)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{invoice.payment_note || "No payments yet"}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading">
                Due Date &amp; Aging Status
              </span>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {formatDate(invoice.due_date)}
              </p>
              <div className="mt-1">
                <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold ${agingClasses(invoice.days_overdue)}`}>
                  Overdue {invoice.days_overdue} Days
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-heading">
                Customer &amp; Branch
              </span>
              <p className="mt-1 text-xs font-bold text-slate-900 truncate">
                {invoice.customer_name}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {invoice.branch && invoice.branch !== "Tidak tersedia" ? invoice.branch : "Head Office"} {invoice.branch_code ? `(${invoice.branch_code})` : ""}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">NPWP: {invoice.npwp || "-"}</p>
            </div>
          </div>

          {/* PIC and Quick Contact Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PIC Information */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-800 font-heading flex items-center gap-1.5">
                  <UserCheck className="size-4 text-blue-600" /> PIC
                </span>
                {canAssign && onAssign && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onAssign(invoice);
                    }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                  >
                    {picName === "-" ? "Assign PIC" : "Change PIC"}
                  </button>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    picName === "-" ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {picInitials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{picName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {picName === "-" ? "No PIC assigned yet" : "Registered Collection Officer"}
                    {assignedStaff ? ` · ID: ${assignedStaff.employee_id}` : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Person & Quick Links */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-800 font-heading">
                  Customer Contact Person
                </span>
              </div>
              <div className="mt-2.5 space-y-1">
                {hasContact ? (
                  <>
                    <p className="text-xs font-bold text-slate-900">
                      {contactName || "Customer Contact"}
                    </p>
                    <p className="text-xs text-slate-600 font-mono">
                      {contactPhone || "Phone number not available"}
                    </p>
                  </>
                ) : (
                  <p className="text-xs italic text-slate-500">
                    Contact not available
                  </p>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {waPhone && hasContact ? (
                  <a
                    href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                      `Halo, konfirmasi tagihan ${invoice.invoice_number} sebesar ${formatRupiah(
                        invoice.amount_overdue
                      )} PT Andima Transportindo.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={!contactPhone}
                  onClick={() => {
                    if (contactPhone) {
                      window.location.href = `tel:${contactPhone}`;
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-slate-600" />
                  <span>Call</span>
                </button>
              </div>
            </div>
          </div>

          {/* Activity & Follow-up History */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 font-heading">
                  Activity &amp; Follow-up History ({assignmentHistory.length})
                </h3>
              </div>
            </div>

            <div className="mt-3">
              {assignmentHistory.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <p className="text-xs">No follow-up activity recorded for this invoice yet.</p>
                </div>
              ) : (
                <div className="relative ml-2 space-y-4 border-l-2 border-slate-200 pl-4 py-1">
                  {assignmentHistory.map((assignment) => {
                    const isAssignmentEvent = assignment.follow_up_status === "ASSIGNED";
                    const staffDisplayName = assignment.assigned_to_name || assignment.assigned_to;
                    const assignerDisplayName = assignment.assigned_by_name || "Stevanus Imanuel";
                    const hasPayment = Boolean(assignment.payment_amount && assignment.payment_amount > 0);

                    return (
                      <div key={assignment.assignment_id} className="relative">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            {isAssignmentEvent ? (
                              <div>
                                <p className="text-xs font-bold text-slate-900">
                                  Collection PIC Assignment
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
                                  <span>Assigned to:</span>
                                  <strong className="text-blue-900 font-bold">{staffDisplayName}</strong>
                                  <span className="text-[11px] text-slate-500 font-mono">({assignment.assigned_to})</span>
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                  <span>Assigned by: </span>
                                  <strong className="text-slate-800 font-semibold">{assignerDisplayName}</strong>
                                  {assignment.assigned_by_role && (
                                    <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 uppercase">
                                      {assignment.assigned_by_role}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-slate-900">{staffDisplayName}</p>
                                  <span className="text-[10px] text-slate-500 font-mono">({assignment.assigned_to})</span>
                                </div>
                              </div>
                            )}

                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${followUpStatusBadge(
                                  assignment.follow_up_status
                                )}`}
                              >
                                {assignment.follow_up_status}
                              </span>
                              {assignment.follow_up_action && (
                                <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
                                  Via {assignment.follow_up_action}
                                </span>
                              )}
                              {hasPayment && (
                                <span className="inline-flex rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                  Paid: {formatRupiah(assignment.payment_amount!)}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="shrink-0 text-[11px] text-slate-400">
                            {new Date(assignment.assigned_at).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {assignment.promise_date && (
                          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Promise to Pay: {formatDate(assignment.promise_date)}</span>
                          </p>
                        )}

                        {assignment.notes && (
                          <p className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs italic text-slate-700 leading-relaxed">
                            &quot;{assignment.notes}&quot;
                          </p>
                        )}

                        {assignment.attachment_url && (
                          <a
                            href={assignment.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                          >
                            <Paperclip className="h-3 w-3" />
                            <span>View Attachment</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {canAssign && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(invoice);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <Pencil className="size-3.5 text-slate-500" />
                <span>Edit PIC</span>
              </button>
            )}
            {!canAssign && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onCreate) {
                    onCreate(invoice);
                  } else {
                    onEdit(invoice);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Add Progress</span>
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

