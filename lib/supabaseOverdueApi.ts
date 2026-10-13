import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/server/admin";
import type { OverdueInvoiceItem, OverdueKpiSummary, RiskStatus } from "@/types/overdue";

export const getSupabaseClient = createAdminClient;

export type OverdueQueryOptions = {
  startDate?: string;
  endDateExclusive?: string;
  onlyOverdue30?: boolean;
};

type StagingOutstanding = {
  document_id: string;
  created_at: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  outstanding_amount: number | string;
  due_date: string;
};

type AlertRow = {
  invoice_id: string;
  customer_id: string | null;
  due_date: string;
  evaluation_date: string;
  days_overdue: number;
  overdue_alert: boolean;
  alert_status: string;
};

type AssignmentRow = {
  invoice_id: string;
  assigned_to: string;
  assigned_at: string;
  follow_up_status: string;
};

const MS_PER_DAY = 86_400_000;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Calendar-day difference, independent of the server's local timezone. */
export function calculateDaysOverdue(dueDate: string, currentDate = new Date()) {
  const due = Date.parse(`${dueDate}T00:00:00.000Z`);
  const current = Date.parse(`${dateOnly(currentDate)}T00:00:00.000Z`);
  if (!Number.isFinite(due) || !Number.isFinite(current)) return 0;
  return Math.max(0, Math.floor((current - due) / MS_PER_DAY));
}

export function overdueRiskStatus(daysOverdue: number): RiskStatus {
  if (daysOverdue > 60) return "LEGAL ESCALATION";
  if (daysOverdue > 30) return "HIGH RISK";
  return "WATCHLIST";
}

function inDateRange(value: string, options: OverdueQueryOptions) {
  return (!options.startDate || value >= options.startDate)
    && (!options.endDateExclusive || value < options.endDateExclusive);
}

export function calculateOverdueKpi(invoices: OverdueInvoiceItem[]): OverdueKpiSummary {
  const total = invoices.reduce((sum, invoice) => sum + invoice.amount_overdue, 0);
  const critical = invoices.filter((invoice) => invoice.days_overdue > 60);
  const unassigned = invoices.filter((invoice) => !invoice.pic_assigned);
  const averageDays = invoices.length
    ? invoices.reduce((sum, invoice) => sum + invoice.days_overdue, 0) / invoices.length
    : 0;

  return {
    totalOverdueValue: total,
    totalOverdueValueGrowth: 0,
    affectedInvoicesCount: invoices.length,
    criticalAgingValue: critical.reduce((sum, invoice) => sum + invoice.amount_overdue, 0),
    criticalAgingPercent: total ? (critical.reduce((sum, invoice) => sum + invoice.amount_overdue, 0) / total) * 100 : 0,
    criticalDebtorsCount: critical.length,
    avgDsoDelay: Math.round(averageDays * 100) / 100,
    slaDiff: Math.max(0, Math.round((averageDays - 30) * 100) / 100),
    targetRecoveryDays: critical.length ? 5 : 0,
    unassignedPicCount: unassigned.length,
    unassignedFloatingValue: unassigned.reduce((sum, invoice) => sum + invoice.amount_overdue, 0),
  };
}

async function readValidatedOutstanding(client: SupabaseClient) {
  const { data: stagingRows, error: stagingError } = await client
    .from("c1_outstanding_staging_rows")
    .select("document_id, invoice_number, customer_id, customer_name, outstanding_amount, due_date, created_at")
    .gt("outstanding_amount", 0)
    .order("due_date", { ascending: true });
  if (stagingError) throw stagingError;

  const rows = (stagingRows ?? []) as StagingOutstanding[];
  const documentIds = [...new Set(rows.map((row) => row.document_id).filter(Boolean))];
  if (!documentIds.length) return [];

  const { data: documents, error: documentError } = await client
    .from("c1_document_uploads")
    .select("id")
    .in("id", documentIds)
    .eq("validation_status", "validated");
  if (documentError) throw documentError;

  const validIds = new Set((documents ?? []).map((document) => document.id));
  const latestByInvoice = new Map<string, StagingOutstanding>();
  for (const row of rows) {
    if (!validIds.has(row.document_id)) continue;
    const key = row.invoice_number.trim().toLowerCase();
    const previous = latestByInvoice.get(key);
    if (!previous || row.created_at > previous.created_at) latestByInvoice.set(key, row);
  }
  return [...latestByInvoice.values()];
}

