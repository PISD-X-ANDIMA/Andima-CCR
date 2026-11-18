import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, requireSession } from "@/lib/server/http";
import { createAdminClient } from "@/lib/server/admin";
import { canUpload, getCcrProfile } from "@/lib/server/authorization";
import { cleanupDocumentStorage } from "@/lib/server/documentStorageCleanup";

type PendingCleanup = {
  audit_id: string;
  document_id: string;
  file_name: string;
  document_type: string;
  deleted_at: string;
  storage_bucket: string;
  storage_path: string;
};

function response(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

async function authorize() {
  const session = await requireSession();
  if (session.error) return { error: session.error, admin: null as ReturnType<typeof createAdminClient> | null };
  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  if (!canUpload(profile)) return { error: response(403, { error: { code: "FORBIDDEN", message: "Only Staff users can retry document cleanup." } }), admin: null };
  return { error: null, admin: createAdminClient() };
}

export async function GET() {
  const access = await authorize();
  if (access.error) return access.error;
  const { data, error } = await access.admin!
    .from("c1_document_deletion_audit")
    .select("audit_id, document_id, file_name, document_type, deleted_at")
    .eq("storage_cleanup_status", "pending")
    .order("deleted_at", { ascending: false })
    .limit(25);
  if (error) return response(500, { error: { code: "CLEANUP_LIST_FAILED", message: "Unable to load pending cleanup tasks." } });
  return response(200, { data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const access = await authorize();
  if (access.error) return access.error;
  let auditId = "";
  try {
    const body = await request.json() as { auditId?: unknown };
    auditId = typeof body.auditId === "string" ? body.auditId : "";
  } catch {
    return response(400, { error: { code: "INVALID_REQUEST", message: "A cleanup task id is required." } });
  }
  if (!auditId) return response(400, { error: { code: "INVALID_REQUEST", message: "A cleanup task id is required." } });

  const { data, error } = await access.admin!
    .from("c1_document_deletion_audit")
    .select("audit_id, document_id, file_name, document_type, deleted_at, storage_bucket, storage_path")
    .eq("audit_id", auditId)
    .eq("storage_cleanup_status", "pending")
    .maybeSingle();
  if (error) return response(500, { error: { code: "CLEANUP_LOOKUP_FAILED", message: "Unable to load cleanup task." } });
  if (!data) return response(404, { error: { code: "CLEANUP_NOT_FOUND", message: "Pending cleanup task not found." } });

  const pending = data as PendingCleanup;
  const result = await cleanupDocumentStorage(access.admin!, pending.audit_id, pending.storage_bucket, pending.storage_path);
  return response(200, { data: { auditId, status: result.complete ? "complete" : "pending", error: result.error } });
}
