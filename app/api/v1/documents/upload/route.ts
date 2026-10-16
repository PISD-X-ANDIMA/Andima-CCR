import { checkOrigin } from "@/lib/server/http";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/server/admin";
import { describeSupabaseError, evaluateOverdueAlertsInSupabase } from "@/lib/supabaseOverdueApi";
import { getCcrProfile, canUpload } from "@/lib/server/authorization";
import { COMPANY_ALIASES, OUTSTANDING_ALIASES, normalize, numberValue, dateValue, periodValue, validateRows } from "@/lib/documentUploadValidation";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "pdf"]);
type ValidationError = import("@/lib/documentUploadValidation").ValidationError;
type DocumentType = import("@/lib/documentUploadValidation").DocumentType;
type PersistedUploadRow = Record<string, unknown> & {
  customer_id?: string | null;
  customer_name?: string;
  customer_code?: string | null;
  c1_customer_id?: string | null;
  create_date?: string | null;
  job_number?: string | null;
  mawb?: string | null;
};

function jsonError(message: string, status: number, code: string, errors: ValidationError[] = []) {
  return NextResponse.json({ error: { code, message, errors } }, { status });
}

function withTiming(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, duration]) => `${name};dur=${Math.round(duration)}`), `total;dur=${total}`].join(", "));
  response.headers.set("X-Upload-Duration-Ms", String(total));
  return response;
}

function parseFailure(error: unknown): ValidationError {
  const code = error instanceof Error ? error.message : "PARSING_FAILED";
  return {
    field: "file",
    code,
    message: code === "PDF_TEXT_NOT_EXTRACTABLE"
      ? "PDF tidak memiliki text layer yang dapat dibaca."
      : code === "PDF_TABLE_NOT_FOUND"
          ? "Text PDF terbaca, tetapi baris tabel tidak ditemukan."
          : code === "MISSING_HEADER"
            ? "Header tabel tidak ditemukan atau tidak sesuai template."
            : code === "PDF_PARSE_FAILED"
              ? "PDF gagal dibaca oleh parser. Pastikan file tidak rusak dan memiliki text layer."
          : "File tidak dapat diproses.",
  };
}

type PdfItem = { str: string; x: number; y: number };

function pdfItems(content: { items: unknown[] }): PdfItem[] {
  return content.items.flatMap((item) => {
    if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) return [];
    const textItem = item as { str: string; transform: number[] };
    return textItem.str.trim() ? [{ str: textItem.str.trim(), x: textItem.transform[4], y: textItem.transform[5] }] : [];
  });
}

function nearest(items: PdfItem[], y: number, minX: number, maxX: number, tolerance = 7) {
  return items
    .filter((item) => item.x >= minX && item.x < maxX && Math.abs(item.y - y) <= tolerance)
    .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y) || a.x - b.x)[0]?.str ?? "";
}

function columnText(items: PdfItem[], y: number, minX: number, maxX: number, tolerance = 7) {
  return items
    .filter((item) => item.x >= minX && item.x < maxX && Math.abs(item.y - y) <= tolerance)
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((item) => item.str)
    .filter((value, index, values) => index === 0 || value !== values[index - 1])
    .join(" ");
}

