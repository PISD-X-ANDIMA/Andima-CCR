import { NextRequest, NextResponse } from "next/server";
import { apiError, checkOrigin, requireSession } from "@/lib/server/http";
import { assignPicInSupabase, fetchAssignmentHistoryInSupabase } from "@/lib/supabaseOverdueApi";
import { getCcrProfile, canManage, canUseCcr } from "@/lib/server/authorization";
import { createAdminClient } from "@/lib/server/admin";

async function canReadAssignments(session: Awaited<ReturnType<typeof requireSession>>) {
  return canUseCcr(await getCcrProfile(session.client, session.user!.id));
}

export async function GET(_req: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  const session = await requireSession();
  if (session.error) return session.error;
  if (!(await canReadAssignments(session))) return apiError("You are not allowed to read assignment history.", 403, "FORBIDDEN");
  try {
    const { invoiceId } = await context.params;
    const profile = await getCcrProfile(session.client, session.user!.id);
    const history = await fetchAssignmentHistoryInSupabase(invoiceId);
    if (profile?.resolved_role === "STAFF" && !history.some((item) => item.assigned_to === profile.employee_id || item.assigned_to === profile.full_name)) {
      return apiError("Assignment not found in your scope.", 404, "NOT_FOUND");
    }
    return NextResponse.json({ data: history });
  } catch (error) {
    console.error("Failed to read assignment history", error);
    return apiError("Unable to read assignment history.", 500, "ASSIGNMENT_HISTORY_FAILED");
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  const session = await requireSession();
  if (session.error) return session.error;
  const originError = checkOrigin(req);
  if (originError) return originError;

  if (!(await canManage(await getCcrProfile(session.client, session.user!.id)))) {
    return apiError("You are not allowed to assign overdue invoices.", 403, "FORBIDDEN");
  }

  try {
    const body = await req.json() as { assignedTo?: string; notes?: string };
    const { invoiceId } = await context.params;
    if (!body.assignedTo?.trim()) return apiError("assignedTo is required.", 400, "INVALID_ASSIGNMENT");
    const admin = createAdminClient();
    const target = body.assignedTo.trim();
    const { data: staff } = await admin.from("b2_register")
      .select("employee_id, full_name")
      .eq("resolved_role", "STAFF")
      .eq("is_active", true)
      .in("registration_status", ["APPROVED", "PROVISIONED"])
      .or(`employee_id.eq.${target},full_name.ilike.${target}`)
      .maybeSingle();
    if (!staff) return apiError("PIC harus merupakan Staff CCR yang sudah diprovision.", 422, "INVALID_ASSIGNMENT_TARGET");
    const result = await assignPicInSupabase(invoiceId, staff.employee_id, session.user!.id, body.notes);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("Failed to assign overdue invoice", error);
    return apiError("Unable to assign overdue invoice.", 500, "ASSIGNMENT_FAILED");
  }
}
