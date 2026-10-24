import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/http";
import { createAdminClient } from "@/lib/server/admin";
import { canUseCcr, getCcrProfile } from "@/lib/server/authorization";

function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, value]) => `${name};dur=${Math.round(value)}`), `total;dur=${total}`].join(", "));
  return response;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: performance.now() - authStarted });
  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  const authDuration = performance.now() - authStarted;
  if (!canUseCcr(profile)) return timed(NextResponse.json({ error: { code: "FORBIDDEN", message: "CCR access is required." } }, { status: 403 }), startedAt, { auth: authDuration });

  const { id } = await context.params;
  const databaseStarted = performance.now();
  const admin = createAdminClient();
  const { data: document, error: documentError } = await admin.from("c1_document_uploads").select("id, file_name, document_type, mime_type, file_size_bytes, storage_bucket, storage_path, uploaded_at, processed_at, validation_status, row_count, valid_row_count, invalid_row_count, error_summary").eq("id", id).maybeSingle();
  if (documentError) return timed(NextResponse.json({ error: { code: "DATABASE_ERROR", message: "Unable to load document preview." } }, { status: 500 }), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  if (!document) return timed(NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 }), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });

  const isSales = document.document_type === "COMPANY_SALES_REPORT";
  const [errorsResult, rowsResult] = await Promise.all([
    admin.from("c1_document_validation_errors").select("row_number, field_name, error_code, error_message, raw_value, severity").eq("document_id", id).order("row_number", { ascending: true }),
    admin.from(isSales ? "c1_company_sales_staging_rows" : "c1_outstanding_staging_rows").select("*").eq("document_id", id).order("row_number", { ascending: true }).limit(1000),
  ]);
  const customerIds = [...new Set((rowsResult.data ?? []).map((row: { c1_customer_id?: string | null }) => row.c1_customer_id).filter((value): value is string => Boolean(value)))];
  const customersResult = customerIds.length
    ? await admin.from("c1_customer").select("customer_id, customer_code, customer_name, branch, source_type, source_document_id").in("customer_id", customerIds)
    : { data: [], error: null };
  const signed = document.validation_status === "rejected"
    ? { data: null, error: null }
    : await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
  const databaseDuration = performance.now() - databaseStarted;
  if (errorsResult.error || rowsResult.error || customersResult.error) return timed(NextResponse.json({ error: { code: "DATABASE_ERROR", message: "Unable to load document preview data." } }, { status: 500 }), startedAt, { auth: authDuration, db: databaseDuration });
  if (signed.error) return timed(NextResponse.json({ error: { code: "STORAGE_ERROR", message: "Unable to create document preview URL." } }, { status: 500 }), startedAt, { auth: authDuration, db: databaseDuration });

  return timed(NextResponse.json({ data: { document, errors: errorsResult.data ?? [], rows: rowsResult.data ?? [], customers: customersResult.data ?? [], signedUrl: signed.data?.signedUrl ?? null } }), startedAt, { auth: authDuration, db: databaseDuration });
}
