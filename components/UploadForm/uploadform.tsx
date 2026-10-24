"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, FileUp, UploadCloud, X } from "lucide-react";
import Pagination from "@/components/Pagination";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPT = ".xlsx,.xls,.pdf";
const PAGE_SIZE = 25;

export type UploadIssue = { field: string; row?: number; code: string; message: string; rawValue?: string };
type DocumentType = "COMPANY_SALES_REPORT" | "OUTSTANDING_REPORT";
type ExtractedRow = { row_number: number; status: "valid" | "invalid" | "ignored"; values: string[] };
type ReviewData = {
  fileName: string;
  documentType: DocumentType;
  headers: string[];
  rows: ExtractedRow[];
  errors: UploadIssue[];
  warnings: UploadIssue[];
  canFinalize: boolean;
};

export type UploadResult = {
  documentId: string;
  validationStatus: "validated" | "rejected";
  errors?: UploadIssue[];
  warnings?: UploadIssue[];
  unmatchedCustomerCount?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCompleted: (result: UploadResult) => void;
};

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function issueTable(issues: UploadIssue[], page: number, onPageChange: (page: number) => void, id: string) {
  const totalPages = Math.max(1, Math.ceil(issues.length / PAGE_SIZE));
  const currentRows = issues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <section aria-label={`${id} validation details`} className="space-y-2">
    <h3 className="text-sm font-bold text-slate-900 font-heading">Validation Warnings &amp; Errors</h3>
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 font-semibold text-slate-600"><tr><th className="whitespace-nowrap px-3 py-2">Severity</th><th className="whitespace-nowrap px-3 py-2">Row</th><th className="whitespace-nowrap px-3 py-2">Field</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Source value</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{currentRows.map((issue, index) => <tr key={`${issue.code}-${issue.row ?? "file"}-${index}`}>
          <td className="whitespace-nowrap px-3 py-2"><span className={`rounded px-2 py-1 text-[10px] font-bold ${issue.code === "WARNING" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"}`}>{issue.code === "WARNING" ? "WARNING" : "ERROR"}</span></td>
          <td className="whitespace-nowrap px-3 py-2 text-slate-600">{issue.row ?? "-"}</td><td className="whitespace-nowrap px-3 py-2 text-slate-700">{issue.field}</td><td className="min-w-64 px-3 py-2 text-slate-700">{issue.message}</td><td className="max-w-64 break-words px-3 py-2 text-slate-500">{issue.rawValue ?? "-"}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>{issues.length} findings · Page {page} of {totalPages} · {PAGE_SIZE} per page</span>{totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />}</div>
  </section>;
}

