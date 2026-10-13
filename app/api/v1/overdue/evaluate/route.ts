import { NextRequest, NextResponse } from "next/server";
import { apiError, checkOrigin, requireSession } from "@/lib/server/http";
import { evaluateOverdueAlertsInSupabase } from "@/lib/supabaseOverdueApi";
import { getCcrProfile, canManage } from "@/lib/server/authorization";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session.error) return session.error;
  const originError = checkOrigin(req);
  if (originError) return originError;

  if (!canManage(await getCcrProfile(session.client, session.user!.id))) {
    return apiError("You are not allowed to evaluate overdue alerts.", 403, "FORBIDDEN");
  }

  try {
    return NextResponse.json({ success: true, ...(await evaluateOverdueAlertsInSupabase(new Date(), session.client)) });
  } catch (error) {
    console.error("Failed to evaluate overdue alerts", error);
    return apiError("Unable to evaluate overdue alerts.", 500, "OVERDUE_EVALUATION_FAILED");
  }
}
