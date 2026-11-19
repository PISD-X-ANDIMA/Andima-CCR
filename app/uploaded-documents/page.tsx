"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, AlertTriangle, CheckCircle2, Download, Eye, FileText, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import Header from "@/components/Header";
import Pagination from "@/components/Pagination";
import UploadForm from "@/components/UploadForm/uploadform";
import { DocumentPreviewModal } from "@/components/Sales Overview/DocumentsPanel";
import type { RecentDocument } from "@/lib/salesOverviewDocuments";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";
import { useLanguage } from "@/lib/i18n/LanguageContext";

type ManagedResponse = {
  data: RecentDocument[];
  summary: { total: number; validated: number; rejected: number };
  pagination: { page: number; page_size: number; total_items: number; total_pages: number };
  permissions: { can_manage_documents: boolean };
};
type CleanupTask = { audit_id: string; file_name: string; document_type: string; deleted_at: string };
const selectClass = "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700";

function typeLabel(type: RecentDocument["document_type"], t: (key: string, fallback?: string) => string) {
  return type === "COMPANY_SALES_REPORT" ? t("upload.salesShort", "Sales") : t("upload.outstandingShort", "Outstanding");
}
function statusLabel(status: RecentDocument["validation_status"], t: (key: string, fallback?: string) => string) {
  return status === "validated"
    ? t("upload.statusValidated", "Validated")
    : status === "rejected"
      ? t("upload.statusRejected", "Rejected")
      : status === "processing"
        ? t("upload.statusProcessing", "Processing")
        : t("upload.statusUploaded", "Uploaded");
}

