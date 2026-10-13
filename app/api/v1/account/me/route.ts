import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/server/http";
import { getCcrProfile } from "@/lib/server/authorization";
export async function GET() {
  const { client, user, error } = await requireSession(); if (error) return error;
  if (!user) return apiError("Authentication is required.", 401, "UNAUTHENTICATED");
  const access = await getCcrProfile(client, user.id);
  if (!access) return apiError("CCR account profile is not provisioned.", 403, "CCR_ACCESS_DENIED");
  const metadataName = user.user_metadata?.full_name;
  const name = access.full_name?.trim() || (typeof metadataName === "string" && metadataName.trim()) || user.email?.split("@")[0] || "Andima User";
  return NextResponse.json({ data: { full_name: name, app_role: access.resolved_role, employee_id: access.employee_id, position: access.position_title, department: access.department_name, initials: name.split(/\s+/).map(p => p[0]).join("").slice(0,2).toUpperCase() } }, { headers: { "Cache-Control": "no-store" } });
}
