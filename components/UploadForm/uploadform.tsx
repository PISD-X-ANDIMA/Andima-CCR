"use client";

import { DragEvent, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, UploadCloud, X } from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPT = ".xlsx,.xls,.csv,.pdf";

export type UploadResult = {
  documentId: string;
  validationStatus: "validated" | "rejected";
  errors?: Array<{ field: string; row?: number; code: string; message: string }>;
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
  const [errors, setErrors] = useState<Array<{ field: string; row?: number; code: string; message: string }>>([]);

  if (!open) return null;

  function chooseFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setErrors([]);
    setStatus("ready");
    const extension = nextFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xlsx", "xls", "csv", "pdf"].includes(extension)) {
      setErrors([{ field: "file", code: "UNSUPPORTED_FORMAT", message: "Format file harus .xlsx, .xls, .csv, atau .pdf." }]);
      setFile(null);
      setStatus("rejected");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setErrors([{ field: "file", code: "FILE_TOO_LARGE", message: "Ukuran file tidak boleh lebih dari 5 MB." }]);
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
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", documentType);
    try {
      const response = await fetch("/api/v1/documents/upload", { method: "POST", body: formData });
      const body = await response.json() as { data?: UploadResult; error?: { errors?: UploadResult["errors"]; message?: string } };
      if (!response.ok || !body.data) {
        setErrors(body.error?.errors?.length ? body.error.errors : [{ field: "file", code: "UPLOAD_FAILED", message: body.error?.message ?? "File gagal diproses." }]);
        setStatus("rejected");
        return;
      }
      setStatus(body.data.validationStatus);
      setErrors(body.data.errors ?? []);
      onCompleted(body.data);
    } catch {
      setErrors([{ field: "file", code: "NETWORK_ERROR", message: "Koneksi gagal. Coba lagi." }]);
      setStatus("rejected");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-blue-50 p-2 text-[#3B6FF5]"><UploadCloud className="size-5" /></div><div><h2 id="upload-title" className="text-lg font-bold text-slate-900">Unggah Dokumen</h2><p className="text-xs text-slate-500">File asli dan data hasil parsing akan disimpan.</p></div></div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Tutup upload"><X className="size-5" /></button>
        </div>
        <div className="space-y-5 overflow-y-auto p-6">
          <div><label htmlFor="document-type" className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Jenis Dokumen</label><select id="document-type" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)} disabled={status === "processing"} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="COMPANY_SALES_REPORT">Company Sales Report</option><option value="OUTSTANDING_REPORT">Data Outstanding</option></select></div>
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
          <div onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()} className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${isDragging ? "border-[#3B6FF5] bg-blue-100" : "border-[#a5b4fc] bg-[#eff6ff]"}`}>
            <FileUp className="mx-auto mb-3 size-7 text-[#3B6FF5]" /><p className="font-semibold text-slate-800">Tarik & lepas file atau <span className="text-[#3B6FF5] underline">Jelajahi file</span></p><p className="mt-2 text-xs text-slate-500">.xlsx, .xls, .csv, .pdf - maksimum 5 MB</p>
          </div>
          {file && <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex min-w-0 items-center gap-3"><FileUp className="size-5 shrink-0 text-[#3B6FF5]" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{file.name}</p><p className="text-xs text-slate-500">{formatSize(file.size)} - {status === "processing" ? "Processing" : status === "validated" ? "Validated" : "Ready"}</p></div></div><button type="button" onClick={(event) => { event.stopPropagation(); setFile(null); setStatus("ready"); setErrors([]); }} className="rounded p-1 text-slate-400 hover:text-red-600" aria-label="Hapus file"><X className="size-4" /></button></div>}
          {status === "validated" && <div className="flex items-center gap-2 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm text-teal-700"><CheckCircle2 className="size-4" />Dokumen berhasil divalidasi dan disimpan.</div>}
          {errors.length > 0 && <div className="space-y-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"><div className="flex items-center gap-2 font-bold"><AlertCircle className="size-4" />Validasi gagal</div>{errors.map((error, index) => <p key={`${error.code}-${index}`} className="text-xs">{error.row ? `Baris ${error.row} - ` : ""}{error.field}: {error.message}</p>)}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4"><button type="button" onClick={onClose} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Batal</button><button type="button" onClick={() => void submit()} disabled={!file || status === "processing" || status === "validated"} className="inline-flex items-center gap-2 rounded-md bg-[#3B6FF5] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{status === "processing" ? "Memproses..." : "Validasi & Simpan"}</button></div>
      </div>
    </div>
  );
}
