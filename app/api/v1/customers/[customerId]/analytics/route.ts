import { requireSession } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { fetchCustomerAnalyticsItemFromSupabase } from "@/lib/supabaseApi";
import { canUseCcr, getCcrProfile } from "@/lib/server/authorization";

function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, duration]) => `${name};dur=${Math.round(duration)}`), `total;dur=${total}`].join(", "));
  return response;
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, context: { params: Promise<{ customerId: string }> }) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: performance.now() - authStarted });

  let profile;
  try {
    profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  } catch (error) {
    console.error("Customer analytics detail authorization failed:", error);
    return timed(errorResponse("AUTHORIZATION_UNAVAILABLE", "Customer analytics authorization is unavailable.", 503), startedAt, { auth: performance.now() - authStarted });
  }
  const authDuration = performance.now() - authStarted;
  if (!canUseCcr(profile)) return timed(errorResponse("FORBIDDEN", "CCR access is required.", 403), startedAt, { auth: authDuration });

  const databaseStarted = performance.now();
  try {
    const { customerId } = await context.params;
    if (!customerId.trim()) return timed(errorResponse("INVALID_CUSTOMER", "Customer ID is required.", 400), startedAt, { auth: authDuration });
    const customer = await fetchCustomerAnalyticsItemFromSupabase(customerId);
    if (!customer) return timed(errorResponse("CUSTOMER_NOT_FOUND", "Company tidak ditemukan.", 404), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
    return timed(NextResponse.json({ data: customer }, { status: 200 }), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  } catch (error) {
    console.error("Customer analytics detail query failed:", error);
    return timed(errorResponse("DATABASE_ERROR", "Unable to process customer analytics detail request.", 500), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  }
}
