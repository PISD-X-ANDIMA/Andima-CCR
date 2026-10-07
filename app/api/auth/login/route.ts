import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { apiError, checkOrigin } from "@/lib/server/http";
export async function POST(request: NextRequest) {
  const originError = checkOrigin(request); if (originError) return originError;
  try {
    const body = await request.json();
    if (typeof body.email !== "string" || typeof body.password !== "string" || !body.email.trim() || !body.password) return apiError("Email and password are required.", 400, "INVALID_LOGIN");
    const client = createClient(await cookies());
    const { error } = await client.auth.signInWithPassword({ email: body.email.trim().toLowerCase(), password: body.password });
    if (error) return apiError(error.code === "email_not_confirmed" ? "Email belum dikonfirmasi." : "Email atau password salah.", 401, "LOGIN_FAILED");
    return NextResponse.json({ data: { redirect_to: "/sales-overview" } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return apiError("Login tidak dapat diproses.", 400, "LOGIN_FAILED"); }
}