export default function UploadedDocumentsPage() {
  const { t, language } = useLanguage();
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", { dateStyle: "medium", timeStyle: "short" }), [language]);
  const integer = useMemo(() => new Intl.NumberFormat(language === "id" ? "id-ID" : "en-US"), [language]);

  const [rows, setRows] = useState<RecentDocument[]>([]);
  const [summary, setSummary] = useState<ManagedResponse["summary"]>({ total: 0, validated: 0, rejected: 0 });
  const [pagination, setPagination] = useState<ManagedResponse["pagination"]>({ page: 1, page_size: 10, total_items: 0, total_pages: 1 });
  const [canManage, setCanManage] = useState(false);
  const [search, setSearch] = useState("");
  const [documentType, setDocumentType] = useState("all");
  const [fileType, setFileType] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecentDocument | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, setPending] = useState<CleanupTask[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ search, document_type: documentType, file_type: fileType, page: String(page), limit: "10" });
    params.set("refresh", Date.now().toString());
    try {
      const response = await fetch(`/api/v1/documents/recent?${params}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const body = await readJsonResponse<ManagedResponse & { error?: { message?: string } }>(response);
      if (!response.ok || !body) throw new Error(responseMessage(body, t("upload.loadError", "Unable to load documents.")));
      setRows(body.data ?? []); setSummary(body.summary); setPagination(body.pagination); setCanManage(body.permissions?.can_manage_documents ?? false);
      setError(null);
      if (body.permissions?.can_manage_documents) {
        const cleanupResponse = await fetch("/api/v1/documents/cleanup-pending", { cache: "no-store" });
        const cleanupBody = await readJsonResponse<{ data?: CleanupTask[] }>(cleanupResponse);
        setPending(cleanupResponse.ok ? cleanupBody?.data ?? [] : []);
      } else setPending([]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("upload.loadError", "Unable to load documents.")); }
    finally { setLoading(false); }
  }, [documentType, fileType, page, search, t]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);

  function openOriginal(row: RecentDocument) {
    if (row.validation_status === "rejected") {
      const reason = row.error_summary ? ` ${row.error_summary}` : "";
      const baseMsg = language === "id"
        ? "File asli tidak tersedia karena dokumen ditolak."
        : t("salesOverview.originalFileRejected", "Original file is not available because the document was rejected.");
      const message = `${baseMsg}${reason}`;
      setDownloadError(message);
      window.setTimeout(() => setDownloadError((current) => current === message ? null : current), 5000);
      return;
    }
    window.open(`/api/v1/documents/${row.id}/download`, "_blank", "noopener,noreferrer");
  }

  async function deleteDocument() {
    if (!deleteTarget) return;
    const row = deleteTarget;
    setDeleting(row.id); setNotice(null); setDeleteError(null);
    try {
      const response = await fetch(`/api/v1/documents/${row.id}`, { method: "DELETE" });
      const body = await readJsonResponse<{ data?: { storageCleanup?: string }; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, t("upload.deleteError", "Unable to delete document.")));
      setDeleteTarget(null);
      setNotice(body?.data?.storageCleanup === "pending"
        ? t("upload.documentDeletedPending", "Document data deleted. Storage cleanup is pending and available for retry.")
        : t("upload.documentDeleted", "Document deleted."));
      await load();
    } catch (reason) { setDeleteError(reason instanceof Error ? reason.message : t("upload.deleteError", "Unable to delete document.")); }
    finally { setDeleting(null); }
  }

  async function retryCleanup(task: CleanupTask) {
    setRetrying(task.audit_id); setNotice(null);
    try {
      const response = await fetch("/api/v1/documents/cleanup-pending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditId: task.audit_id }) });
      const body = await readJsonResponse<{ data?: { status?: string }; error?: { message?: string } }>(response);
      if (!response.ok) throw new Error(responseMessage(body, t("upload.cleanupRetryFailed", "Storage cleanup retry failed.")));
      setNotice(body?.data?.status === "complete" ? `Storage cleanup complete for ${task.file_name}.` : `Storage cleanup remains pending for ${task.file_name}.`);
      await load();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : t("upload.cleanupRetryFailed", "Storage cleanup retry failed.")); }
    finally { setRetrying(null); }
  }

  const tableHeaders = [
    t("upload.colDocument", "Document"),
    t("upload.colType", "Type"),
    t("upload.colFileType", "File type"),
    t("upload.colUploaded", "Uploaded"),
    t("common.status", "Status"),
    t("upload.colRows", "Rows"),
    t("common.actions", "Actions"),
  ];

  return <div className="min-h-screen bg-slate-50"><Header pageName="Uploaded Documents" /><main className="space-y-6 p-5 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900 font-heading">{t("upload.title", "Uploaded Documents")}</h1><p className="mt-1 text-sm text-slate-600">{t("upload.subtitle", "Document history and validation results")}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-60 cursor-pointer"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />{t("common.refresh", "Refresh")}</button>{canManage && <button type="button" onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 cursor-pointer"><Plus className="size-4" />{t("upload.addDocument", "Add Document")}</button>}</div></div>
    {downloadError && <div role="alert" className="fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 shadow-xl"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" /><span className="flex-1">{downloadError}</span><button type="button" onClick={() => setDownloadError(null)} aria-label="Dismiss notification" className="rounded p-1 text-rose-700 hover:bg-rose-100"><X className="size-4" /></button></div>}
    {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="text-blue-800 underline">{t("common.dismiss", "Dismiss")}</button></div>}
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">{error}</div>}
    {loading ? <DocumentStatsSkeleton /> : <section aria-label="Document statistics" className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Stat label={t("upload.totalDocuments", "Total Documents")} value={summary.total} tone="slate" integer={integer} detail={t("upload.uploadedFiles", "Uploaded files")} /><Stat label={t("upload.successful", "Successful")} value={summary.validated} tone="teal" integer={integer} detail={t("upload.statusValidated", "Validated")} /><Stat label={t("upload.failed", "Failed")} value={summary.rejected} tone="rose" integer={integer} detail={t("upload.statusRejected", "Rejected")} /></section>}
    {canManage && pending.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><h2 className="font-semibold text-amber-950">{t("upload.pendingCleanup", "Pending Storage Cleanup")}</h2><ul className="mt-2 divide-y divide-amber-200">{pending.map((task) => <li key={task.audit_id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate text-amber-950">{task.file_name} <span className="text-amber-800">({typeLabel(task.document_type as RecentDocument["document_type"], t)})</span></span><button type="button" disabled={retrying === task.audit_id} onClick={() => void retryCleanup(task)} className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-100 disabled:opacity-50 cursor-pointer"><RefreshCw className={`size-3.5 ${retrying === task.audit_id ? "animate-spin" : ""}`} />{t("upload.retryCleanup", "Retry cleanup")}</button></li>)}</ul></section>}
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center xl:justify-between"><div className="relative min-w-0 flex-1 xl:max-w-lg"><Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t("upload.searchPlaceholder", "Search file or uploader")} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20" /></div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="document-filter">{t("upload.docType", "Document type")}</label><select id="document-filter" value={documentType} onChange={(event) => { setDocumentType(event.target.value); setPage(1); }} className={selectClass}><option value="all">{t("upload.allDocTypes", "All document types")}</option><option value="sales">{t("upload.salesShort", "Sales")}</option><option value="outstanding">{t("upload.outstandingShort", "Outstanding")}</option></select><label className="sr-only" htmlFor="file-filter">{t("upload.colFileType", "File type")}</label><select id="file-filter" value={fileType} onChange={(event) => { setFileType(event.target.value); setPage(1); }} className={selectClass}><option value="all">{t("upload.allFileTypes", "All file types")}</option><option value="xlsx">.xlsx</option><option value="xls">.xls</option><option value="pdf">.pdf</option></select></div></div>
      <div className="overflow-x-auto"><table aria-label={loading ? "Loading uploaded documents" : "Uploaded documents"} aria-busy={loading} className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold text-slate-700"><tr>{tableHeaders.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <DocumentTableSkeleton /> : rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">{t("upload.noDocumentsMatch", "No documents match these filters.")}</td></tr> : rows.map((row) => <tr key={row.id} className="text-slate-700"><td className="max-w-xs px-4 py-3"><div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-blue-700" /><div className="min-w-0"><p title={row.file_name} className="truncate font-semibold text-slate-900">{row.file_name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{t("upload.uploadedBy", "Uploaded by")} {row.uploader_name || row.uploader_email || t("common.unknown", "Unknown")}</p></div></div></td><td className="whitespace-nowrap px-4 py-3">{typeLabel(row.document_type, t)}</td><td className="whitespace-nowrap px-4 py-3">.{row.file_type || "-"}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{dateFormatter.format(new Date(row.uploaded_at))}</td><td className="whitespace-nowrap px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-semibold ${row.validation_status === "validated" ? "bg-teal-100 text-teal-800" : row.validation_status === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900"}`}>{statusLabel(row.validation_status, t)}</span></td><td className="whitespace-nowrap px-4 py-3 text-xs">{integer.format(row.valid_row_count)}/{integer.format(row.row_count)}</td><td className="whitespace-nowrap px-4 py-3"><div className="flex items-center gap-1"><button type="button" onClick={() => setPreviewId(row.id)} title={t("common.preview", "Preview")} aria-label={`Preview ${row.file_name}`} className="inline-flex size-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100"><Eye className="size-4" /></button><button type="button" onClick={() => void openOriginal(row)} title={t("upload.openOriginalFile", "Open original")} aria-label={`Open ${row.file_name}`} className="inline-flex size-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100"><Download className="size-4" /></button>{canManage && row.validation_status !== "processing" && <button type="button" onClick={() => { setDeleteError(null); setDeleteTarget(row); }} disabled={deleting === row.id} title={t("upload.deletePermanently", "Delete permanently")} aria-label={`Delete ${row.file_name}`} className="inline-flex size-8 items-center justify-center rounded text-rose-700 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="size-4" /></button>}</div></td></tr>)}</tbody></table></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span>{integer.format(pagination.total_items)} {t("common.documents", "documents")}</span><span>{t("common.page", "Page")} {pagination.page} {t("common.of", "of")} {pagination.total_pages}</span></div><Pagination currentPage={pagination.page} totalPages={pagination.total_pages} onPageChange={setPage} className="justify-center sm:justify-end" /></div>
    </section>
    {!canManage && <p className="text-xs text-slate-500">{t("upload.readOnlyNotice", "You have read-only access to document management.")}</p>}
  </main><UploadForm open={uploadOpen} onClose={() => setUploadOpen(false)} onCompleted={(result) => { setUploadOpen(false); setNotice(result.validationStatus === "rejected" ? t("upload.savedAsRejected", "Document saved as Rejected. The original file was not stored.") : t("upload.uploadedAndValidated", "Document uploaded and validated.")); if (page === 1) void load(); else setPage(1); }} />{previewId && <DocumentPreviewModal documentId={previewId} onClose={() => setPreviewId(null)} />}
    {deleteTarget && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null); }}><section role="alertdialog" aria-modal="true" aria-labelledby="delete-document-title" aria-describedby="delete-document-impact" className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start gap-3"><span className="rounded-lg bg-rose-50 p-2 text-rose-700"><Trash2 className="size-5" /></span><div className="min-w-0 flex-1"><h2 id="delete-document-title" className="text-lg font-bold text-slate-900 font-heading">{t("upload.deleteConfirmTitle", "Delete document?")}</h2><p className="mt-1 break-words text-sm font-semibold text-slate-700">{deleteTarget.file_name}</p></div><button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deleting)} aria-label="Close delete confirmation" className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X className="size-5" /></button></div><dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs"><div><dt className="text-slate-500">{t("upload.docType", "Document type")}</dt><dd className="mt-1 font-semibold text-slate-800">{typeLabel(deleteTarget.document_type, t)}</dd></div><div><dt className="text-slate-500">{t("common.status", "Status")}</dt><dd className="mt-1 font-semibold text-slate-800">{statusLabel(deleteTarget.validation_status, t)}</dd></div></dl><p id="delete-document-impact" className="mt-4 text-sm leading-6 text-slate-600">{deleteTarget.document_type === "OUTSTANDING_REPORT" ? t("upload.deleteImpactOutstanding", "Document staging data and validation errors will be deleted. Overdue records will be recalculated from remaining valid documents. This deletion is permanent.") : t("upload.deleteImpactSales", "Document staging data and validation errors will be deleted. Uploaded customers will only be deleted if no longer in use. This deletion is permanent.")}</p>{deleteError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{deleteError}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(deleting)} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{t("common.cancel", "Cancel")}</button><button type="button" onClick={() => void deleteDocument()} disabled={Boolean(deleting)} className="inline-flex items-center gap-2 rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50">{deleting ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{deleting ? t("common.deleting", "Deleting...") : t("upload.deletePermanently", "Delete permanently")}</button></div></section></div>}
  </div>;
}

