import { NextRequest, NextResponse } from "next/server";
import { apiError, checkOrigin, requireSession } from "@/lib/server/http";
import {
  assignPicInSupabase,
  calculateOverdueKpi,
  describeSupabaseError,
  evaluateOverdueAlertsInSupabase,
  fetchOverdueAlertsFromSupabase,
  triggerBatchMidFeedEscalationInSupabase,
} from "@/lib/supabaseOverdueApi";
import { getCcrProfile, canManage, canUseCcr } from "@/lib/server/authorization";
import { createAdminClient } from "@/lib/server/admin";

function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, value]) => `${name};dur=${Math.round(value)}`), `total;dur=${total}`].join(", "));
  return response;
}

function matches(value: string | null, expected: string) {
  return !value || value === "all" || value === expected;
}

async function canManageOverdue(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!session.user) return false;
  return canManage(await getCcrProfile(session.client, session.user.id));
}

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: performance.now() - authStarted });

  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
    const status = searchParams.get("status")?.trim().toLowerCase() ?? "";
    const agingBucket = searchParams.get("agingBucket");
    const onlyOverdue30 = searchParams.get("onlyOverdue30") !== "false";
    const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
    const authDuration = performance.now() - authStarted;
    if (!canUseCcr(profile)) return timed(apiError("CCR access is required.", 403, "FORBIDDEN"), startedAt, { auth: authDuration });
    const databaseStarted = performance.now();
    const { invoices: allInvoices, fromDb } = await fetchOverdueAlertsFromSupabase({ onlyOverdue30 }, createAdminClient());
    const databaseDuration = performance.now() - databaseStarted;
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

    return timed(NextResponse.json({ kpiSummary: calculateOverdueKpi(filtered), totalItems: filtered.length, invoices: filtered, fromDb }), startedAt, { auth: authDuration, db: databaseDuration, mapping: 0 });
  } catch (error) {
    console.error("Failed to read overdue alerts", describeSupabaseError(error));
    return timed(apiError("Unable to read overdue alerts.", 500, "OVERDUE_READ_FAILED"), startedAt, { auth: performance.now() - authStarted });
  }
}

export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: 0 });
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
      // Evaluation writes the C1 projection and must use the server-only
      // client. Authorization has already been completed above.
      const result = await evaluateOverdueAlertsInSupabase();
      return timed(NextResponse.json({ success: true, ...result }), startedAt, { db: 0 });
    }
    if (body.action === "ASSIGN_PIC" && body.invoiceId && body.assignedTo) {
      if (!canManage(await getCcrProfile(session.client, session.user!.id))) return apiError("Only management users can assign overdue work.", 403, "FORBIDDEN");
      const result = await assignPicInSupabase(body.invoiceId, body.assignedTo, session.user!.id, body.notes);
      return timed(NextResponse.json(result, { status: result.success ? 200 : 400 }), startedAt, { db: 0 });
    }
    if (body.action === "BATCH_MID_ESCALATION" && Array.isArray(body.invoiceIds)) {
      const result = await triggerBatchMidFeedEscalationInSupabase(body.invoiceIds, session.user!.id);
      return timed(NextResponse.json(result, { status: result.success ? 200 : 400 }), startedAt, { db: 0 });
    }
    return timed(apiError("Invalid overdue action.", 400, "INVALID_ACTION"), startedAt, { db: 0 });
  } catch (error) {
    console.error("Failed to process overdue action", describeSupabaseError(error));
    return timed(apiError("Unable to process overdue action.", 500, "OVERDUE_ACTION_FAILED"), startedAt, { db: 0 });
  }
}
