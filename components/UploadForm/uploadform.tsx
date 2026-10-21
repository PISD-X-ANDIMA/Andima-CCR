"use client";

import { DragEvent, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, FileUp, UploadCloud, X } from "lucide-react";
import { readJsonResponse, responseMessage } from "@/lib/clientHttp";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPT = ".xlsx,.xls,.pdf";

export type UploadIssue = { field: string; row?: number; code: string; message: string; rawValue?: string };

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

type DocumentType = "COMPANY_SALES_REPORT" | "OUTSTANDING_REPORT";

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function UploadForm({ open, onClose, onCompleted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("COMPANY_SALES_REPORT");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"ready" | "processing" | "validated" | "rejected">("ready");
  const [errors, setErrors] = useState<UploadIssue[]>([]);
  const [warnings, setWarnings] = useState<UploadIssue[]>([]);

  if (!open) return null;

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setErrors([]);
    setWarnings([]);
    setStatus("ready");
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xlsx", "xls", "pdf"].includes(extension)) {
      setErrors([{ field: "file", code: "UNSUPPORTED_FORMAT", message: "File format must be .xlsx, .xls, or .pdf." }]);
      setFile(null);
      setStatus("rejected");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setErrors([{ field: "file", code: "FILE_TOO_LARGE", message: "File size cannot exceed 5 MB." }]);
      setFile(null);
      setStatus("rejected");
      return;
    }
    setFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  async function submit() {
    if (!file || status === "processing") return;
    setStatus("processing");
    setErrors([]);
    setWarnings([]);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);
    try {
      const response = await fetch("/api/v1/documents/upload", { method: "POST", body: formData });
      const body = await readJsonResponse<{ data?: UploadResult; error?: { errors?: UploadResult["errors"]; message?: string } }>(response);
      if (!response.ok || !body?.data) {
        setErrors(body?.error?.errors?.length ? body.error.errors : [{ field: "file", code: "UPLOAD_FAILED", message: responseMessage(body, "File processing failed.") }]);
        setStatus("rejected");
        return;
      }
      setStatus(body.data.validationStatus);
      setErrors(body.data.errors ?? []);
      setWarnings(body.data.warnings ?? []);
      onCompleted(body.data);
    } catch {
      setErrors([{ field: "file", code: "NETWORK_ERROR", message: "Connection failed. Please try again." }]);
      setWarnings([]);
      setStatus("rejected");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-blue-50 p-2 text-[#3B6FF5]"><UploadCloud className="size-5" /></div><div><h2 id="upload-title" className="text-lg font-bold text-slate-900 font-heading">Upload Document</h2><p className="text-xs text-slate-500">Original file and parsed data records will be saved.</p></div></div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Close upload"><X className="size-5" /></button>
        </div>
        <div className="space-y-5 overflow-y-auto p-6">
          <div><label htmlFor="document-type" className="mb-2 block text-xs font-semibold text-slate-600">Document Type</label><select id="document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)} disabled={status === "processing"} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="COMPANY_SALES_REPORT">Company Sales Report</option><option value="OUTSTANDING_REPORT">Outstanding Report Data</option></select></div>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
          <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()} className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${isDragging ? "border-[#3B6FF5] bg-blue-100" : "border-[#a5b4fc] bg-[#eff6ff]"}`}>
            <FileUp className="mx-auto mb-3 size-7 text-[#3B6FF5]" /><p className="font-semibold text-slate-800">Drag &amp; drop file or <span className="text-[#3B6FF5] underline">Browse files</span></p><p className="mt-2 text-xs text-slate-500">.xlsx, .xls, .pdf - Maximum 5 MB</p>
          </div>
          {file && <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex min-w-0 items-center gap-3"><FileUp className="size-5 shrink-0 text-[#3B6FF5]" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{file.name}</p><p className="text-xs text-slate-500">{formatSize(file.size)} - {status === "processing" ? "Processing" : status === "validated" ? "Validated" : "Ready"}</p></div></div><button type="button" onClick={(event) => { event.stopPropagation(); setFile(null); setStatus("ready"); setErrors([]); setWarnings([]); }} className="rounded p-1 text-slate-400 hover:text-red-600 cursor-pointer" aria-label="Remove file"><X className="size-4" /></button></div>}
          {status === "validated" && <div className="flex items-center gap-2 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-700"><CheckCircle2 className="size-4" />Document successfully validated and saved.</div>}
          {errors.length > 0 && <div className="space-y-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"><div className="flex items-center gap-2 font-bold font-heading"><AlertCircle className="size-4" />Validation Failed</div>{errors.map((error, index) => <p key={`${error.code}-${index}`} className="text-xs">{error.row ? `Row ${error.row} - ` : ""}{error.field}: {error.message}</p>)}</div>}
          {warnings.length > 0 && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><div className="flex items-center gap-2 font-bold font-heading"><AlertTriangle className="size-4" />Customer Matching Warnings ({warnings.length})</div>{warnings.map((warning, index) => <p key={`${warning.code}-${warning.row ?? "file"}-${index}`} className="text-xs">{warning.row ? `Row ${warning.row} - ` : ""}{warning.field}: {warning.message}</p>)}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4"><button type="button" onClick={onClose} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer">Cancel</button><button type="button" onClick={() => void submit()} disabled={!file || status === "processing" || status === "validated"} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">{status === "processing" ? "Processing..." : "Validate & Save"}</button></div>
      </div>
    </div>
  );
}
