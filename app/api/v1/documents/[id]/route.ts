import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, requireSession } from "@/lib/server/http";
import { createAdminClient } from "@/lib/server/admin";
import { canUpload, getCcrProfile } from "@/lib/server/authorization";
import { cleanupDocumentStorage } from "@/lib/server/documentStorageCleanup";

function response(status: number, body: unknown) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const session = await requireSession();
  if (session.error) return session.error;
  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  if (!canUpload(profile)) return response(403, { error: { code: "FORBIDDEN", message: "Only Staff users can delete uploaded documents." } });

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("c1_delete_uploaded_document", {
    p_document_id: id,
    p_deleted_by: session.user!.id,
  });
  if (error) {
    const details = error && typeof error === "object"
      ? error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
      : { message: String(error) };
    const message = typeof details.message === "string" ? details.message : "";
    if (message.includes("DOCUMENT_NOT_FOUND")) return response(404, { error: { code: "DOCUMENT_NOT_FOUND", message: "Document not found." } });
    if (message.includes("DOCUMENT_PROCESSING")) return response(409, { error: { code: "DOCUMENT_PROCESSING", message: "A document cannot be deleted while it is processing." } });
    if (message.includes("DOCUMENT_STATUS_NOT_DELETABLE")) return response(409, { error: { code: "DOCUMENT_STATUS_NOT_DELETABLE", message: "This document status cannot be deleted." } });
    console.error("Document database deletion failed", {
      documentId: id,
      code: details.code ?? null,
      message: details.message ?? null,
      details: details.details ?? null,
      hint: details.hint ?? null,
    });
    return response(500, { error: { code: "DOCUMENT_DELETE_FAILED", message: "Unable to delete document data." } });
  }

  const deleted = data as { audit_id: string; document_id: string; file_name: string; storage_bucket: string; storage_path: string };
  const cleanup = await cleanupDocumentStorage(admin, deleted.audit_id, deleted.storage_bucket, deleted.storage_path);
  return response(200, {
    data: {
      documentId: deleted.document_id,
      fileName: deleted.file_name,
      storageCleanup: cleanup.complete ? "complete" : "pending",
    },
  });
}
