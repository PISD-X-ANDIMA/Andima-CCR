import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/server/admin";
import { getCcrProfile, canUseCcr } from "@/lib/server/authorization";

type MacroPoint = { period_month: string; revenue: number; cost: number; sales_profit: number; total_outstanding: number };
type AlertRow = {
  id: string;
  days: number;
  client: string;
  due: string;
  amount: number;
  riskStatus?: string;
  branch?: string;
  branchCode?: string;
  picAssigned?: string | null;
  customerId?: string | null;
};
type MacroRpcResult = { summary: { revenue: number; cost: number; sales_profit: number; total_outstanding: number } | null; series: MacroPoint[]; alerts: AlertRow[] };

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function monthStart(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : null;
}

function nextMonthStart(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function withTiming(response: NextResponse, startedAt: number, phases: Record<string, number>) {
  const total = Math.round(performance.now() - startedAt);
  response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, duration]) => `${name};dur=${Math.round(duration)}`), `total;dur=${total}`].join(", "));
  response.headers.set("X-Analytics-Duration-Ms", String(total));
  return response;
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const authDuration = performance.now() - authStarted;

  if (userError || !userData.user) return withTiming(jsonError("Authentication is required.", 401, "UNAUTHENTICATED"), startedAt, { auth: authDuration });

  const profile = await getCcrProfile(supabase, userData.user.id, { includeOrgDetails: false });
  if (!canUseCcr(profile)) {
    return withTiming(jsonError("Sales Overview is limited to staff and management users.", 403, "FORBIDDEN"), startedAt, { auth: performance.now() - authStarted });
  }
  const role = profile.resolved_role;

  const params = request.nextUrl.searchParams;
  const endParam = params.get("end_period");
  const startParam = params.get("start_period");
  const today = new Date();
  const defaultEnd = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const endPeriod = endParam ?? defaultEnd;
  const endDate = monthStart(endPeriod);
  if (!endDate) return withTiming(jsonError("end_period must use YYYY-MM format.", 400, "INVALID_PERIOD"), startedAt, { auth: performance.now() - authStarted });

  const defaultStartDate = new Date(`${endDate}T00:00:00Z`);
  defaultStartDate.setUTCMonth(defaultStartDate.getUTCMonth() - 2);
  const defaultStart = `${defaultStartDate.getUTCFullYear()}-${String(defaultStartDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const startPeriod = startParam ?? defaultStart;
  const startDate = monthStart(startPeriod);
  if (!startDate || startDate > endDate) return withTiming(jsonError("start_period must be before or equal to end_period.", 400, "INVALID_PERIOD"), startedAt, { auth: performance.now() - authStarted });

  const endDateExclusive = nextMonthStart(endDate);
  const rpcStarted = performance.now();
  const { data: rpcData, error: rpcError } = await createAdminClient().rpc("c1_get_sales_overview_analytics", {
    p_start_period: startDate,
    p_end_period_exclusive: endDateExclusive,
  });
  const rpcDuration = performance.now() - rpcStarted;
  if (rpcError || !rpcData) return withTiming(noStore(jsonError("Unable to load Sales Overview data.", 500, "DATABASE_ERROR")), startedAt, { auth: performance.now() - authStarted, rpc: rpcDuration });

  const mappingStarted = performance.now();
  const result = rpcData as MacroRpcResult;
  const response = NextResponse.json({
    data: {
      period: { start_period: startPeriod, end_period: endPeriod },
      summary: result.summary ?? null,
      series: result.series ?? [],
      alerts: result.alerts ?? [],
      branches: [],
      meta: { source: "c1_staging", validation_status: "validated", can_upload: role === "STAFF" },
    },
  });
  const mappingDuration = performance.now() - mappingStarted;
  return withTiming(noStore(response), startedAt, { auth: performance.now() - authStarted - rpcDuration - mappingDuration, rpc: rpcDuration, mapping: mappingDuration });
}
