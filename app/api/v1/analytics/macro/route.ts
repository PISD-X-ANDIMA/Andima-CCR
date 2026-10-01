import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

type MacroRow = {
  period_month: string;
  revenue: number | string;
  cost: number | string;
  total_outstanding: number | string;
};

type OutstandingRow = {
  id: string;
  invoice_number: string;
  customer_name: string;
  outstanding_amount: number | string;
  due_date: string;
};

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function monthStart(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : null;
}

function formatMonth(value: string) {
  return value.slice(0, 7);
}

function nextMonthStart(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) return jsonError("Authentication is required.", 401, "UNAUTHENTICATED");

  const { data: access, error: accessError } = await supabase
    .from("d3_user_access")
    .select("app_role")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (accessError) return jsonError("Unable to verify account access.", 403, "ACCESS_CHECK_FAILED");
  const role = String(access?.app_role ?? "").toUpperCase();
  if (!["HR", "MANAGER"].includes(role)) {
    return jsonError("Sales Overview is limited to management and admin users.", 403, "FORBIDDEN");
  }

  const params = request.nextUrl.searchParams;
  const endParam = params.get("end_period");
  const startParam = params.get("start_period");
  const today = new Date();
  const defaultEnd = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const endPeriod = endParam ?? defaultEnd;
  const endDate = monthStart(endPeriod);
  if (!endDate) return jsonError("end_period must use YYYY-MM format.", 400, "INVALID_PERIOD");

  const defaultStartDate = new Date(`${endDate}T00:00:00Z`);
  defaultStartDate.setUTCMonth(defaultStartDate.getUTCMonth() - 2);
  const defaultStart = `${defaultStartDate.getUTCFullYear()}-${String(defaultStartDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const startPeriod = startParam ?? defaultStart;
  const startDate = monthStart(startPeriod);
  if (!startDate || startDate > endDate) return jsonError("start_period must be before or equal to end_period.", 400, "INVALID_PERIOD");

  const { data, error } = await supabase
    .from("c1_macro_metric")
    .select("period_month, revenue, cost, total_outstanding")
    .eq("validation_status", "validated")
    .gte("period_month", startDate)
    .lte("period_month", endDate)
    .order("period_month", { ascending: true });

  if (error) return jsonError("Unable to load Sales Overview data.", 500, "DATABASE_ERROR");

  const rows = (data ?? []) as MacroRow[];
  const series = rows.map((row) => {
    const revenue = Number(row.revenue);
    const cost = Number(row.cost);
    return {
      period_month: formatMonth(row.period_month),
      revenue,
      cost,
      sales_profit: revenue - cost,
      total_outstanding: Number(row.total_outstanding),
    };
  });
  const active = series.at(-1) ?? null;

  const { data: outstandingRows, error: outstandingError } = await supabase
    .from("c1_outstanding_staging_rows")
    .select("id, invoice_number, customer_name, outstanding_amount, due_date, document_id")
    .gte("due_date", startDate)
    .lt("due_date", nextMonthStart(endDate))
    .order("due_date", { ascending: true });

  if (outstandingError) return jsonError("Unable to load Sales Overview outstanding data.", 500, "DATABASE_ERROR");

  const documentIds = [...new Set((outstandingRows ?? []).map((row) => row.document_id).filter(Boolean))];
  let validatedDocumentIds = new Set<string>();
  if (documentIds.length) {
    const { data: documents, error: documentsError } = await supabase
      .from("c1_document_uploads")
      .select("id")
      .in("id", documentIds)
      .eq("validation_status", "validated");
    if (documentsError) return jsonError("Unable to verify outstanding data.", 500, "DATABASE_ERROR");
    validatedDocumentIds = new Set((documents ?? []).map((document) => document.id));
  }

  const todayForAlerts = new Date();
  const alerts = (outstandingRows as (OutstandingRow & { document_id: string })[] ?? [])
    .filter((row) => validatedDocumentIds.has(row.document_id) && new Date(`${row.due_date}T00:00:00Z`) < todayForAlerts)
    .map((row) => ({
      id: row.invoice_number,
      days: Math.max(1, Math.floor((todayForAlerts.getTime() - new Date(`${row.due_date}T00:00:00Z`).getTime()) / 86400000)),
      client: row.customer_name,
      due: row.due_date,
      amount: Number(row.outstanding_amount),
    }));

  return NextResponse.json({
    data: {
      period: { start_period: startPeriod, end_period: endPeriod },
      summary: active
        ? { revenue: active.revenue, cost: active.cost, sales_profit: active.sales_profit, total_outstanding: active.total_outstanding }
        : null,
      series,
      alerts,
      branches: [],
      meta: { source: "c1_macro_metric", validation_status: "validated", can_upload: role === "HR" },
    },
  });
}