function Stat({ label, value, tone, integer, detail }: { label: string; value: number; tone: "slate" | "teal" | "rose"; integer: Intl.NumberFormat; detail: string }) {
  const styles = {
    slate: { icon: <FileText className="size-4" />, className: "bg-blue-50 text-blue-600" },
    teal: { icon: <CheckCircle2 className="size-4" />, className: "bg-teal-50 text-teal-700" },
    rose: { icon: <AlertCircle className="size-4" />, className: "bg-rose-50 text-rose-700" },
  };
  const style = styles[tone];
  return <article className="min-h-32 rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-700 font-heading">{label}</h2><span className={`rounded p-1.5 ${style.className}`}>{style.icon}</span></div><p className="mt-4 text-2xl font-bold tracking-tight text-slate-900 font-heading">{integer.format(value)}</p><div className="mt-3 flex items-center gap-1 text-xs text-slate-500"><Activity className={`size-3.5 ${tone === "rose" ? "text-rose-600" : "text-teal-600"}`} />{detail}</div></article>;
}

function DocumentStatsSkeleton() {
  return <section aria-label="Loading document statistics" aria-busy="true" className="grid grid-cols-1 gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <article key={index} className="min-h-32 animate-pulse rounded-xl border border-slate-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="h-4 w-32 rounded bg-slate-200" /><div className="size-7 rounded bg-slate-100" /></div><div className="mt-4 h-7 w-20 rounded bg-slate-200" /><div className="mt-3 h-3 w-24 rounded bg-slate-100" /></article>)}</section>;
}

function DocumentTableSkeleton() {
  return <>{Array.from({ length: 10 }, (_, index) => <tr key={index} aria-hidden="true" className="animate-pulse">{[
    <div key="document" className="space-y-2"><div className="h-4 w-44 max-w-full rounded bg-slate-200" /><div className="h-3 w-28 rounded bg-slate-100" /></div>,
    <div key="type" className="h-4 w-20 rounded bg-slate-100" />,
    <div key="file-type" className="h-4 w-12 rounded bg-slate-100" />,
    <div key="uploaded" className="h-4 w-28 rounded bg-slate-100" />,
    <div key="status" className="h-5 w-20 rounded bg-slate-200" />,
    <div key="rows" className="h-4 w-12 rounded bg-slate-100" />,
    <div key="actions" className="flex gap-1"><div className="size-8 rounded bg-slate-100" /><div className="size-8 rounded bg-slate-100" /><div className="size-8 rounded bg-slate-100" /></div>,
  ].map((skeleton, column) => <td key={column} className="px-4 py-3">{skeleton}</td>)}</tr>)}</>;
}
