import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/http";
import { createAdminClient } from "@/lib/server/admin";
import { canUseCcr, getCcrProfile } from "@/lib/server/authorization";

function response(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (session.error) return session.error;
  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  if (!canUseCcr(profile)) return response(403, "FORBIDDEN", "CCR access is required.");

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: document, error } = await admin.from("c1_document_uploads")
    .select("storage_bucket, storage_path, validation_status, error_summary")
    .eq("id", id)
    .maybeSingle();
  if (error) return response(500, "DATABASE_ERROR", "Unable to load the original document.");
  if (!document) return response(404, "NOT_FOUND", "Document not found.");
  if (document.validation_status === "rejected") {
    const reason = document.error_summary ? ` Failure reason: ${document.error_summary}` : "";
    return response(409, "ORIGINAL_FILE_UNAVAILABLE", `The original file was not saved because this document was rejected.${reason}`);
  }

  const { data, error: storageError } = await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 300);
  if (storageError || !data?.signedUrl) {
    const storageMessage = String(storageError?.message ?? "").toLowerCase();
    const missingObject = storageError?.statusCode === "404" || storageMessage.includes("not found") || storageMessage.includes("nosuchkey");
    if (missingObject) return response(404, "ORIGINAL_FILE_NOT_FOUND", "The original file is not available in storage.");
    return response(500, "STORAGE_ERROR", "Unable to open the original document right now. Please try again later.");
  }
  const redirect = NextResponse.redirect(data.signedUrl, 302);
  redirect.headers.set("Cache-Control", "no-store, max-age=0");
  return redirect;
}