async function parsePdf(buffer: Buffer, type: DocumentType) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // pdfjs needs an explicit font directory in the Next.js Node runtime. Without
    // this, pages using standard Type1 fonts can fail during text extraction.
    const standardFontDataUrl = `${pathToFileURL(join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts")).toString()}/`;
    // Next.js bundles pdfjs as a server chunk and cannot resolve its default
    // fake-worker URL at runtime. Register the worker module explicitly so
    // pdfjs uses its in-process handler instead of importing a missing chunk.
    const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as typeof globalThis & { pdfjsWorker?: typeof workerModule }).pdfjsWorker = workerModule;
    const document = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl,
      useSystemFonts: false,
      disableFontFace: true,
    }).promise;
    const rows: string[][] = [];
    let reportPeriod = "";
    let hasText = false;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      let items: PdfItem[];
      try {
        items = pdfItems(await page.getTextContent());
      } catch (error) {
        // A malformed page should not hide valid rows from other pages. Keep the
        // page diagnostic server-side and continue extracting the rest.
        console.error("[document-upload] PDF page text extraction failed", {
          type,
          page: pageNumber,
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      hasText ||= items.length > 0;
      const periodItem = items.find((item) => /\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2}/i.test(item.str));
      if (!reportPeriod && periodItem) {
        const match = periodItem.str.match(/(\d{4})-(\d{2})-\d{2}/);
        if (match) reportPeriod = `${match[1]}-${match[2]}`;
      }
      if (type === "COMPANY_SALES_REPORT") {
        for (const job of items.filter((item) => item.x < 75 && /\/[0-9]{2,}/.test(item.str))) {
          const customer = columnText(items, job.y, 75, 165);
          const revenue = nearest(items, job.y, 300, 390);
          const subTotal = nearest(items, job.y, 390, 470);
          const vat = nearest(items, job.y, 465, 530);
          const pph = nearest(items, job.y, 530, 590);
          const others = nearest(items, job.y, 590, 650);
          const dip = nearest(items, job.y, 650, 710);
          if (revenue) rows.push([reportPeriod, customer, revenue, subTotal, vat, pph, String((numberValue(others) ?? 0) + (numberValue(dip) ?? 0))]);
        }
      } else {
        for (const rowNumber of items.filter((item) => item.x < 65 && /^\d+$/.test(item.str))) {
          const job = nearest(items, rowNumber.y, 65, 200);
          const invoice = nearest(items, rowNumber.y, 190, 300);
          const customer = columnText(items, rowNumber.y, 295, 410);
          const mawb = nearest(items, rowNumber.y, 410, 530);
          const amount = nearest(items, rowNumber.y, 520, 640);
          const dueDate = nearest(items, rowNumber.y, 635, 715);
          const createDate = nearest(items, rowNumber.y, 715, 810);
          if (job && invoice && amount && dueDate) rows.push([invoice, customer, amount, dueDate, createDate, job, mawb]);
        }
      }
    }
    if (!hasText) throw new Error("PDF_TEXT_NOT_EXTRACTABLE");
    if (!rows.length) throw new Error("PDF_TABLE_NOT_FOUND");
    if (type === "COMPANY_SALES_REPORT") {
      if (!reportPeriod) throw new Error("MISSING_HEADER");
      return [["period", "customer", "revenue", "trucking cost", "handling cost", "storage cost", "other operational cost"], ...rows];
    }
    return [["invoice", "customer", "amount rp", "due date", "created date", "job", "mawb"], ...rows];
  } catch (error) {
    if (error instanceof Error && ["PDF_TEXT_NOT_EXTRACTABLE", "PDF_TABLE_NOT_FOUND", "MISSING_HEADER"].includes(error.message)) throw error;
    console.error("[document-upload] PDF parse failed", {
      type,
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    throw new Error("PDF_PARSE_FAILED");
  }
}

async function parseRows(file: File, type: DocumentType) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".pdf")) return parsePdf(buffer, type);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("EMPTY_WORKBOOK");
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
  const headerAliases = Object.values({ ...COMPANY_ALIASES, ...OUTSTANDING_ALIASES }).flat();
  const headerIndex = allRows.findIndex((row) => {
    const matches = row.map(normalize).filter((value) => headerAliases.includes(value));
    return matches.length >= 3;
  });
  if (headerIndex < 0) throw new Error("MISSING_HEADER");
  return allRows.slice(headerIndex);
}

async function getCustomerMap(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.from("a1_company_list").select("company_list_id, name, company_name, customer_code");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.name) map.set(normalize(row.name), row.company_list_id);
    if (row.company_name) map.set(normalize(row.company_name), row.company_list_id);
    if (row.customer_code) map.set(normalize(row.customer_code), row.company_list_id);
  }
  return map;
}

