import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { apiError, checkOrigin } from "@/lib/server/http";
export async function POST(request: NextRequest) {
  const originError = checkOrigin(request); if (originError) return originError;
  const client = createClient(await cookies());
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) return apiError("Logout gagal. Silakan coba lagi.", 500, "LOGOUT_FAILED");
  return NextResponse.json({ data: { success: true } }, { headers: { "Cache-Control": "no-store" } });
}
