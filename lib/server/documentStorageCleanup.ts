import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { describeSupabaseError } from "@/lib/supabaseOverdueApi";

export async function cleanupDocumentStorage(
  admin: SupabaseClient,
  auditId: string,
  bucket: string,
  path: string,
) {
  if (bucket && path) {
    const { error } = await admin.storage.from(bucket).remove([path]);
    if (error) {
      const message = describeSupabaseError(error).slice(0, 500);
      const { error: auditError } = await admin.from("c1_document_deletion_audit")
        .update({ storage_cleanup_status: "pending", storage_cleanup_error: message })
        .eq("audit_id", auditId);
      if (auditError) console.error("Failed to record pending document cleanup", { auditId, error: describeSupabaseError(auditError) });
      return { complete: false, error: message };
    }
  }

  const { error } = await admin.from("c1_document_deletion_audit")
    .update({ storage_cleanup_status: "complete", storage_cleanup_error: null })
    .eq("audit_id", auditId);
  if (error) {
    console.error("Failed to finalize document storage cleanup", { auditId, error: describeSupabaseError(error) });
    return { complete: false, error: "The document was deleted, but storage cleanup status could not be finalized." };
  }
  return { complete: true, error: null };
}