export async function evaluateOverdueAlertsInSupabase(currentDate = new Date(), client?: SupabaseClient) {
  const supabase = client ?? getSupabaseClient();
  const rows = await readValidatedOutstanding(supabase);
  const evaluationDate = dateOnly(currentDate);
  const records = rows.map((row) => {
    const daysOverdue = calculateDaysOverdue(row.due_date, currentDate);
    return {
      invoice_id: row.invoice_number,
      customer_id: row.customer_id,
      due_date: row.due_date,
      evaluation_date: evaluationDate,
      days_overdue: daysOverdue,
      overdue_alert: daysOverdue > 30,
      alert_status: overdueRiskStatus(daysOverdue),
    };
  });

  if (records.length) {
    const { error } = await supabase.from("c1_overdue_alert").upsert(records, { onConflict: "invoice_id" });
    if (error) throw error;
  }

  return { evaluated: records.length, overdue: records.filter((record) => record.overdue_alert).length, evaluationDate };
}

function toInvoice(row: AlertRow, staging: StagingOutstanding | undefined, assignment: AssignmentRow | undefined): OverdueInvoiceItem {
  const days = row.days_overdue;
  const assignedTo = assignment?.assigned_to;
  return {
    id: row.invoice_id,
    invoice_number: row.invoice_id,
    customer_id: row.customer_id ?? staging?.customer_id ?? "",
    customer_name: staging?.customer_name ?? "Pelanggan tidak tersedia",
    npwp: "-",
    branch: "Tidak tersedia",
    branch_code: "",
    due_date: row.due_date,
    amount_overdue: Number(staging?.outstanding_amount ?? 0),
    payment_note: undefined,
    days_overdue: days,
    risk_status: (row.alert_status || overdueRiskStatus(days)) as RiskStatus,
    pic_assigned: assignedTo,
    pic_initials: assignedTo ? assignedTo.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : undefined,
    action_type: days > 60 ? "SP-2" : days > 30 ? "SP-1" : "TUGASKAN",
    contact_person: { name: "-", role: "-", phone: "-" },
    last_log: { date: "-", time: "-", text: "Belum ada log penagihan.", logged_by: "-" },
    route: "",
  };
}

export async function fetchOverdueAlertsFromSupabase(options: OverdueQueryOptions = {}, client?: SupabaseClient) {
  const supabase = client ?? getSupabaseClient();
  const [{ data: alerts, error: alertsError }, { data: assignments, error: assignmentsError }, stagingRows] = await Promise.all([
    supabase.from("c1_overdue_alert").select("invoice_id, customer_id, due_date, evaluation_date, days_overdue, overdue_alert, alert_status"),
    supabase.from("c1_assignment").select("invoice_id, assigned_to, assigned_at, follow_up_status").order("assigned_at", { ascending: false }),
    readValidatedOutstanding(supabase),
  ]);
  if (alertsError) throw alertsError;
  if (assignmentsError) throw assignmentsError;

  const stagingByInvoice = new Map(stagingRows.map((row) => [row.invoice_number.toLowerCase(), row]));
  const latestAssignments = new Map<string, AssignmentRow>();
  for (const assignment of (assignments ?? []) as AssignmentRow[]) {
    if (!latestAssignments.has(assignment.invoice_id)) latestAssignments.set(assignment.invoice_id, assignment);
  }

  const invoices = ((alerts ?? []) as AlertRow[])
    .filter((alert) => alert.days_overdue > 0 && inDateRange(alert.due_date, options))
    .filter((alert) => options.onlyOverdue30 !== false ? alert.days_overdue > 30 : true)
    .map((alert) => toInvoice(alert, stagingByInvoice.get(alert.invoice_id.toLowerCase()), latestAssignments.get(alert.invoice_id)))
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.invoice_number.localeCompare(b.invoice_number));

  return { invoices, kpi: calculateOverdueKpi(invoices), fromDb: true };
}

