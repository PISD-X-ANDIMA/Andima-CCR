"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, Eye, FileText, MoreVertical, X } from "lucide-react";
import Pagination from "@/components/Pagination";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";
import type { DocumentPreview, RecentDocument } from "@/lib/salesOverviewDocuments";
import { FriendlyErrorCard } from "@/components/UploadForm/uploadform";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function documentType(value: RecentDocument["document_type"], t: (key: string, fallback?: string) => string) {
  return value === "COMPANY_SALES_REPORT" ? t("upload.salesLabel", "Sales Report") : t("upload.outstandingShort", "Outstanding");
}

function statusLabel(value: RecentDocument["validation_status"], t: (key: string, fallback?: string) => string) {
  return value === "validated"
    ? t("upload.statusValidated", "Validated")
    : value === "rejected"
      ? t("upload.statusRejected", "Rejected")
      : value === "processing"
        ? t("upload.statusProcessing", "Processing")
        : t("upload.statusUploaded", "Uploaded");
}

function formatDocumentStagingKey(key: string, isId: boolean): string {
  const mapEn: Record<string, string> = {
    row_number: "Row",
    period_month: "Period",
    customer_name: "Customer",
    customer_code: "Customer Code",
    revenue: "Revenue",
    trucking_cost: "Sub Total",
    handling_cost: "VAT",
    storage_cost: "PPH 23",
    other_operational_cost: "Others DIP IATA",
    sub_total: "Sub Total",
    vat: "VAT",
    pph_23: "PPH 23",
    others: "Others",
    dip_iata: "DIP IATA",
    others_dip_cost: "Others DIP IATA",
    total_cost: "Total Cost",
    job_number: "Job Number",
    mawb: "MAWB",
    invoice_number: "Invoice",
    outstanding_amount: "Amount (IDR)",
    due_date: "Due Date",
    create_date: "Created Date",
  };
  const mapId: Record<string, string> = {
    row_number: "Baris",
    period_month: "Periode",
    customer_name: "Nama Pelanggan",
    customer_code: "Kode Pelanggan",
    revenue: "Pendapatan",
    trucking_cost: "Sub Total",
    handling_cost: "VAT",
    storage_cost: "PPH 23",
    other_operational_cost: "Others DIP IATA",
    sub_total: "Sub Total",
    vat: "VAT",
    pph_23: "PPH 23",
    others: "Others",
    dip_iata: "DIP IATA",
    others_dip_cost: "Others DIP IATA",
    total_cost: "Total Biaya",
    job_number: "Nomor Job",
    mawb: "MAWB",
    invoice_number: "Nomor Faktur",
    outstanding_amount: "Nominal (IDR)",
    due_date: "Jatuh Tempo",
    create_date: "Tanggal Dibuat",
  };
  const map = isId ? mapId : mapEn;
  return map[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecentDocumentsPanel({
  documents,
  loading,
  error,
  onPreview,
  onOpenOriginal,
  onRejectedDownload,
}: {
  documents: RecentDocument[];
  loading: boolean;
  error: string | null;
  onPreview: (id: string) => void;
  onOpenOriginal: (id: string) => void;
  onRejectedDownload: (message: string) => void;
}) {
  const { language, t } = useLanguage();
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }), [language]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(language === "id" ? "id-ID" : "en-US"), [language]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm" aria-label="Recent documents">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-heading">{t("salesOverview.recentDocuments", "Recent Documents")}</h2>
          <p className="text-xs text-slate-500">{t("salesOverview.fiveLatest", "Five latest uploaded files.")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/uploaded-documents" className="text-xs font-semibold text-blue-700 hover:underline">
            {t("salesOverview.viewAll", "View all")}
          </Link>
          <FileText className="size-5 text-blue-600" />
        </div>
      </div>
      {error ? (
        <p className="px-5 py-8 text-sm text-red-700">{error}</p>
      ) : loading ? (
        <div className="overflow-x-auto p-4" aria-label="Loading documents" aria-busy="true">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-3 animate-pulse">
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-48 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-100" />
                </div>
                <div className="h-4 w-20 rounded bg-slate-200" />
                <div className="h-4 w-28 rounded bg-slate-100" />
                <div className="h-5 w-20 rounded-full bg-slate-200" />
                <div className="h-4 w-12 rounded bg-slate-100" />
                <div className="size-8 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : documents.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">{t("upload.noDocumentsYet", "No documents uploaded yet.")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 font-semibold">
              <tr>
                <th className="px-5 py-3">{t("upload.colFile", "File")}</th>
                <th className="px-5 py-3">{t("upload.colType", "Type")}</th>
                <th className="px-5 py-3">{t("upload.colUploadDate", "Upload Date")}</th>
                <th className="px-5 py-3">{t("common.status", "Status")}</th>
                <th className="px-5 py-3">{t("upload.colRows", "Rows")}</th>
                <th className="px-5 py-3 text-right">{t("common.action", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((document) => (
                <tr key={document.id} className="text-slate-700">
                  <td className="max-w-[16rem] px-5 py-3">
                    <span className="block truncate font-semibold text-slate-900" title={document.file_name}>
                      {document.file_name}
                    </span>
                    <span className="text-[11px] text-slate-400">{numberFormatter.format(document.file_size_bytes)} bytes</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs">{documentType(document.document_type, t)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">{dateFormatter.format(new Date(document.uploaded_at))}</td>
                  <td className="whitespace-nowrap px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        document.validation_status === "validated"
                          ? "bg-teal-50 text-teal-700"
                          : document.validation_status === "rejected"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {statusLabel(document.validation_status, t)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs">
                    {document.valid_row_count}/{document.row_count}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <DocumentActionMenu
                      document={document}
                      onPreview={onPreview}
                      onOpenOriginal={onOpenOriginal}
                      onRejectedDownload={onRejectedDownload}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DocumentActionMenu({
  document: row,
  onPreview,
  onOpenOriginal,
  onRejectedDownload,
}: {
  document: RecentDocument;
  onPreview: (id: string) => void;
  onOpenOriginal: (id: string) => void;
  onRejectedDownload: (message: string) => void;
}) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Action ${row.file_name}`}
        aria-expanded={open}
        className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-xl">
          <button
            type="button"
            onClick={() => {
              onPreview(row.id);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Eye className="size-3.5" />
            {t("upload.viewPreview", "View Preview")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (row.validation_status === "rejected") {
                const baseMsg = language === "id" ? "File asli tidak tersedia karena dokumen ditolak." : t("salesOverview.originalFileRejected", "Original file is not available because the document was rejected.");
                onRejectedDownload(`${baseMsg}${row.error_summary ? ` ${row.error_summary}` : ""}`);
              } else {
                onOpenOriginal(row.id);
              }
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="size-3.5" />
            {t("upload.openOriginalFile", "Open Original File")}
          </button>
        </div>
      )}
    </div>
  );
}

export function DocumentPreviewModal({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const { language, t } = useLanguage();
  const isId = language === "id";
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }), [language]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(language === "id" ? "id-ID" : "en-US"), [language]);

  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowPage, setRowPage] = useState(1);
  const [errorPage, setErrorPage] = useState(1);
  const rowPageSize = 25;
  const errorPageSize = 25;
  const rowTotalPages = Math.max(1, Math.ceil((preview?.rows.length ?? 0) / rowPageSize));
  const errorTotalPages = Math.max(1, Math.ceil((preview?.errors.length ?? 0) / errorPageSize));
  const pageRows = preview?.rows.slice((rowPage - 1) * rowPageSize, rowPage * rowPageSize) ?? [];
  const pageErrors = preview?.errors.slice((errorPage - 1) * errorPageSize, errorPage * errorPageSize) ?? [];

  useEffect(() => {
    setRowPage(1);
    setErrorPage(1);
    setPreview(null);
    setError(null);
  }, [documentId]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/v1/documents/${documentId}/preview`, { cache: "no-store" })
      .then(async (response) => {
        const body = await readJsonResponse<{ data?: DocumentPreview; error?: { message?: string } }>(response);
        if (!response.ok) throw new Error(responseMessage(body, "Failed to load preview."));
        if (!body) throw new Error("Preview did not return data.");
        if (active) setPreview(body.data ?? null);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Failed to load preview.");
      });
    return () => {
      active = false;
    };
  }, [documentId]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Document Preview">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-900 font-heading">{preview?.document.file_name ?? t("upload.documentPreview", "Document Preview")}</h2>
            {preview && (
              <p className="text-xs text-slate-500">
                {documentType(preview.document.document_type, t)} · {statusLabel(preview.document.validation_status, t)}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 cursor-pointer">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">
          {error ? (
            <p className="py-10 text-center text-sm text-red-700">{error}</p>
          ) : !preview ? (
            <div className="space-y-3 py-10" aria-label="Loading preview">
              <div className="mx-auto h-5 w-48 animate-pulse rounded bg-slate-200" />
              <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-5">
              {preview.document.validation_status === "rejected" && (
                <div className="space-y-3">
                  <FriendlyErrorCard
                    issues={preview.errors.map((e) => ({
                      code: e.error_code,
                      message: e.error_message,
                      field: e.field_name,
                      row: e.row_number ?? undefined,
                      rawValue: e.raw_value ?? undefined,
                    }))}
                    documentType={preview.document.document_type}
                  />
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                    <p className="font-semibold">{t("upload.uploadFailedTitle", "Document upload failed")}</p>
                    <p className="mt-1">
                      {t("upload.uploadFailedDetail", "The original file was not saved. Review the validation details below.")}
                    </p>
                    {preview.document.error_summary && <p className="mt-2 text-xs">{preview.document.error_summary}</p>}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>{dateFormatter.format(new Date(preview.document.uploaded_at))}</span>
                <span>
                  {numberFormatter.format(preview.document.valid_row_count)} {t("upload.validRowsCount", "valid rows")}
                </span>
                <span>
                  {numberFormatter.format(preview.errors.length)} {t("upload.warningsErrorsCount", "warnings/errors")}
                </span>
                {preview.signedUrl && (
                  <a href={preview.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline">
                    <Download className="size-3.5" />
                    {t("upload.openOriginalFile", "Open Original File")}
                  </a>
                )}
              </div>
              {preview.document.mime_type === "application/pdf" && preview.signedUrl && (
                <iframe title={`Preview ${preview.document.file_name}`} src={preview.signedUrl} className="h-[32rem] w-full rounded-lg border border-slate-200" />
              )}
              <section aria-label="Extracted document data">
                <h3 className="mb-2 text-sm font-bold text-slate-900 font-heading">{t("upload.extractedData", "Extracted Data")}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold">
                      <tr>
                        {Object.keys(preview.rows[0] ?? {})
                          .filter((key) => key !== "id" && key !== "document_id" && key !== "c1_customer_id" && key !== "customer_id" && key !== "created_at")
                          .map((key) => (
                            <th key={key} className="whitespace-nowrap px-3 py-2">
                              {formatDocumentStagingKey(key, isId)}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.length ? (
                        pageRows.map((row, index) => (
                          <tr key={`${String(row.row_number ?? index)}-${index}`}>
                            {Object.entries(row)
                              .filter(([key]) => key !== "id" && key !== "document_id" && key !== "c1_customer_id" && key !== "customer_id" && key !== "created_at")
                              .map(([key, value]) => {
                                const isMoney = typeof value === "number" && (
                                  key.includes("cost") || key.includes("revenue") || key.includes("amount") ||
                                  key === "sub_total" || key === "vat" || key === "pph_23" || key === "others" || key === "dip_iata"
                                );
                                return (
                                  <td key={key} className="max-w-64 whitespace-nowrap px-3 py-2 text-slate-700">
                                    {isMoney ? numberFormatter.format(value as number) : String(value ?? "-")}
                                  </td>
                                );
                              })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-8 text-center text-slate-500" colSpan={Math.max(1, Object.keys(preview.rows[0] ?? {}).filter((k) => k !== "id" && k !== "document_id" && k !== "c1_customer_id" && k !== "customer_id" && k !== "created_at").length)}>
                            {t("upload.noStagingData", "No staging data available.")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {preview.rows.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {preview.rows.length} {t("common.rows", "rows")} · {t("common.page", "Page")} {rowPage} {t("common.of", "of")} {rowTotalPages} · 25 {t("common.perPage", "per page")}
                    </span>
                    {rowTotalPages > 1 && <Pagination currentPage={rowPage} totalPages={rowTotalPages} onPageChange={setRowPage} />}
                  </div>
                )}
              </section>
              {preview.customers.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-bold text-slate-900 font-heading">{t("upload.associatedCustomers", "Associated C1 Customers")}</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {preview.customers.map((customer) => (
                      <div key={customer.customer_id} className="rounded-lg bg-slate-50 p-3 text-xs">
                        <p className="font-semibold text-slate-900">{customer.customer_name}</p>
                        <p className="text-slate-500">
                          {customer.customer_code} · {customer.source_type} · ID {customer.customer_id}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {preview.errors.length > 0 && (
                <section aria-label="Validation warnings and errors">
                  <h3 className="mb-2 text-sm font-bold text-slate-900 font-heading">{language === "id" ? t("upload.validationWarningsErrors", "Peringatan & Galat Validasi") : <>Validation Warnings &amp; Errors</>}</h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 font-semibold text-slate-600">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2">{t("upload.severity", "Severity")}</th>
                          <th className="whitespace-nowrap px-3 py-2">{t("upload.row", "Row")}</th>
                          <th className="whitespace-nowrap px-3 py-2">{t("upload.field", "Field")}</th>
                          <th className="px-3 py-2">{t("upload.message", "Message")}</th>
                          <th className="px-3 py-2">{t("upload.sourceValue", "Source value")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pageErrors.map((item, index) => (
                          <tr key={`${item.error_code}-${item.row_number}-${index}`}>
                            <td className="whitespace-nowrap px-3 py-2">
                              <span className={`rounded px-2 py-1 text-[10px] font-bold ${item.severity === "WARNING" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"}`}>
                                {item.severity ?? "ERROR"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-600">{item.row_number ?? "-"}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-700">{item.field_name}</td>
                            <td className="min-w-64 px-3 py-2 text-slate-700">{item.error_message}</td>
                            <td className="max-w-64 break-words px-3 py-2 text-slate-500">{item.raw_value ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {numberFormatter.format(preview.errors.length)} {t("upload.findings", "findings")} · {t("common.page", "Page")} {errorPage} {t("common.of", "of")} {errorTotalPages} · 25 {t("common.perPage", "per page")}
                    </span>
                    {errorTotalPages > 1 && <Pagination currentPage={errorPage} totalPages={errorTotalPages} onPageChange={setErrorPage} />}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
