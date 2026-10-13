import { NextRequest, NextResponse } from "next/server";
import { apiError, checkOrigin, requireSession } from "@/lib/server/http";
import { triggerBatchMidFeedEscalationInSupabase } from "@/lib/supabaseOverdueApi";
import { getCcrProfile, canManage } from "@/lib/server/authorization";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session.error) return session.error;
  const originError = checkOrigin(req);
  if (originError) return originError;

  if (!canManage(await getCcrProfile(session.client, session.user!.id))) {
    return apiError("You are not allowed to publish the MID feed.", 403, "FORBIDDEN");
  }

  try {
    const body = await req.json() as { invoiceIds?: string[] };
    if (!Array.isArray(body.invoiceIds)) return apiError("invoiceIds must be an array.", 400, "INVALID_FEED_REQUEST");
    const result = await triggerBatchMidFeedEscalationInSupabase(body.invoiceIds, session.user!.id);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("Failed to publish MID overdue feed", error);
    return apiError("Unable to publish MID overdue feed.", 500, "MID_FEED_FAILED");
  }
}
