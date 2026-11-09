import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
export function apiError(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}
export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin && origin !== request.nextUrl.origin ? apiError("Invalid request origin.", 403, "INVALID_ORIGIN") : null;
}
export async function requireSession() {
  try {
    const client = createClient(await cookies());
    const { data, error } = await client.auth.getUser();
    return { client, user: data.user, error: error || !data.user ? apiError("Authentication is required.", 401, "UNAUTHENTICATED") : null };
  } catch (error) {
    console.error("Supabase session configuration is unavailable", error instanceof Error ? error.message : error);
    return {
      client: null as never,
      user: null,
      error: apiError("Authentication service is not configured.", 503, "AUTH_CONFIGURATION_MISSING"),
    };
  }
}