async function getCanonicalCustomerMap(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.from("c1_customer").select("customer_id, customer_name, customer_code");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.customer_name) map.set(normalize(row.customer_name), row.customer_id);
    if (row.customer_code) map.set(normalize(row.customer_code), row.customer_id);
  }
  return map;
}

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request); if (originError) return originError;
  const startedAt = performance.now();
  const phaseStarted = performance.now();
  const supabase = createClient(await cookies());
  const { data: userData } = await supabase.auth.getUser();
  const authDuration = performance.now() - phaseStarted;
  if (!userData.user) return withTiming(jsonError("Authentication is required.", 401, "UNAUTHENTICATED"), startedAt, { auth: authDuration });
  const profile = await getCcrProfile(supabase, userData.user.id);
  if (!canUpload(profile)) return withTiming(jsonError("Only CCR staff users can upload documents.", 403, "FORBIDDEN"), startedAt, { auth: authDuration });
  // Authorization uses the request session above. Persistence uses the
  // server-only client so C1 writes are not blocked by unrelated legacy RLS
  // policies from other modules.
  const persistenceClient = createAdminClient();

  const form = await request.formData();
  const file = form.get("file");
  const documentType = form.get("document_type");
  if (!(file instanceof File) || (documentType !== "COMPANY_SALES_REPORT" && documentType !== "OUTSTANDING_REPORT")) return withTiming(jsonError("File and document type are required.", 400, "INVALID_REQUEST"), startedAt, { auth: authDuration });
  if (file.size > MAX_FILE_SIZE) return withTiming(jsonError("File tidak boleh lebih dari 5 MB.", 413, "FILE_TOO_LARGE"), startedAt, { auth: authDuration });
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) return withTiming(jsonError("Format file tidak didukung.", 422, "UNSUPPORTED_FORMAT"), startedAt, { auth: authDuration });

  let rows: unknown[][];
  let customerMap: Map<string, string>;
  let canonicalCustomerMap = new Map<string, string>();
  let result: ReturnType<typeof validateRows>;
  const parseStarted = performance.now();
  try {
    rows = await parseRows(file, documentType);
    try {
      customerMap = await getCustomerMap(supabase);
      canonicalCustomerMap = await getCanonicalCustomerMap(persistenceClient);
    } catch (error) {
      console.error("[document-upload] customer master lookup unavailable", error);
      throw new Error("CUSTOMER_MASTER_UNAVAILABLE");
    }
    result = validateRows(rows, documentType, customerMap);
  } catch (error) {
    const parseError = parseFailure(error);
    return withTiming(jsonError(parseError.message, 422, parseError.code, [parseError]), startedAt, { auth: authDuration, parse: performance.now() - parseStarted });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `${userData.user.id}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { data: document, error: documentError } = await persistenceClient.from("c1_document_uploads").insert({ file_name: file.name, document_type: documentType, storage_path: storagePath, mime_type: file.type || "application/octet-stream", file_size_bytes: file.size, checksum, uploader_user_id: userData.user.id, validation_status: "processing", processing_started_at: new Date().toISOString() }).select("id").single();
  if (documentError || !document) return withTiming(jsonError("Unable to create upload record.", 500, "DOCUMENT_CREATE_FAILED"), startedAt, { auth: authDuration, parse: performance.now() - parseStarted });

  const validationErrors = [...result.errors];
  const validationWarnings = [...result.warnings];
  if (!result.rows.length) validationErrors.push({ field: "file", code: "NO_VALID_ROWS", message: "Tidak ada baris valid dalam file." });
  const auditRows = [
    ...validationErrors.map((validationError) => ({ document_id: document.id, row_number: validationError.row ?? null, field_name: validationError.field, error_code: validationError.code, error_message: validationError.message, raw_value: validationError.rawValue ?? null, severity: "ERROR" })),
    ...validationWarnings.map((validationWarning) => ({ document_id: document.id, row_number: validationWarning.row ?? null, field_name: validationWarning.field, error_code: validationWarning.code, error_message: validationWarning.message, raw_value: validationWarning.rawValue ?? null, severity: "WARNING" })),
  ];
  if (auditRows.length) await persistenceClient.from("c1_document_validation_errors").insert(auditRows);
  if (validationErrors.length) {
    await persistenceClient.from("c1_document_uploads").update({ validation_status: "rejected", processed_at: new Date().toISOString(), row_count: Math.max(0, rows.length - 1), valid_row_count: result.rows.length, invalid_row_count: Math.max(0, rows.length - 1 - result.rows.length), error_summary: "Validation failed." }).eq("id", document.id);
    return withTiming(jsonError("Validasi dokumen gagal.", 422, "VALIDATION_FAILED", validationErrors), startedAt, { auth: authDuration, parse: performance.now() - parseStarted, validation: 0 });
  }

  const upload = await persistenceClient.storage.from("c1-document-uploads").upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upload.error) {
    await persistenceClient.from("c1_document_uploads").update({ validation_status: "rejected", processed_at: new Date().toISOString(), error_summary: "Storage upload failed." }).eq("id", document.id);
    return withTiming(jsonError("Unable to store uploaded file.", 500, "STORAGE_FAILED"), startedAt, { auth: authDuration, parse: performance.now() - parseStarted, storage: 0 });
  }

  try {
    const table = documentType === "COMPANY_SALES_REPORT" ? "c1_company_sales_staging_rows" : "c1_outstanding_staging_rows";
    const sourceRows = result.rows as PersistedUploadRow[];
    const resolvedRows = sourceRows;
    const stagingRows = resolvedRows.map((row) => {
      const { customer_code: sourceCustomerCode, ...persistedRow } = row;
      void sourceCustomerCode;
      return {
        ...persistedRow,
        document_id: document.id,
        customer_id: row.customer_id ?? null,
        c1_customer_id: canonicalCustomerMap.get(normalize(row.customer_name ?? ""))
          ?? canonicalCustomerMap.get(normalize(String(row.customer_code ?? "")))
          ?? null,
        ...(documentType === "OUTSTANDING_REPORT"
          ? { create_date: row.create_date ?? null, job_number: row.job_number ?? null, mawb: row.mawb ?? null }
          : {}),
      };
    });
    const { error: stagingError } = await persistenceClient.from(table).insert(stagingRows);
    if (stagingError) throw stagingError;
    // Finalize only the C1 document. The legacy macro refresh function can
    // reference unrelated B1 tables in older remote deployments, so upload
    // persistence must not depend on it.
    const { data: finalizedDocument, error: finalizeError } = await persistenceClient
      .from("c1_document_uploads")
      .update({
        validation_status: "validated",
        processed_at: new Date().toISOString(),
        row_count: result.rows.length,
        valid_row_count: result.rows.length,
        invalid_row_count: 0,
      })
      .eq("id", document.id)
      .eq("uploader_user_id", userData.user.id)
      .eq("validation_status", "processing")
      .select("id")
      .maybeSingle();
    if (finalizeError) throw finalizeError;
    if (!finalizedDocument) throw new Error("Document cannot be finalized.");
    const uploadWarnings = [...validationWarnings];
    if (documentType === "OUTSTANDING_REPORT") {
      try {
        // Use the same server-only persistence client for the projection write;
        // the request session was already checked above for authorization.
        await evaluateOverdueAlertsInSupabase(new Date(), persistenceClient);
      } catch (error) {
        // The document and staging rows are already finalized. Keep the valid
        // upload successful and let the dedicated evaluate endpoint retry later.
        console.error("[document-upload] overdue evaluation failed after upload", {
          documentId: document.id,
          message: describeSupabaseError(error),
        });
        uploadWarnings.push({ field: "overdue", code: "OVERDUE_EVALUATION_FAILED", message: "Data outstanding tersimpan, tetapi overdue alert akan diperbarui pada refresh berikutnya." });
      }
    }
    return withTiming(NextResponse.json({ data: { documentId: document.id, documentType, validationStatus: "validated", rowCount: result.rows.length, validRowCount: result.rows.length, invalidRowCount: 0, errors: [], warnings: uploadWarnings, unmatchedCustomerCount: 0 } }, { status: 201 }), startedAt, { auth: authDuration, parse: performance.now() - parseStarted, persistence: 0 });
  } catch (error) {
    await persistenceClient.storage.from("c1-document-uploads").remove([storagePath]);
    await persistenceClient.from("c1_company_sales_staging_rows").delete().eq("document_id", document.id);
    await persistenceClient.from("c1_outstanding_staging_rows").delete().eq("document_id", document.id);
    const message = describeSupabaseError(error);
    console.error("[document-upload] processing failed", { documentId: document.id, message });
    await persistenceClient.from("c1_document_uploads").update({ validation_status: "rejected", processed_at: new Date().toISOString(), error_summary: message.slice(0, 500) }).eq("id", document.id);
    return withTiming(jsonError("File gagal diproses. Data dashboard tidak diubah.", 500, "PROCESSING_FAILED", [{ field: "file", code: "PROCESSING_FAILED", message }]), startedAt, { auth: authDuration, parse: performance.now() - parseStarted, persistence: 0 });
  }
}
