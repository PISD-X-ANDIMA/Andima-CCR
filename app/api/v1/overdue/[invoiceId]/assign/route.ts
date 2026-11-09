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

    // Enrich history with user full names and roles from b2_register
    const admin = createAdminClient();
    const assignedByUuids = [...new Set(history.map((h) => h.assigned_by).filter(Boolean))];
    const assignedToIds = [...new Set(history.map((h) => h.assigned_to).filter(Boolean))];

    const orClauses: string[] = [];
    if (assignedByUuids.length) {
      orClauses.push(`auth_user_id.in.(${assignedByUuids.join(",")})`);
      orClauses.push(`id.in.(${assignedByUuids.join(",")})`);
    }
    if (assignedToIds.length) {
      orClauses.push(`employee_id.in.(${assignedToIds.join(",")})`);
    }

    const profileMap = new Map<string, { full_name: string; resolved_role: string; employee_id: string }>();
    if (orClauses.length) {
      const { data: profiles } = await admin
        .from("b2_register")
        .select("auth_user_id, id, employee_id, full_name, resolved_role")
        .or(orClauses.join(","));

      for (const p of profiles ?? []) {
        if (p.auth_user_id) profileMap.set(p.auth_user_id, p);
        if (p.id) profileMap.set(p.id, p);
        if (p.employee_id) profileMap.set(p.employee_id, p);
      }
    }

    const enrichedHistory = history.map((item) => {
      const assignedByProf = profileMap.get(item.assigned_by);
      const assignedToProf = profileMap.get(item.assigned_to);
      return {
        ...item,
        assigned_by_name: assignedByProf?.full_name || (profile?.resolved_role === "MANAGEMENT" && profile.full_name ? profile.full_name : "Stevanus Imanuel"),
        assigned_by_role: assignedByProf?.resolved_role || "MANAGEMENT",
        assigned_to_name: assignedToProf?.full_name || item.assigned_to,
      };
    });

    return NextResponse.json({ data: enrichedHistory });
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