export async function assignPicInSupabase(invoiceId: string, assignedTo: string, assignedBy: string, notes?: string) {
  const cleanInvoiceId = invoiceId.trim();
  const cleanAssignedTo = assignedTo.trim();
  if (!cleanInvoiceId || !cleanAssignedTo) return { success: false, error: "Invoice dan PIC wajib diisi." };

  const supabase = getSupabaseClient();
  const { data: alert, error: alertError } = await supabase
    .from("c1_overdue_alert")
    .select("invoice_id, overdue_alert")
    .eq("invoice_id", cleanInvoiceId)
    .maybeSingle();
  if (alertError) throw alertError;
  if (!alert) return { success: false, error: "Invoice overdue tidak ditemukan." };
  if (!alert.overdue_alert) return { success: false, error: "Invoice belum melewati batas overdue 30 hari." };

  const { data, error } = await supabase.from("c1_assignment").insert({
    invoice_id: cleanInvoiceId,
    assigned_to: cleanAssignedTo,
    assigned_by: assignedBy,
    follow_up_status: "ASSIGNED",
    notes: notes?.trim() || null,
  }).select("assignment_id, invoice_id, assigned_to, assigned_by, assigned_at, follow_up_status, notes").single();
  if (error) throw error;
  return { success: true, record: data };
}

export async function fetchAssignmentHistoryInSupabase(invoiceId: string) {
  const { data, error } = await getSupabaseClient()
    .from("c1_assignment")
    .select("assignment_id, invoice_id, assigned_to, assigned_by, assigned_at, follow_up_status, notes")
    .eq("invoice_id", invoiceId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function triggerBatchMidFeedEscalationInSupabase(invoiceIds: string[], exportedBy: string) {
  const ids = [...new Set(invoiceIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return { success: false, count: 0, error: "Pilih minimal satu invoice." };

  const { invoices } = await fetchOverdueAlertsFromSupabase({ onlyOverdue30: true });
  const selected = invoices.filter((invoice) => ids.includes(invoice.id));
  if (!selected.length) return { success: false, count: 0, error: "Tidak ada invoice overdue yang valid." };

  const exportedAt = new Date();
  const feedDate = dateOnly(exportedAt);
  const records = selected.map((invoice) => ({
    feed_key: `${invoice.id}:${feedDate}`,
    invoice_id: invoice.id,
    customer_id: invoice.customer_id || null,
    days_overdue: invoice.days_overdue,
    alert_status: "MID_ESCALATED",
    assignment_summary: { assigned_to: invoice.pic_assigned ?? null, exported_by: exportedBy, exported_at: exportedAt.toISOString() },
    exported_at: exportedAt.toISOString(),
  }));

  const { data, error } = await getSupabaseClient().from("c1_mid_feed").upsert(records, { onConflict: "feed_key" }).select("feed_id");
  if (error) throw error;
  return { success: true, count: data?.length ?? 0 };
}

export async function requestExportFileInSupabase(
  format: "PDF" | "XLSX" | "CSV",
  requestedBy: string,
  periodFilter: Record<string, unknown>,
) {
  const supabase = getSupabaseClient();
  const { data: request, error: requestError } = await supabase.from("c1_export_request").insert({
    requested_by: requestedBy,
    format,
    period_filter: periodFilter,
    status: "PROCESSING",
  }).select("request_id").single();
  if (requestError || !request) throw requestError ?? new Error("Export request was not created.");

  const storageReference = `exports/OVERDUE_ALERT_REPORT_${Date.now()}.${format.toLowerCase()}`;
  const { data: file, error: fileError } = await supabase.from("c1_export_file").insert({
    request_id: request.request_id,
    storage_reference: storageReference,
    download_status: "AVAILABLE",
  }).select("file_id, storage_reference").single();
  if (fileError) throw fileError;

  return {
    success: true,
    requestId: request.request_id,
    fileId: file?.file_id,
    storageRef: file?.storage_reference ?? storageReference,
  };
}
