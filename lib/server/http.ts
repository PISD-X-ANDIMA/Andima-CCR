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
  const client = createClient(await cookies());
  const { data, error } = await client.auth.getUser();
  return { client, user: data.user, error: error || !data.user ? apiError("Authentication is required.", 401, "UNAUTHENTICATED") : null };
}
