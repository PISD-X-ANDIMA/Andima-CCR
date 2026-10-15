import { NextRequest, NextResponse } from "next/server";
import { apiError, checkOrigin, requireSession } from "@/lib/server/http";
import { describeSupabaseError, evaluateOverdueAlertsInSupabase } from "@/lib/supabaseOverdueApi";
import { getCcrProfile, canManage } from "@/lib/server/authorization";

function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, value]) => `${name};dur=${Math.round(value)}`), `total;dur=${total}`].join(", "));
  return response;
}

export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: performance.now() - authStarted });
  const originError = checkOrigin(req);
  if (originError) return originError;

  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  const authDuration = performance.now() - authStarted;
  if (!canManage(profile)) {
    return timed(apiError("You are not allowed to evaluate overdue alerts.", 403, "FORBIDDEN"), startedAt, { auth: authDuration });
  }

  try {
    const databaseStarted = performance.now();
    const result = await evaluateOverdueAlertsInSupabase();
    return timed(NextResponse.json({ success: true, ...result }), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  } catch (error) {
    console.error("Failed to evaluate overdue alerts", describeSupabaseError(error));
    return timed(apiError("Unable to evaluate overdue alerts.", 500, "OVERDUE_EVALUATION_FAILED"), startedAt, { auth: authDuration });
  }
}
