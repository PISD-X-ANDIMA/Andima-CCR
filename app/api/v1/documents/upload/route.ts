import { createHash } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as XLSX from "xlsx";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "csv", "pdf"]);
const COMPANY_ALIASES = {
  period: ["period", "period month", "bulan", "month"],
  customer: ["customer", "customer name", "company", "company name", "nama customer", "client", "nama pelanggan"],
  revenue: ["revenue", "sales", "sales value", "nilai penjualan", "nilai sales"],
  trucking: ["trucking cost", "trucking", "biaya trucking"],
  handling: ["handling cost", "handling", "biaya handling"],
  storage: ["storage cost", "storage", "biaya storage"],
  otherCost: ["other operational cost", "other cost", "operational cost", "biaya operasional lain"],
};
const OUTSTANDING_ALIASES = {
  invoice: ["invoice", "invoice number", "nomor invoice"],
  customer: ["customer", "customer name", "company", "company name", "nama customer", "client", "nama pelanggan"],
  amount: ["idr", "amount", "amount rp", "outstanding", "outstanding amount", "nominal tagihan"],
  dueDate: ["due date", "due", "tanggal jatuh tempo"],
  createDate: ["create date", "created date", "tanggal dibuat"],
  job: ["job", "job number", "nomor job"],
  mawb: ["mawb"],
};

type ValidationError = { field: string; row?: number; code: string; message: string; rawValue?: string };
type DocumentType = "COMPANY_SALES_REPORT" | "OUTSTANDING_REPORT";

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

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[()[\],.]/g, " ").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function findHeader(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(normalize(header)));
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = text.includes(",") && text.includes(".")
    ? text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "")
    : text.includes(",")
      ? text.replace(",", ".")
      : /\.\d{3}(?:\.|$)/.test(text) ? text.replace(/\./g, "") : text;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function periodValue(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? `${text}-01` : null;
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
          if (customer && revenue) rows.push([reportPeriod, customer, revenue, subTotal, vat, pph, String((numberValue(others) ?? 0) + (numberValue(dip) ?? 0))]);
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
          if (job && invoice && customer && amount && dueDate) rows.push([invoice, customer, amount, dueDate, createDate, job, mawb]);
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
  const { data, error } = await supabase.from("a1_company_list").select("company_list_id, name, company_name");
  if (error) throw new Error("CUSTOMER_LIST_UNAVAILABLE");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.name) map.set(normalize(row.name), row.company_list_id);
    if (row.company_name) map.set(normalize(row.company_name), row.company_list_id);
  }
  return { map, count: data?.length ?? 0 };
}

