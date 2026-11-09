import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/http";
import { createAdminClient } from "@/lib/server/admin";
import { canUpload, canUseCcr, getCcrProfile } from "@/lib/server/authorization";

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

  const params = request.nextUrl.searchParams;
  const pageValue = Number.parseInt(params.get("page") ?? "1", 10);
  const pageSizeValue = Number.parseInt(params.get("limit") ?? (params.get("view") === "overview" ? "5" : "10"), 10);
  const page = Number.isFinite(pageValue) ? Math.max(1, pageValue) : 1;
  const pageSize = Number.isFinite(pageSizeValue) ? Math.min(50, Math.max(1, pageSizeValue)) : 10;
  const rawType = params.get("document_type")?.trim().toLowerCase() ?? "all";
  const documentType = rawType === "sales" ? "COMPANY_SALES_REPORT" : rawType === "outstanding" ? "OUTSTANDING_REPORT" : rawType === "all" ? null : undefined;
  if (documentType === undefined) return timed(NextResponse.json({ error: { code: "INVALID_DOCUMENT_TYPE", message: "Invalid document type filter." } }, { status: 400 }), startedAt, { auth: authDuration });
  const fileType = params.get("file_type")?.trim().toLowerCase() ?? "all";
  if (!["all", "xlsx", "xls", "pdf"].includes(fileType)) return timed(NextResponse.json({ error: { code: "INVALID_FILE_TYPE", message: "Invalid file type filter." } }, { status: 400 }), startedAt, { auth: authDuration });
  const search = params.get("search")?.trim().slice(0, 100) ?? "";
  const databaseStarted = performance.now();
  const { data: result, error } = await createAdminClient().rpc("c1_list_managed_documents", {
    p_search: search || null,
    p_document_type: documentType,
    p_file_type: fileType,
    p_page: page,
    p_page_size: pageSize,
  });
  const databaseDuration = performance.now() - databaseStarted;
  if (error) {
    const missingManagementRpc = error.code === "PGRST202" || error.code === "42883" || String(error.message ?? "").includes("c1_list_managed_documents");
    if (missingManagementRpc) {
      return timed(NextResponse.json({ error: { code: "DOCUMENT_MANAGEMENT_NOT_READY", message: "Document management database setup is missing. Apply the latest Supabase migration, then refresh this page." } }, { status: 503 }), startedAt, { auth: authDuration, db: databaseDuration });
    }
    console.error("Managed document listing failed", { code: error.code, message: error.message });
    return timed(NextResponse.json({ error: { code: "DATABASE_ERROR", message: "Unable to load documents. Please retry or contact support." } }, { status: 500 }), startedAt, { auth: authDuration, db: databaseDuration });
  }
  const payload = result as { data?: unknown[]; pagination?: unknown; summary?: unknown } | null;
  return timed(NextResponse.json({
    data: payload?.data ?? [],
    pagination: payload?.pagination ?? { page, page_size: pageSize, total_items: 0, total_pages: 1 },
    summary: payload?.summary ?? { total: 0, validated: 0, rejected: 0 },
    permissions: { can_manage_documents: canUpload(profile) },
  }), startedAt, { auth: authDuration, db: databaseDuration });
}