export default function UploadForm({ open, onClose, onCompleted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("COMPANY_SALES_REPORT");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<"select" | "review">("select");
  const [busy, setBusy] = useState<"preview" | "upload" | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [parseErrors, setParseErrors] = useState<UploadIssue[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [rowPage, setRowPage] = useState(1);
  const [issuePage, setIssuePage] = useState(1);

  useEffect(() => {
    if (!open) return;
    setDocumentType("COMPANY_SALES_REPORT");
    setFile(null);
    setStep("select");
    setBusy(null);
    setReview(null);
    setParseErrors([]);
    setRequestError(null);
    setRowPage(1);
    setIssuePage(1);
  }, [open]);

  useEffect(() => {
    if (!open || busy) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [busy, onClose, open]);

  if (!open) return null;

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setReview(null);
    setParseErrors([]);
    setRequestError(null);
    setStep("select");
    setRowPage(1);
    setIssuePage(1);
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xlsx", "xls", "pdf"].includes(extension)) {
      setFile(null);
      setRequestError("Format file harus .xlsx, .xls, atau .pdf.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setRequestError("Ukuran file tidak boleh lebih dari 5 MB.");
      return;
    }
    setFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  function appendFile(formData: FormData) {
    if (!file) return;
    formData.append("file", file);
    formData.append("document_type", documentType);
  }

  async function previewFile() {
    if (!file || busy) return;
    setBusy("preview");
    setRequestError(null);
    setParseErrors([]);
    const formData = new FormData();
    appendFile(formData);
    try {
      const response = await fetch("/api/v1/documents/preview", { method: "POST", body: formData, cache: "no-store" });
      const body = await readJsonResponse<{ data?: ReviewData; error?: { code?: string; errors?: UploadIssue[]; message?: string } }>(response);
      if (!response.ok || !body?.data) {
        const errors = body?.error?.errors ?? [];
        if (body?.error?.code === "PARSE_FAILED") {
          setParseErrors(errors.length ? errors : [{ field: "file", code: "PARSE_FAILED", message: responseMessage(body, "File gagal diekstrak.") }]);
          setStep("review");
          return;
        }
        throw new Error(responseMessage(body, "Gagal menyiapkan preview."));
      }
      setReview(body.data);
      setStep("review");
      setRowPage(1);
      setIssuePage(1);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Gagal menyiapkan preview.");
    } finally {
      setBusy(null);
    }
  }

  async function finalizeUpload() {
    if (!file || !review?.canFinalize || busy) return;
    setBusy("upload");
    setRequestError(null);
    const formData = new FormData();
    appendFile(formData);
    try {
      const response = await fetch("/api/v1/documents/upload", { method: "POST", body: formData });
      const body = await readJsonResponse<{ data?: UploadResult; error?: { code?: string; documentId?: string; errors?: UploadIssue[]; message?: string } }>(response);
      if (body?.data?.documentId) {
        onCompleted(body.data);
        return;
      }
      if (body?.error?.code === "VALIDATION_FAILED" && body.error.documentId) {
        onCompleted({ documentId: body.error.documentId, validationStatus: "rejected", errors: body.error.errors ?? review.errors, warnings: review.warnings });
        return;
      }
      throw new Error(responseMessage(body, "Upload dokumen gagal."));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Upload dokumen gagal. Silakan coba lagi.");
    } finally {
      setBusy(null);
    }
  }

  const findings = review ? [...review.errors, ...review.warnings.map((warning) => ({ ...warning, code: "WARNING" }))] : [];
  const rowTotalPages = Math.max(1, Math.ceil((review?.rows.length ?? 0) / PAGE_SIZE));
  const visibleRows = review?.rows.slice((rowPage - 1) * PAGE_SIZE, rowPage * PAGE_SIZE) ?? [];

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="upload-title">
    <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><div className="rounded-lg bg-blue-50 p-2 text-[#3B6FF5]"><UploadCloud className="size-5" /></div><div><h2 id="upload-title" className="text-lg font-bold text-slate-900 font-heading">{step === "select" ? "Upload Document" : "Review Document"}</h2><p className="text-xs text-slate-500">{step === "select" ? "Pilih file untuk meninjau hasil ekstraksi dan validasi." : "Periksa data dan temuan sebelum menyimpan dokumen."}</p></div></div>
        <button type="button" onClick={onClose} disabled={Boolean(busy)} className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-40 cursor-pointer" aria-label="Close upload"><X className="size-5" /></button>
      </header>

      {step === "select" ? <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
        <div><label htmlFor="document-type" className="mb-2 block text-xs font-semibold text-slate-600">Document Type</label><select id="document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)} disabled={Boolean(busy)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"><option value="COMPANY_SALES_REPORT">Company Sales Report</option><option value="OUTSTANDING_REPORT">Outstanding Report Data</option></select></div>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
        <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => !busy && inputRef.current?.click()} className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${isDragging ? "border-[#3B6FF5] bg-blue-100" : "border-blue-200 bg-blue-50"}`}>
          <FileUp className="mx-auto mb-3 size-7 text-[#3B6FF5]" /><p className="font-semibold text-slate-800">Drag &amp; drop file or <span className="text-[#3B6FF5] underline">Browse files</span></p><p className="mt-2 text-xs text-slate-500">.xlsx, .xls, .pdf · Maksimum 5 MB</p>
        </div>
        {file && <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex min-w-0 items-center gap-3"><FileUp className="size-5 shrink-0 text-[#3B6FF5]" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{file.name}</p><p className="text-xs text-slate-500">{formatSize(file.size)}</p></div></div><button type="button" onClick={(event) => { event.stopPropagation(); setFile(null); setRequestError(null); }} className="rounded p-1 text-slate-400 hover:text-red-600 cursor-pointer" aria-label="Remove file"><X className="size-4" /></button></div>}
        {requestError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{requestError}</p>}
      </div> : <div className="min-h-0 space-y-5 overflow-y-auto p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{file?.name}</p><p className="text-xs text-slate-500">{review?.documentType === "COMPANY_SALES_REPORT" ? "Company Sales Report" : "Outstanding Report Data"} · {review?.rows.length ?? 0} extracted rows</p></div><span className="rounded bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{file ? formatSize(file.size) : ""}</span></div>
        {busy === "preview" && <div aria-label="Preparing preview" aria-busy="true" className="space-y-3"><div className="h-7 animate-pulse rounded bg-slate-100" /><div className="h-56 animate-pulse rounded-lg bg-slate-100" /></div>}
        {parseErrors.length > 0 && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><div className="mb-2 flex items-center gap-2 font-bold"><AlertCircle className="size-4" />File tidak dapat diparsing</div>{parseErrors.map((issue, index) => <p key={`${issue.code}-${index}`} className="text-xs">{issue.message}</p>)}<p className="mt-2 text-xs">Pilih file lain untuk melanjutkan.</p></div>}
        {review && <>
          <section aria-label="Extracted data">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900 font-heading">Extracted Data</h3><div className="flex flex-wrap gap-2 text-[11px]"><span className="rounded bg-teal-50 px-2 py-1 font-semibold text-teal-800">Valid {review.rows.filter((row) => row.status === "valid").length}</span><span className="rounded bg-rose-50 px-2 py-1 font-semibold text-rose-800">Error {review.rows.filter((row) => row.status === "invalid").length}</span><span className="rounded bg-slate-100 px-2 py-1 font-semibold text-slate-700">Ignored {review.rows.filter((row) => row.status === "ignored").length}</span></div></div>
            <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 font-semibold text-slate-600"><tr><th className="whitespace-nowrap px-3 py-2">Status</th><th className="whitespace-nowrap px-3 py-2">Row</th>{review.headers.map((header, index) => <th key={`${header}-${index}`} className="whitespace-nowrap px-3 py-2">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleRows.length ? visibleRows.map((row) => <tr key={row.row_number}><td className="whitespace-nowrap px-3 py-2"><span className={`rounded px-2 py-1 text-[10px] font-bold ${row.status === "valid" ? "bg-teal-50 text-teal-800" : row.status === "invalid" ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-700"}`}>{row.status === "valid" ? "VALID" : row.status === "invalid" ? "ERROR" : "IGNORED"}</span></td><td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.row_number}</td>{review.headers.map((header, index) => <td key={`${header}-${index}`} className="max-w-64 whitespace-nowrap px-3 py-2 text-slate-700">{row.values[index] || "-"}</td>)}</tr>) : <tr><td colSpan={review.headers.length + 2} className="px-3 py-8 text-center text-slate-500">Tidak ada baris data hasil ekstraksi.</td></tr>}</tbody></table></div>
            <div className="mt-3 flex flex-col gap-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>{review.rows.length} rows · Page {rowPage} of {rowTotalPages} · {PAGE_SIZE} per page</span>{rowTotalPages > 1 && <Pagination currentPage={rowPage} totalPages={rowTotalPages} onPageChange={setRowPage} />}</div>
          </section>
          {findings.length ? issueTable(findings, issuePage, setIssuePage, "Upload") : <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-800"><CheckCircle2 className="size-4" />Validasi selesai tanpa error atau warning.</div>}
          {review.errors.length > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Jika difinalisasi, dokumen akan dicatat sebagai Rejected dan file asli tidak disimpan.</p>}
        </>}
        {requestError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{requestError}</p>}
      </div>}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
        {step === "select" ? <><button type="button" onClick={onClose} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer">Cancel</button><button type="button" onClick={() => void previewFile()} disabled={!file || Boolean(busy)} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">{busy === "preview" ? "Reviewing..." : "Review & Validate"}</button></> : <><button type="button" onClick={() => { setStep("select"); setReview(null); setParseErrors([]); setRequestError(null); }} disabled={Boolean(busy)} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 cursor-pointer"><ArrowLeft className="size-4" />Back to file</button><div className="ml-auto flex gap-2"><button type="button" onClick={onClose} disabled={Boolean(busy)} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 cursor-pointer">Cancel</button><button type="button" onClick={() => void finalizeUpload()} disabled={!review?.canFinalize || Boolean(busy)} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">{busy === "upload" ? "Uploading..." : "Upload Document"}</button></div></>}
      </footer>
    </div>
  </div>;
}