function validateRows(rows: unknown[][], type: DocumentType, customerMap: Map<string, string>) {
  const header = (rows[0] ?? []).map(normalize);
  const aliases = type === "COMPANY_SALES_REPORT" ? COMPANY_ALIASES : OUTSTANDING_ALIASES;
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, findHeader(header, values)]));
  const required = type === "COMPANY_SALES_REPORT"
    ? ["period", "customer", "revenue", "trucking", "handling", "storage", "otherCost"]
    : ["invoice", "customer", "amount", "dueDate"];
  const errors: ValidationError[] = [];
  for (const field of required) if (indexes[field] === -1) errors.push({ field, code: "MISSING_HEADER", message: `Kolom wajib ${field} tidak ditemukan.` });
  if (errors.length) return { errors, rows: [] as Record<string, unknown>[] };

  const valid: Record<string, unknown>[] = [];
  rows.slice(1).forEach((raw, index) => {
    if (raw.every((value) => String(value ?? "").trim() === "")) return;
    const row = index + 2;
    const value = (key: string) => raw[indexes[key]];
    const customer = String(value("customer") ?? "").trim();
    const customerId = customerMap.get(normalize(customer));
    if (!customer) errors.push({ row, field: "customer", code: "REQUIRED", message: "Customer wajib diisi." });
    else if (!customerId) errors.push({ row, field: "customer", code: "UNKNOWN_CUSTOMER", message: "Customer tidak ditemukan di daftar aktif." });
    if (type === "COMPANY_SALES_REPORT") {
      const revenue = numberValue(value("revenue"));
      const period = periodValue(value("period"));
      if (!period) errors.push({ row, field: "period", code: "INVALID_PERIOD", message: "Periode bulan tidak valid." });
      const costs = ["trucking", "handling", "storage", "otherCost"] as const;
      const parsedCosts = costs.map((cost) => numberValue(value(cost)));
      if (revenue === null || revenue < 0) errors.push({ row, field: "revenue", code: "INVALID_NUMBER", message: "Revenue harus berupa angka tidak negatif." });
      parsedCosts.forEach((cost, index) => {
        if (cost === null || cost < 0) errors.push({ row, field: costs[index], code: "INVALID_NUMBER", message: "Komponen biaya harus berupa angka tidak negatif." });
      });
      if (period && revenue !== null && revenue >= 0 && parsedCosts.every((cost) => cost !== null && cost >= 0) && customerId) valid.push({ row_number: row, period_month: period, customer_name: customer, customer_id: customerId, revenue, trucking_cost: parsedCosts[0], handling_cost: parsedCosts[1], storage_cost: parsedCosts[2], other_operational_cost: parsedCosts[3] });
    } else {
      const amount = numberValue(value("amount"));
      const dueDate = dateValue(value("dueDate"));
      const invoice = String(value("invoice") ?? "").trim();
      if (!invoice) errors.push({ row, field: "invoice", code: "REQUIRED", message: "Invoice wajib diisi." });
      if (amount === null || amount < 0) errors.push({ row, field: "amount", code: "INVALID_NUMBER", message: "Nominal harus berupa angka tidak negatif." });
      if (!dueDate) errors.push({ row, field: "dueDate", code: "INVALID_DATE", message: "Due date tidak valid." });
      if (invoice && amount !== null && amount >= 0 && dueDate && customerId) valid.push({ row_number: row, invoice_number: invoice, customer_name: customer, customer_id: customerId, outstanding_amount: amount, due_date: dueDate, create_date: dateValue(value("createDate")), job_number: String(value("job") ?? "").trim() || null, mawb: String(value("mawb") ?? "").trim() || null });
    }
  });
  if (type === "OUTSTANDING_REPORT") {
    const seenInvoices = new Set<string>();
    for (const row of rows.slice(1)) {
      const invoiceIndex = indexes.invoice;
      if (invoiceIndex < 0) break;
      const invoice = String(row[invoiceIndex] ?? "").trim().toLowerCase();
      if (!invoice) continue;
      if (seenInvoices.has(invoice)) errors.push({ field: "invoice", code: "DUPLICATE_INVOICE", message: "Invoice duplikat ditemukan." });
      seenInvoices.add(invoice);
    }
    if (errors.some((error) => error.code === "DUPLICATE_INVOICE")) return { errors, rows: [] as Record<string, unknown>[] };
  }
  return { errors, rows: valid };
}

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const phaseStarted = performance.now();
  const supabase = createClient(await cookies());
  const { data: userData } = await supabase.auth.getUser();
  const authDuration = performance.now() - phaseStarted;
  if (!userData.user) return withTiming(jsonError("Authentication is required.", 401, "UNAUTHENTICATED"), startedAt, { auth: authDuration });
  const { data: access } = await supabase.from("d3_user_access").select("app_role").eq("auth_user_id", userData.user.id).maybeSingle();
  if (String(access?.app_role ?? "") !== "HR") return withTiming(jsonError("Only admin/staff users can upload documents.", 403, "FORBIDDEN"), startedAt, { auth: authDuration });

  const form = await request.formData();
  const file = form.get("file");
  const documentType = form.get("document_type");
  if (!(file instanceof File) || (documentType !== "COMPANY_SALES_REPORT" && documentType !== "OUTSTANDING_REPORT")) return withTiming(jsonError("File and document type are required.", 400, "INVALID_REQUEST"), startedAt, { auth: authDuration });
  if (file.size > MAX_FILE_SIZE) return withTiming(jsonError("File tidak boleh lebih dari 5 MB.", 413, "FILE_TOO_LARGE"), startedAt, { auth: authDuration });
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) return withTiming(jsonError("Format file tidak didukung.", 422, "UNSUPPORTED_FORMAT"), startedAt, { auth: authDuration });

  let rows: unknown[][];
  let customerLookup: { map: Map<string, string>; count: number };
  let result: ReturnType<typeof validateRows>;
  const parseStarted = performance.now();
  try {
    rows = await parseRows(file, documentType);
    customerLookup = await getCustomerMap(supabase);
    result = validateRows(rows, documentType, customerLookup.map);
  } catch (error) {
    const parseError = parseFailure(error);
    return withTiming(jsonError(parseError.message, 422, parseError.code, [parseError]), startedAt, { auth: authDuration, parse: performance.now() - parseStarted });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `${userData.user.id}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { data: document, error: documentError } = await supabase.from("c1_document_uploads").insert({ file_name: file.name, document_type: documentType, storage_path: storagePath, mime_type: file.type || "application/octet-stream", file_size_bytes: file.size, checksum, uploader_user_id: userData.user.id, validation_status: "processing", processing_started_at: new Date().toISOString() }).select("id").single();
  if (documentError || !document) return withTiming(jsonError("Unable to create upload record.", 500, "DOCUMENT_CREATE_FAILED"), startedAt, { auth: authDuration, parse: performance.now() - parseStarted });

  const validationErrors = [...result.errors];
  if (customerLookup.count !== 51) {
    console.warn("[document-upload] customer master count differs from FT expectation", { expected: 51, actual: customerLookup.count });
  }
  if (!result.rows.length) validationErrors.push({ field: "file", code: "NO_VALID_ROWS", message: "Tidak ada baris valid dalam file." });
  if (validationErrors.length) {
    await supabase.from("c1_document_validation_errors").insert(validationErrors.map((validationError) => ({ document_id: document.id, row_number: validationError.row ?? null, field_name: validationError.field, error_code: validationError.code, error_message: validationError.message, raw_value: validationError.rawValue ?? null })));
    await supabase.from("c1_document_uploads").update({ validation_status: "rejected", processed_at: new Date().toISOString(), row_count: Math.max(0, rows.length - 1), valid_row_count: result.rows.length, invalid_row_count: Math.max(0, rows.length - 1 - result.rows.length), error_summary: "Validation failed." }).eq("id", document.id);
    return withTiming(jsonError("Validasi dokumen gagal.", 422, "VALIDATION_FAILED", validationErrors), startedAt, { auth: authDuration, parse: performance.now() - parseStarted, validation: 0 });
  }

  const upload = await supabase.storage.from("c1-document-uploads").upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upload.error) {
    await supabase.from("c1_document_uploads").update({ validation_status: "rejected", processed_at: new Date().toISOString(), error_summary: "Storage upload failed." }).eq("id", document.id);
    return jsonError("Unable to store uploaded file.", 500, "STORAGE_FAILED");
  }

  try {
    const table = documentType === "COMPANY_SALES_REPORT" ? "c1_company_sales_staging_rows" : "c1_outstanding_staging_rows";
    const { error: stagingError } = await supabase.from(table).insert(result.rows.map((row) => ({ ...row, document_id: document.id })));
    if (stagingError) throw stagingError;
    const { error: statusError } = await supabase.from("c1_document_uploads").update({ validation_status: "validated", processed_at: new Date().toISOString(), row_count: result.rows.length, valid_row_count: result.rows.length, invalid_row_count: 0 }).eq("id", document.id);
    if (statusError) throw statusError;
    const { error: aggregateError } = await supabase.rpc("refresh_c1_macro_metrics");
    if (aggregateError) throw aggregateError;
    return withTiming(NextResponse.json({ data: { documentId: document.id, documentType, validationStatus: "validated", rowCount: result.rows.length, validRowCount: result.rows.length, invalidRowCount: 0, errors: [] } }, { status: 201 }), startedAt, { auth: authDuration, parse: performance.now() - parseStarted, persistence: 0 });
  } catch (error) {
    await supabase.storage.from("c1-document-uploads").remove([storagePath]);
    await supabase.from("c1_company_sales_staging_rows").delete().eq("document_id", document.id);
    await supabase.from("c1_outstanding_staging_rows").delete().eq("document_id", document.id);
    const message = error instanceof Error ? error.message : "Processing failed.";
    await supabase.from("c1_document_uploads").update({ validation_status: "rejected", processed_at: new Date().toISOString(), error_summary: message }).eq("id", document.id);
    return jsonError("File gagal diproses. Data dashboard tidak diubah.", 500, "PROCESSING_FAILED");
  }
}
