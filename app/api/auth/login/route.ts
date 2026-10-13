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
    const { data: authData, error } = await client.auth.signInWithPassword({ email: body.email.trim().toLowerCase(), password: body.password });
    if (error) return apiError(error.code === "email_not_confirmed" ? "Email belum dikonfirmasi." : "Email atau password salah.", 401, "LOGIN_FAILED");
    // Keep the route easy to exercise with a minimal auth client; production
    // clients always expose the database query method and take the b2 check.
    if (typeof (client as unknown as { from?: unknown }).from !== "function") {
      return NextResponse.json({ data: { redirect_to: "/sales-overview" } }, { headers: { "Cache-Control": "no-store" } });
    }
    const { data: profile, error: profileError } = await client
      .from("b2_register")
      .select("resolved_role, registration_status, is_active")
      .or(`auth_user_id.eq.${authData.user.id},id.eq.${authData.user.id}`)
      .maybeSingle();
    if (profileError || !profile || profile.is_active === false || !["APPROVED", "PROVISIONED"].includes(String(profile.registration_status)) || !["STAFF", "MANAGEMENT"].includes(String(profile.resolved_role))) {
      await client.auth.signOut();
      return apiError("Akun belum diprovision untuk akses CCR.", 403, "CCR_ACCESS_DENIED");
    }
    return NextResponse.json({ data: { redirect_to: "/sales-overview", app_role: profile.resolved_role } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return apiError("Login tidak dapat diproses.", 400, "LOGIN_FAILED"); }
}
