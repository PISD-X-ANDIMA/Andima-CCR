import { NextRequest, NextResponse } from "next/server";
import { apiError, checkOrigin, requireSession } from "@/lib/server/http";
import {
  assignPicInSupabase,
  calculateOverdueKpi,
  evaluateOverdueAlertsInSupabase,
  fetchOverdueAlertsFromSupabase,
  triggerBatchMidFeedEscalationInSupabase,
} from "@/lib/supabaseOverdueApi";
import { getCcrProfile, canManage, canUseCcr } from "@/lib/server/authorization";

function matches(value: string | null, expected: string) {
  return !value || value === "all" || value === expected;
}

async function canManageOverdue(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!session.user) return false;
  return canManage(await getCcrProfile(session.client, session.user.id));
}

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (session.error) return session.error;

  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";
    const agingBucket = searchParams.get("agingBucket");
    const onlyOverdue30 = searchParams.get("onlyOverdue30") !== "false";
    const profile = await getCcrProfile(session.client, session.user!.id);
    if (!canUseCcr(profile)) return apiError("CCR access is required.", 403, "FORBIDDEN");
    const { invoices: allInvoices, fromDb } = await fetchOverdueAlertsFromSupabase({ onlyOverdue30 }, session.client);
    const invoices = profile.resolved_role === "STAFF"
      ? allInvoices.filter((invoice) => invoice.pic_assigned === profile.employee_id || invoice.pic_assigned === profile.full_name)
      : allInvoices;

    const filtered = invoices.filter((invoice) => {
      const branchMatches = matches(branch, "Semua Cabang") || branch?.toLowerCase() === invoice.branch.toLowerCase();
      const searchMatches = !search || [invoice.invoice_number, invoice.customer_name, invoice.npwp]
        .some((value) => value.toLowerCase().includes(search));
      const statusMatches = matches(status, "semua status") || invoice.risk_status.toLowerCase() === status;
      const agingMatches = !agingBucket || agingBucket === "Semua Bucket" || agingBucket === "all"
        || (agingBucket === "1 - 30 Hari" && invoice.days_overdue >= 1 && invoice.days_overdue <= 30)
        || (agingBucket === "31 - 60 Hari" && invoice.days_overdue >= 31 && invoice.days_overdue <= 60)
        || (agingBucket === "> 60 Hari" && invoice.days_overdue > 60);
      return branchMatches && searchMatches && statusMatches && agingMatches;
    });

    return NextResponse.json({ kpiSummary: calculateOverdueKpi(filtered), totalItems: filtered.length, invoices: filtered, fromDb });
  } catch (error) {
    console.error("Failed to read overdue alerts", error);
    return apiError("Unable to read overdue alerts.", 500, "OVERDUE_READ_FAILED");
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (session.error) return session.error;
  const originError = checkOrigin(req);
  if (originError) return originError;

  try {
    const body = await req.json() as {
      action?: string;
      invoiceId?: string;
      assignedTo?: string;
      notes?: string;
      invoiceIds?: string[];
    };

    if (!(await canManageOverdue(session))) return apiError("You are not allowed to modify overdue workflow data.", 403, "FORBIDDEN");

    if (body.action === "EVALUATE") {
      if (!canManage(await getCcrProfile(session.client, session.user!.id))) return apiError("Only management users can evaluate overdue alerts.", 403, "FORBIDDEN");
      const result = await evaluateOverdueAlertsInSupabase(new Date(), session.client);
      return NextResponse.json({ success: true, ...result });
    }
    if (body.action === "ASSIGN_PIC" && body.invoiceId && body.assignedTo) {
      if (!canManage(await getCcrProfile(session.client, session.user!.id))) return apiError("Only management users can assign overdue work.", 403, "FORBIDDEN");
      const result = await assignPicInSupabase(body.invoiceId, body.assignedTo, session.user!.id, body.notes);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    if (body.action === "BATCH_MID_ESCALATION" && Array.isArray(body.invoiceIds)) {
      const result = await triggerBatchMidFeedEscalationInSupabase(body.invoiceIds, session.user!.id);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    return apiError("Invalid overdue action.", 400, "INVALID_ACTION");
  } catch (error) {
    console.error("Failed to process overdue action", error);
    return apiError("Unable to process overdue action.", 500, "OVERDUE_ACTION_FAILED");
  }
}
