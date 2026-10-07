import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/server/admin";
import { apiError, checkOrigin } from "@/lib/server/http";
import { provisionRegistration, validateRegistration } from "@/lib/server/registration";
export async function POST(request: NextRequest) {
  const originError = checkOrigin(request); if (originError) return originError;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid request body.", 400, "INVALID_JSON"); }
  const data = validateRegistration(body);
  if (!data) return apiError("Registration data is invalid. Check position, department, and required fields.", 400, "INVALID_REGISTRATION");
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return apiError("Registration is unavailable.", 503, "REGISTRATION_UNAVAILABLE"); }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return apiError("Registration is unavailable.", 503, "REGISTRATION_UNAVAILABLE");
  let createdUserId: string | null = null;
  let profileCreated = false;
  try {
    // Check project settings before creating an account; never bypass email confirmation.
    const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: "no-store" });
    if (!settingsResponse.ok) return apiError("Registration is unavailable.", 503, "REGISTRATION_UNAVAILABLE");
    const settings = await settingsResponse.json();
    if (settings.disable_signup || settings.external?.email === false) return apiError("Registration is disabled.", 403, "REGISTRATION_DISABLED");
    const confirmationRequired = settings.mailer_autoconfirm !== true;
    const { data: authData, error } = await admin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: !confirmationRequired, user_metadata: { full_name: data.full_name, position_id: data.position_id } });
    if (error || !authData.user) return apiError("Registration failed. Email may already be registered.", 409, "REGISTRATION_CONFLICT");
    const userId = authData.user.id;
    createdUserId = userId;
    let profile: { employee_id: string; app_role: string };
    try { profile = await provisionRegistration(admin, userId, data); profileCreated = true; }
    catch {
      const cleanup = await admin.auth.admin.deleteUser(userId);
      if (cleanup.error) console.error("Registration auth cleanup failed", { userId, code: cleanup.error.code });
      return apiError("Registration could not be completed.", 500, "PROVISIONING_FAILED");
    }
    if (confirmationRequired) {
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error: emailError } = await client.auth.resend({ type: "signup", email: data.email, options: { emailRedirectTo: `${request.nextUrl.origin}/auth?next=/login` } });
      if (emailError) {
        // Profile was committed: roll back only rows belonging to this newly created user.
        const cleanup = await admin.rpc("rollback_app_registration", { p_user_id: userId });
        if (!cleanup.error) {
          const authCleanup = await admin.auth.admin.deleteUser(userId);
          if (authCleanup.error) console.error("Registration auth cleanup failed", { userId, code: authCleanup.error.code });
        } else console.error("Registration profile cleanup failed", { userId, code: cleanup.error.code });
        return apiError("Confirmation email could not be sent. Please try again.", 503, "CONFIRMATION_FAILED");
      }
    }
    return NextResponse.json({ data: { ...profile, confirmation_required: confirmationRequired } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    if (createdUserId) {
      try {
        const rollback = profileCreated ? await admin.rpc("rollback_app_registration", { p_user_id: createdUserId }) : { error: null };
        if (!rollback.error) {
          const cleanup = await admin.auth.admin.deleteUser(createdUserId);
          if (cleanup.error) console.error("Registration cleanup failed", { userId: createdUserId, code: cleanup.error.code });
        } else console.error("Registration profile cleanup failed", { userId: createdUserId, code: rollback.error.code });
      } catch { console.error("Registration cleanup unavailable", { userId: createdUserId }); }
    }
    return apiError("Registration is unavailable.", 503, "REGISTRATION_UNAVAILABLE");
  }
}
