import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/http";
import { canUseCcr, getCcrProfile } from "@/lib/server/authorization";
import { fetchCustomerCodeDetailFromSupabase } from "@/lib/supabaseApi";

function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, duration]) => `${name};dur=${Math.round(duration)}`), `total;dur=${total}`].join(", "));
  return response;
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, context: { params: Promise<{ customerId: string; code: string }> }) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: performance.now() - authStarted });

  let profile;
  try {
    profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  } catch (error) {
    console.error("Customer code authorization failed:", error);
    return timed(errorResponse("AUTHORIZATION_UNAVAILABLE", "Customer analytics authorization is unavailable.", 503), startedAt, { auth: performance.now() - authStarted });
  }
  const authDuration = performance.now() - authStarted;
  if (!canUseCcr(profile)) return timed(errorResponse("FORBIDDEN", "CCR access is required.", 403), startedAt, { auth: authDuration });

  const databaseStarted = performance.now();
  try {
    const { customerId, code: rawCode } = await context.params;
    let code: string;
    try {
      code = decodeURIComponent(rawCode).trim();
    } catch {
      return timed(errorResponse("INVALID_CODE", "Customer code tidak valid.", 400), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
    }
    if (!customerId.trim() || !code) return timed(errorResponse("INVALID_CODE", "Customer ID and customer code are required.", 400), startedAt, { auth: authDuration });
    const detail = await fetchCustomerCodeDetailFromSupabase(customerId, code);
    if (!detail) return timed(errorResponse("CUSTOMER_CODE_NOT_FOUND", "Kode customer tidak ditemukan pada company ini.", 404), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
    return timed(NextResponse.json({ data: detail }, { status: 200 }), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  } catch (error) {
    console.error("Customer code detail query failed:", error);
    return timed(errorResponse("DATABASE_ERROR", "Unable to process customer code detail request.", 500), startedAt, { auth: authDuration, db: performance.now() - databaseStarted });
  }
}
