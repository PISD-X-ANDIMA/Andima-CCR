import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/server/http";
import { createAdminClient } from "@/lib/server/admin";
import { canUseCcr, getCcrProfile } from "@/lib/server/authorization";

function monthStart(value: string) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : null; }
function nextMonthStart(value: string) { const date = new Date(`${value}T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); return date.toISOString().slice(0, 10); }
function csv(value: unknown) { const text = value === null || value === undefined ? "" : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function timed(response: NextResponse, startedAt: number, phases: Record<string, number>) { const total = Math.round(performance.now() - startedAt); response.headers.set("Cache-Control", "no-store, max-age=0"); response.headers.set("Server-Timing", [...Object.entries(phases).map(([name, value]) => `${name};dur=${Math.round(value)}`), `total;dur=${total}`].join(", ")); return response; }

export async function GET(request: NextRequest) {
  const startedAt = performance.now();
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timed(session.error, startedAt, { auth: performance.now() - authStarted });
  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  const authDuration = performance.now() - authStarted;
  if (!canUseCcr(profile)) return timed(NextResponse.json({ error: { code: "FORBIDDEN", message: "CCR access is required." } }, { status: 403 }), startedAt, { auth: authDuration });
  const params = request.nextUrl.searchParams;
  const endPeriod = params.get("end_period") ?? new Date().toISOString().slice(0, 7);
  const endDate = monthStart(endPeriod);
  const startPeriod = params.get("start_period") ?? endPeriod;
  const startDate = monthStart(startPeriod);
  if (!startDate || !endDate || startDate > endDate) return timed(NextResponse.json({ error: { code: "INVALID_PERIOD", message: "start_period dan end_period harus menggunakan YYYY-MM yang valid." } }, { status: 400 }), startedAt, { auth: authDuration });

  const databaseStarted = performance.now();
  const { data, error } = await createAdminClient().rpc("c1_get_sales_overview_analytics", { p_start_period: startDate, p_end_period_exclusive: nextMonthStart(endDate) });
  const databaseDuration = performance.now() - databaseStarted;
  if (error || !data) return timed(NextResponse.json({ error: { code: "DATABASE_ERROR", message: "Unable to export Sales Overview data." } }, { status: 500 }), startedAt, { auth: authDuration, db: databaseDuration });
  const result = data as { summary: Record<string, unknown> | null; series: Array<Record<string, unknown>>; alerts: Array<Record<string, unknown>> };
  const lines = [
    ["section", "field", "value"],
    ...Object.entries(result.summary ?? {}).map(([key, value]) => ["summary", key, value]),
    ...result.series.flatMap((point) => Object.entries(point).map(([key, value]) => ["series", `${point.period_month}:${key}`, value])),
    ...result.alerts.flatMap((alert) => Object.entries(alert).map(([key, value]) => ["alert", `${alert.id}:${key}`, value])),
  ].map((row) => row.map(csv).join(",")).join("\r\n");
  const response = new NextResponse(`\ufeff${lines}\r\n`, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sales-overview-${startPeriod}-${endPeriod}.csv"` } });
  return timed(response, startedAt, { auth: authDuration, db: databaseDuration, mapping: 0 });
}
