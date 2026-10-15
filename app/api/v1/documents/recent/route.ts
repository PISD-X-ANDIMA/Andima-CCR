import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/http";
import { createAdminClient } from "@/lib/server/admin";
import { canUseCcr, getCcrProfile } from "@/lib/server/authorization";

function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, value]) => `${name};dur=${Math.round(value)}`), `total;dur=${total}`].join(", "));
  return response;
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: performance.now() - authStarted });
  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  const authDuration = performance.now() - authStarted;
  if (!canUseCcr(profile)) return timed(NextResponse.json({ error: { code: "FORBIDDEN", message: "CCR access is required." } }, { status: 403 }), startedAt, { auth: authDuration });

  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 10;
  const databaseStarted = performance.now();
  const { data, error } = await createAdminClient()
    .from("c1_document_uploads")
    .select("id, file_name, document_type, mime_type, file_size_bytes, storage_bucket, uploaded_at, processed_at, validation_status, row_count, valid_row_count, invalid_row_count, error_summary")
    .order("uploaded_at", { ascending: false })
    .limit(limit);
  const databaseDuration = performance.now() - databaseStarted;
  if (error) return timed(NextResponse.json({ error: { code: "DATABASE_ERROR", message: "Unable to load recent documents." } }, { status: 500 }), startedAt, { auth: authDuration, db: databaseDuration });
  return timed(NextResponse.json({ data: data ?? [] }), startedAt, { auth: authDuration, db: databaseDuration });
}
