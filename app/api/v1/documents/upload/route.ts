import { checkOrigin } from "@/lib/server/http";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/server/admin";
import { describeSupabaseError, evaluateOverdueAlertsInSupabase } from "@/lib/supabaseOverdueApi";
import { getCcrProfile, canUpload } from "@/lib/server/authorization";
import { normalize, validateRows } from "@/lib/documentUploadValidation";
import { parseDocumentRows, parseFailureMessage } from "@/lib/server/documentUploadParser";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["xlsx", "xls", "pdf"]);
type ValidationError = import("@/lib/documentUploadValidation").ValidationError;
type PersistedUploadRow = Record<string, unknown> & {
  customer_id?: string | null;
  customer_name?: string;
  customer_code?: string | null;
  c1_customer_id?: string | null;
  create_date?: string | null;
  job_number?: string | null;
  mawb?: string | null;
};

function jsonError(message: string, status: number, code: string, errors: ValidationError[] = [], extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, errors, ...extra } }, { status });
}

function withTiming(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, duration]) => `${name};dur=${Math.round(duration)}`), `total;dur=${total}`].join(", "));
  response.headers.set("X-Upload-Duration-Ms", String(total));
  return response;
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
  let customerMap = new Map<string, string>();
  let result: ReturnType<typeof validateRows>;
  const parseStarted = performance.now();
  try {
    rows = await parseDocumentRows(file, documentType);
    try { customerMap = await getCustomerMap(supabase); }
    catch (error) { console.warn("[document-upload] A1 customer lookup unavailable; proceeding with C1 resolution", error); }
    result = validateRows(rows, documentType, customerMap);
  } catch (error) {
    const parseCode = error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "PARSING_FAILED";
    const parseError: ValidationError = { field: "file", code: parseCode, message: parseFailureMessage(parseCode) };
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
    return withTiming(jsonError("Validasi dokumen gagal.", 422, "VALIDATION_FAILED", validationErrors, { documentId: document.id }), startedAt, { auth: authDuration, parse: performance.now() - parseStarted, validation: 0 });
  }

  const upload = await persistenceClient.storage.from("c1-document-uploads").upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upload.error) {
    await persistenceClient.from("c1_document_uploads").update({ validation_status: "rejected", processed_at: new Date().toISOString(), error_summary: "Storage upload failed." }).eq("id", document.id);
    return withTiming(jsonError("Unable to store uploaded file.", 500, "STORAGE_FAILED"), startedAt, { auth: authDuration, parse: performance.now() - parseStarted, storage: 0 });
  }

  try {
    const table = documentType === "COMPANY_SALES_REPORT" ? "c1_company_sales_staging_rows" : "c1_outstanding_staging_rows";
    const sourceRows = result.rows as PersistedUploadRow[];
    const { data: resolvedCustomers, error: resolveError } = await persistenceClient.rpc("c1_resolve_uploaded_customers", {
      p_document_id: document.id,
      p_customers: sourceRows.map((row) => ({ customer_name: row.customer_name, customer_code: row.customer_code ?? null })),
    });
    if (resolveError) throw resolveError;
    const resolvedItems = (resolvedCustomers?.items ?? []) as Array<{ requested_customer_name: string; requested_customer_code: string | null; customer_name: string; customer_code: string | null; c1_customer_id: string }>;
    const customerByCode = new Map<string, (typeof resolvedItems)[number]>();
    const customerByName = new Map<string, (typeof resolvedItems)[number]>();
    for (const customer of resolvedItems) {
      if (customer.requested_customer_code) customerByCode.set(normalize(customer.requested_customer_code), customer);
      customerByName.set(normalize(customer.requested_customer_name), customer);
    }
    const stagingRows = sourceRows.map((row) => {
      const { customer_code: sourceCustomerCode, ...persistedRow } = row;
      const resolvedCustomer = (sourceCustomerCode ? customerByCode.get(normalize(sourceCustomerCode)) : null)
        ?? customerByName.get(normalize(row.customer_name ?? ""));
      if (!resolvedCustomer?.c1_customer_id) throw new Error(`Unable to resolve C1 customer for row ${row.row_number ?? "?"}.`);
      return {
        ...persistedRow,
        customer_name: resolvedCustomer.customer_name,
        document_id: document.id,
        customer_id: row.customer_id ?? null,
        c1_customer_id: resolvedCustomer.c1_customer_id,
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
    await persistenceClient.rpc("c1_cleanup_unreferenced_upload_customers", { p_document_id: document.id });
    const message = describeSupabaseError(error);
    console.error("[document-upload] processing failed", { documentId: document.id, message });
    await persistenceClient.from("c1_document_uploads").update({ validation_status: "rejected", processed_at: new Date().toISOString(), error_summary: message.slice(0, 500) }).eq("id", document.id);
    return withTiming(jsonError("File gagal diproses. Data dashboard tidak diubah.", 500, "PROCESSING_FAILED", [{ field: "file", code: "PROCESSING_FAILED", message }]), startedAt, { auth: authDuration, parse: performance.now() - parseStarted, persistence: 0 });
  }
}
