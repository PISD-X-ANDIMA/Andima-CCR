import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/server/http";
export async function GET() {
  const { client, user, error } = await requireSession(); if (error) return error;
  if (!user) return apiError("Authentication is required.", 401, "UNAUTHENTICATED");
  const result = await client.from("d3_user_access").select("app_role, d3_employee!d3_user_access_employee_id_fkey(full_name)").eq("auth_user_id", user.id).maybeSingle();
  if (result.error) return apiError("Unable to load account.", 500, "ACCOUNT_LOOKUP_FAILED");
  const access = result.data as unknown as { app_role: string; d3_employee: { full_name: string } | null } | null;
  const metadataName = user.user_metadata?.full_name;
  const name = access?.d3_employee?.full_name?.trim() || (typeof metadataName === "string" && metadataName.trim()) || user.email?.split("@")[0] || "Andima User";
  return NextResponse.json({ data: { full_name: name, app_role: access?.app_role ?? null, initials: name.split(/\s+/).map(p => p[0]).join("").slice(0,2).toUpperCase() } }, { headers: { "Cache-Control": "no-store" } });
}
