import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/server/http";
import { createAdminClient } from "@/lib/server/admin";
import { canManage, canUseCcr, getCcrProfile } from "@/lib/server/authorization";
import { describeSupabaseError } from "@/lib/supabaseOverdueApi";

function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, duration]) => `${name};dur=${Math.round(duration)}`), `total;dur=${total}`].join(", "));
  return response;
}

export async function GET() {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: performance.now() - authStarted });

  try {
    const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
    const authDuration = performance.now() - authStarted;
    if (!canUseCcr(profile)) return timed(apiError("CCR access is required.", 403, "FORBIDDEN"), startedAt, { auth: authDuration });

    const databaseStarted = performance.now();
    const { data, error } = await createAdminClient()
      .from("b2_register")
      .select("employee_id, full_name")
      .eq("resolved_role", "STAFF")
      .eq("is_active", true)
      .in("registration_status", ["APPROVED", "PROVISIONED"])
      .order("full_name", { ascending: true });
    const databaseDuration = performance.now() - databaseStarted;
    if (error) throw error;

    return timed(NextResponse.json({ data: data ?? [], canAssign: canManage(profile) }), startedAt, { auth: authDuration, db: databaseDuration, mapping: 0 });
  } catch (error) {
    console.error("Failed to read active overdue staff", describeSupabaseError(error));
    return timed(apiError("Unable to read staff list.", 500, "STAFF_READ_FAILED"), startedAt, { auth: performance.now() - authStarted });
  }
}
