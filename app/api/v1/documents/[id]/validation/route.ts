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
  if (!canUseCcr(profile)) {
    return timed(NextResponse.json({ error: { code: "FORBIDDEN", message: "CCR access is required." } }, { status: 403 }), startedAt, { auth: authDuration });
  }

  const { id } = await context.params;
  const databaseStarted = performance.now();
  const admin = createAdminClient();
  const { data: document, error } = await admin.from("c1_document_uploads").select("*").eq("id", id).maybeSingle();
  if (error) return timed(NextResponse.json({ error: { code: "DATABASE_ERROR", message: "Unable to load validation result." } }, { status: 500 }), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  if (!document) return timed(NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 }), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });

  const { data: errors, error: errorsError } = await admin
    .from("c1_document_validation_errors")
    .select("row_number, field_name, error_code, error_message")
    .eq("document_id", id)
    .order("row_number", { ascending: true });
  const databaseDuration = performance.now() - databaseStarted;
  if (errorsError) return timed(NextResponse.json({ error: { code: "DATABASE_ERROR", message: "Unable to load validation errors." } }, { status: 500 }), startedAt, { auth: authDuration, db: databaseDuration });
  return timed(NextResponse.json({ data: { ...document, errors: errors ?? [] } }), startedAt, { auth: authDuration, db: databaseDuration });
}
