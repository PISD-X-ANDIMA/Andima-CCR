import { type EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

function safePath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/login";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safePath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) redirect(next);
  }

  redirect("/login?auth=confirmation_failed");
}
