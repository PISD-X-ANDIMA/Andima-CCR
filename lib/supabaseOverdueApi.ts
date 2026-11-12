import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/server/admin";
import type { OverdueInvoiceItem, OverdueKpiSummary, RiskStatus } from "@/types/overdue";

export const getSupabaseClient = createAdminClient;

export function describeSupabaseError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const message = typeof value.message === "string" ? value.message : "Database operation failed.";
    const code = value.code ? ` [${String(value.code)}]` : "";
    const details = value.details ? ` ${String(value.details)}` : "";
    const hint = value.hint ? ` Hint: ${String(value.hint)}` : "";
    return `${message}${code}${details}${hint}`;
  }
  return String(error ?? "Database operation failed.");
}

function chunkArray<T>(items: T[], size = 50): T[][] {
  if (!items || !items.length) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export type OverdueQueryOptions = {
  startDate?: string;
  endDateExclusive?: string;
  onlyOverdue30?: boolean;
};

type StagingOutstanding = {
  created_at: string;
  invoice_number: string;
  customer_id: string | null;
  c1_customer_id: string | null;
  customer_name: string;
  outstanding_amount: number | string;
  due_date: string;
  job_number?: string | null;
  mawb?: string | null;
};

type AlertRow = {
  invoice_id: string;
  customer_id: string | null;
  c1_customer_id: string | null;
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

type CustomerIdentity = {
  customer_id: string;
  customer_name: string | null;
  branch: string | null;
  npwp: string | null;
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

export function normalizeRiskStatus(status?: string | null, daysOverdue = 0): RiskStatus {
  const s = String(status ?? "").trim().toUpperCase();
  if (s === "LEGAL ESCALATION" || s === "HIGH RISK" || s === "CRITICAL") return "High Risk";
  if (s === "MEDIUM RISK") return "Medium Risk";
  if (s === "WATCHLIST") return "Watchlist";
  if (s === "NEGOTIATION" || s === "NEGOSIASI") return "Negotiation";
  return overdueRiskStatus(daysOverdue);
}

export function overdueRiskStatus(daysOverdue: number): RiskStatus {
  if (daysOverdue > 60) return "High Risk";
  if (daysOverdue > 30) return "Medium Risk";
  return "Watchlist";
}

export function calculateOverdueKpi(invoices: OverdueInvoiceItem[]): OverdueKpiSummary {
  const total = invoices.reduce((sum, invoice) => sum + invoice.amount_overdue, 0);
  const critical = invoices.filter((invoice) => invoice.days_overdue > 60);
  const unassigned = invoices.filter((invoice) => !invoice.pic_assigned);
  const averageDays = invoices.length
    ? invoices.reduce((sum, invoice) => sum + invoice.days_overdue, 0) / invoices.length
    : 0;
  const customerTotals = new Map<string, { name: string; outstanding: number; invoiceCount: number }>();
  let oldestInvoice: OverdueInvoiceItem | null = null;

  for (const invoice of invoices) {
    if (!oldestInvoice || invoice.days_overdue > oldestInvoice.days_overdue) {
      oldestInvoice = invoice;
    }
    const customerId = invoice.customer_id?.trim().toLowerCase();
    const customerName = invoice.customer_name?.trim() || "Pelanggan tidak tersedia";
    const key = customerId ? `id:${customerId}` : `name:${customerName.toLowerCase()}`;
    const current = customerTotals.get(key);
    if (current) {
      current.outstanding += invoice.amount_overdue;
      current.invoiceCount += 1;
    } else {
      customerTotals.set(key, { name: customerName, outstanding: invoice.amount_overdue, invoiceCount: 1 });
    }
  }
  const topContributingCustomer = [...customerTotals.values()]
    .sort((left, right) => right.outstanding - left.outstanding || right.invoiceCount - left.invoiceCount || left.name.localeCompare(right.name))[0] ?? null;
  const highRiskOutstanding = invoices
    .filter((invoice) => invoice.risk_status === "High Risk" || invoice.risk_status === "HIGH RISK")
    .reduce((sum, invoice) => sum + invoice.amount_overdue, 0);

  return {
    totalOverdueInvoices: invoices.length,
    totalOverdueAmount: total,
    oldestInvoiceDays: oldestInvoice ? oldestInvoice.days_overdue : 0,
    oldestInvoiceNumber: oldestInvoice ? oldestInvoice.invoice_number : null,
    oldestInvoiceCustomer: oldestInvoice ? oldestInvoice.customer_name : null,
    activeCasesCount: customerTotals.size,
    totalActiveCustomers: customerTotals.size,
    highRiskOutstanding,
    topContributingCustomer,
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
    .select("invoice_number, customer_id, c1_customer_id, customer_name, outstanding_amount, due_date, created_at, job_number, mawb, c1_document_uploads!inner(validation_status)")
    .eq("c1_document_uploads.validation_status", "validated")
    .gt("outstanding_amount", 0)
    .order("due_date", { ascending: true });
  if (stagingError) throw stagingError;

  const rows = (stagingRows ?? []) as StagingOutstanding[];
  // Build lookup index of valid customer names prioritizing job_number -> mawb -> invoice_number
  const validByJob = new Map<string, { customer_name: string; customer_id: string | null; c1_customer_id: string | null }>();
  const validByMawb = new Map<string, { customer_name: string; customer_id: string | null; c1_customer_id: string | null }>();
  for (const row of rows) {
    const hasValidCustomer = Boolean(row.customer_name && row.customer_name.trim().toLowerCase() !== "tidak ditemukan");
    if (!hasValidCustomer) continue;
    const jobKey = row.job_number?.trim().toLowerCase();
    const mawbKey = row.mawb?.trim().toLowerCase();
    if (jobKey && jobKey !== "-") validByJob.set(jobKey, { customer_name: row.customer_name, customer_id: row.customer_id, c1_customer_id: row.c1_customer_id });
    if (mawbKey && mawbKey !== "-") validByMawb.set(mawbKey, { customer_name: row.customer_name, customer_id: row.customer_id, c1_customer_id: row.c1_customer_id });
  }

  const latestByInvoice = new Map<string, StagingOutstanding>();
  for (const rawRow of rows) {
    // Fill customer identity using hierarchy: Job Number -> MAWB Number -> existing
    let row = rawRow;
    const hasValidCustomer = Boolean(row.customer_name && row.customer_name.trim().toLowerCase() !== "tidak ditemukan");
    if (!hasValidCustomer) {
      const jobKey = row.job_number?.trim().toLowerCase();
      const mawbKey = row.mawb?.trim().toLowerCase();
      const match = (jobKey && validByJob.get(jobKey)) || (mawbKey && validByMawb.get(mawbKey));
      if (match) {
        row = {
          ...row,
          customer_name: match.customer_name,
          customer_id: row.customer_id ?? match.customer_id,
          c1_customer_id: row.c1_customer_id ?? match.c1_customer_id,
        };
      }
    }

    const key = row.invoice_number.trim().toLowerCase();
    const previous = latestByInvoice.get(key);
    const rowHasValid = Boolean(row.customer_name && row.customer_name.trim().toLowerCase() !== "tidak ditemukan");
    const prevHasValid = Boolean(previous?.customer_name && previous.customer_name.trim().toLowerCase() !== "tidak ditemukan");

    if (!previous) {
      latestByInvoice.set(key, row);
    } else if (rowHasValid && !prevHasValid) {
      latestByInvoice.set(key, row);
    } else if (!rowHasValid && prevHasValid) {
      latestByInvoice.set(key, {
        ...row,
        customer_name: previous.customer_name,
        customer_id: row.customer_id ?? previous.customer_id,
        c1_customer_id: row.c1_customer_id ?? previous.c1_customer_id,
      });
    } else if (row.created_at > previous.created_at) {
      latestByInvoice.set(key, row);
    }
  }
  return [...latestByInvoice.values()];
}

export async function evaluateOverdueAlertsInSupabase(currentDate = new Date(), client?: SupabaseClient) {
  const supabase = client ?? getSupabaseClient();
  const evaluationDate = dateOnly(currentDate);
  const { data, error } = await supabase.rpc("c1_refresh_overdue_alerts", { p_evaluation_date: evaluationDate });
  if (error) throw error;
  const result = data as { evaluated?: number; overdue?: number; deleted?: number; evaluationDate?: string } | null;
  return {
    evaluated: Number(result?.evaluated ?? 0),
    overdue: Number(result?.overdue ?? 0),
    deleted: Number(result?.deleted ?? 0),
    evaluationDate: result?.evaluationDate ?? evaluationDate,
  };
}

function toInvoice(
  row: AlertRow,
  staging: StagingOutstanding | undefined,
  assignment: AssignmentRow | undefined,
  customers: Map<string, CustomerIdentity>,
  companyContacts?: {
    byJob: Map<string, any>;
    byName: Map<string, any>;
    byCode: Map<string, any>;
  },
): OverdueInvoiceItem {
  const days = row.days_overdue;
  const assignedTo = assignment?.assigned_to;
  const customerId = row.c1_customer_id ?? staging?.c1_customer_id ?? row.customer_id ?? staging?.customer_id ?? null;
  const c1CustomerId = row.c1_customer_id ?? staging?.c1_customer_id ?? null;
  const customer = c1CustomerId ? customers.get(c1CustomerId) : undefined;
  const customerName = customer?.customer_name?.trim()
    || (staging?.customer_name && staging.customer_name.trim().toLowerCase() !== "tidak ditemukan" ? staging.customer_name.trim() : null)
    || "Customer unavailable";

  let matchedCompany = staging?.job_number ? companyContacts?.byJob.get(staging.job_number.trim().toLowerCase()) : undefined;
  if (!matchedCompany && customerName) {
    matchedCompany = companyContacts?.byName.get(customerName.trim().toLowerCase());
  }
  if (!matchedCompany && staging?.customer_name) {
    matchedCompany = companyContacts?.byName.get(staging.customer_name.trim().toLowerCase());
  }

  const contactName = matchedCompany?.name?.trim() || "Contact not available";
  const contactPhone = matchedCompany?.pic_phone_number?.trim() || "Contact not available";

  return {
    id: row.invoice_id,
    invoice_number: row.invoice_id,
    customer_id: customerId ?? "",
    customer_name: customerName,
    npwp: customer?.npwp || "-",
    branch: customer?.branch?.trim() || "Tidak tersedia",
    branch_code: "",
    due_date: row.due_date,
    amount_overdue: Number(staging?.outstanding_amount ?? 0),
    payment_note: undefined,
    days_overdue: days,
    risk_status: normalizeRiskStatus(row.alert_status, days),
    pic_assigned: assignedTo,
    pic_initials: assignedTo ? assignedTo.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : undefined,
    action_type: days > 90 ? "SP-3" : days >= 60 ? "SP-2" : days >= 30 ? "SP-1" : "ASSIGN",
    contact_person: {
      name: contactName,
      role: matchedCompany ? "Customer PIC" : "Contact not available",
      phone: contactPhone,
    },
    last_log: { date: "-", time: "-", text: "No collection log yet.", logged_by: "-" },
    route: "",
  };
}

export async function fetchOverdueAlertsFromSupabase(options: OverdueQueryOptions = {}, client?: SupabaseClient) {
  const supabase = client ?? getSupabaseClient();
  let alertsQuery = supabase
    .from("c1_overdue_alert")
    .select("invoice_id, customer_id, c1_customer_id, due_date, evaluation_date, days_overdue, overdue_alert, alert_status")
    .gt("days_overdue", 0)
    .order("due_date", { ascending: true });
  if (options.onlyOverdue30 !== false) alertsQuery = alertsQuery.gt("days_overdue", 30);
  if (options.startDate) alertsQuery = alertsQuery.gte("due_date", options.startDate);
  if (options.endDateExclusive) alertsQuery = alertsQuery.lt("due_date", options.endDateExclusive);

  const assignmentsQuery = supabase
    .from("c1_assignment")
    .select("invoice_id, assigned_to, assigned_at, follow_up_status")
    .order("assigned_at", { ascending: false });

  const [
    { data: alerts, error: alertsError },
    { data: assignments, error: assignmentsError },
    stagingRows,
    companyListResult,
  ] = await Promise.all([
    alertsQuery,
    assignmentsQuery,
    readValidatedOutstanding(supabase),
    supabase.from("a1_company_list").select("company_name, name, pic_phone_number, customer_code, job_number"),
  ]);
  if (alertsError) throw alertsError;
  if (assignmentsError) throw assignmentsError;

  const companyRows = (companyListResult?.data ?? []) as any[];
  const companyByJob = new Map<string, any>();
  const companyByName = new Map<string, any>();
  const companyByCode = new Map<string, any>();
  for (const c of companyRows) {
    if (c.job_number) companyByJob.set(String(c.job_number).trim().toLowerCase(), c);
    if (c.company_name) companyByName.set(String(c.company_name).trim().toLowerCase(), c);
    if (c.customer_code) companyByCode.set(String(c.customer_code).trim().toLowerCase(), c);
  }
  const companyContacts = { byJob: companyByJob, byName: companyByName, byCode: companyByCode };

  const stagingByInvoice = new Map(stagingRows.map((row) => [row.invoice_number.trim().toLowerCase(), row]));
  const latestAssignments = new Map<string, AssignmentRow>();
  for (const assignment of (assignments ?? []) as AssignmentRow[]) {
    if (!latestAssignments.has(assignment.invoice_id)) latestAssignments.set(assignment.invoice_id, assignment);
  }

  const alertsList = (alerts ?? []) as AlertRow[];
  const customerIds = [...new Set(alertsList.flatMap((alert) => {
    const staging = stagingByInvoice.get(alert.invoice_id.trim().toLowerCase());
    return [alert.c1_customer_id, staging?.c1_customer_id].filter((id): id is string => Boolean(id));
  }))];
  const customers = new Map<string, CustomerIdentity>();
  if (customerIds.length) {
    const customerChunks = chunkArray(customerIds, 50);
    const results = await Promise.all(
      customerChunks.map((chunk) =>
        supabase
          .from("c1_customer")
          .select("customer_id, customer_name, branch, npwp")
          .in("customer_id", chunk)
      )
    );
    const customersError = results.find((r) => r.error)?.error;
    if (customersError) throw customersError;
    for (const r of results) {
      for (const customer of (r.data ?? []) as CustomerIdentity[]) {
        customers.set(customer.customer_id, customer);
      }
    }
  }

  const invoices = alertsList
    .filter((alert) => {
      const assignment = latestAssignments.get(alert.invoice_id);
      if (assignment?.follow_up_status === "COMPLETED") return false;
      return true;
    })
    .map((alert) =>
      toInvoice(
        alert,
        stagingByInvoice.get(alert.invoice_id.trim().toLowerCase()),
        latestAssignments.get(alert.invoice_id),
        customers,
        companyContacts,
      ),
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.invoice_number.localeCompare(b.invoice_number));

  return { invoices, kpi: calculateOverdueKpi(invoices), fromDb: true };
}

export async function assignPicInSupabase(invoiceId: string, assignedTo: string, assignedBy: string, notes?: string) {
  const cleanInvoiceId = invoiceId.trim();
  const cleanAssignedTo = assignedTo.trim();
  if (!cleanInvoiceId || !cleanAssignedTo) return { success: false, error: "Invoice and PIC are required." };

  const supabase = getSupabaseClient();
  const { data: alert, error: alertError } = await supabase
    .from("c1_overdue_alert")
    .select("invoice_id, overdue_alert")
    .eq("invoice_id", cleanInvoiceId)
    .maybeSingle();
  if (alertError) throw alertError;
  if (!alert) return { success: false, error: "Overdue invoice not found." };
  if (!alert.overdue_alert) return { success: false, error: "Invoice has not exceeded 30-day overdue threshold." };

  // Check if already assigned to this staff recently (within 60s) with ASSIGNED status to prevent double-click duplicates
  const { data: existingAssignment } = await supabase
    .from("c1_assignment")
    .select("assignment_id, invoice_id, assigned_to, assigned_by, assigned_at, follow_up_status, notes, follow_up_action, promise_date, attachment_url, updated_by, created_at, payment_amount")
    .eq("invoice_id", cleanInvoiceId)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    existingAssignment &&
    existingAssignment.assigned_to === cleanAssignedTo &&
    existingAssignment.follow_up_status === "ASSIGNED" &&
    Date.now() - new Date(existingAssignment.assigned_at).getTime() < 60_000
  ) {
    return { success: true, record: existingAssignment };
  }

  const { data, error } = await supabase.from("c1_assignment").insert({
    invoice_id: cleanInvoiceId,
    assigned_to: cleanAssignedTo,
    assigned_by: assignedBy,
    follow_up_status: "ASSIGNED",
    notes: notes?.trim() || null,
  }).select("assignment_id, invoice_id, assigned_to, assigned_by, assigned_at, follow_up_status, notes, follow_up_action, promise_date, attachment_url, updated_by, created_at, payment_amount").single();
  if (error) throw error;
  return { success: true, record: data };
}

export async function recordSettlementPaymentInSupabase(params: {
  invoiceId: string;
  assignmentId: string;
  amount: number;
  enteredBy: string;
  paymentDate?: string;
}) {
  const cleanInvoiceId = params.invoiceId.trim();
  const supabase = getSupabaseClient();
  const paymentDate = params.paymentDate || dateOnly(new Date());
  const refNo = `SETTLE-${params.assignmentId}`;

  // 1. Find staging row to get customer info & outstanding amount
  const { data: stagingData } = await supabase
    .from("c1_outstanding_staging_rows")
    .select("invoice_number, customer_id, c1_customer_id, customer_name, outstanding_amount, c1_document_uploads!inner(validation_status)")
    .eq("c1_document_uploads.validation_status", "validated")
    .ilike("invoice_number", cleanInvoiceId)
    .order("created_at", { ascending: false })
    .limit(1);

  const staging = stagingData?.[0];
  let targetCustomerId = staging?.c1_customer_id || staging?.customer_id;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let resolvedCustId: string | null = null;
  if (targetCustomerId && UUID_RE.test(String(targetCustomerId))) {
    const { data: custRow } = await supabase
      .from("c1_customer")
      .select("customer_id")
      .eq("customer_id", targetCustomerId)
      .maybeSingle();
    resolvedCustId = custRow?.customer_id ?? null;
  }

  // If customer ID is not set or not in c1_customer, lookup c1_customer by name
  if (!resolvedCustId && staging?.customer_name) {
    const { data: custByName } = await supabase
      .from("c1_customer")
      .select("customer_id")
      .ilike("customer_name", staging.customer_name.trim())
      .limit(1);
    resolvedCustId = custByName?.[0]?.customer_id ?? null;
  }

  // Fallback to any valid customer if still null
  if (!resolvedCustId) {
    const { data: anyCust } = await supabase.from("c1_customer").select("customer_id").limit(1);
    resolvedCustId = anyCust?.[0]?.customer_id ?? null;
  }

  targetCustomerId = resolvedCustId;

  const finalAmount = Math.max(1, params.amount > 0 ? params.amount : Number(staging?.outstanding_amount || 1));

  // Check if payment with this reference already exists
  const { data: existingPayment } = await supabase
    .from("c1_payment_transactions")
    .select("payment_id")
    .eq("reference_no", refNo)
    .maybeSingle();

  if (existingPayment) {
    await supabase
      .from("c1_payment_transactions")
      .update({
        amount: finalAmount,
        payment_date: paymentDate,
      })
      .eq("payment_id", existingPayment.payment_id);
  } else if (targetCustomerId) {
    await supabase
      .from("c1_payment_transactions")
      .insert({
        invoice_number: cleanInvoiceId,
        customer_id: targetCustomerId,
        amount: finalAmount,
        payment_date: paymentDate,
        reference_no: refNo,
        entered_by: params.enteredBy,
      });
  }

  // Delete from c1_overdue_alert so it immediately disappears
  await supabase
    .from("c1_overdue_alert")
    .delete()
    .ilike("invoice_id", cleanInvoiceId);
}

export async function reverseSettlementPaymentInSupabase(assignmentId: string, invoiceId?: string) {
  const supabase = getSupabaseClient();
  const refNo = `SETTLE-${assignmentId}`;

  await supabase
    .from("c1_payment_transactions")
    .delete()
    .eq("reference_no", refNo);

  if (invoiceId) {
    const cleanInvoiceId = invoiceId.trim();
    const { data: remainingCompleted } = await supabase
      .from("c1_assignment")
      .select("assignment_id")
      .ilike("invoice_id", cleanInvoiceId)
      .eq("follow_up_status", "COMPLETED")
      .neq("assignment_id", assignmentId)
      .limit(1);

    if (!remainingCompleted || remainingCompleted.length === 0) {
      try {
        await evaluateOverdueAlertsInSupabase();
      } catch (err) {
        console.error("Failed to re-evaluate overdue alerts after reversal", err);
      }
    }
  }
}

export async function deleteFollowUpProgressInSupabase(params: {
  assignmentId: string;
  invoiceId: string;
  updatedBy: string;
}) {
  const cleanAssignmentId = params.assignmentId.trim();
  const cleanInvoiceId = params.invoiceId.trim();
  if (!cleanAssignmentId || !cleanInvoiceId) {
    return { success: false, error: "Assignment ID and Invoice ID are required." };
  }

  const supabase = getSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from("c1_assignment")
    .select("assignment_id, invoice_id, follow_up_status, payment_amount")
    .eq("assignment_id", cleanAssignmentId)
    .ilike("invoice_id", cleanInvoiceId)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Follow-up log not found." };
  }

  if (existing.follow_up_status === "COMPLETED") {
    await reverseSettlementPaymentInSupabase(cleanAssignmentId, cleanInvoiceId);
  }

  const { error: deleteError } = await supabase
    .from("c1_assignment")
    .delete()
    .eq("assignment_id", cleanAssignmentId);

  if (deleteError) throw deleteError;

  return { success: true };
}

export async function recordFollowUpProgressInSupabase(params: {
  invoiceId: string;
  followUpStatus: string;
  followUpAction?: string | null;
  promiseDate?: string | null;
  notes?: string | null;
  attachmentUrl?: string | null;
  paymentAmount?: number | null;
  updatedBy: string;
  assignedTo?: string | null;
}) {
  const cleanInvoiceId = params.invoiceId.trim();
  if (!cleanInvoiceId) return { success: false, error: "Invoice ID is required." };

  const supabase = getSupabaseClient();
  let assignedTo = params.assignedTo?.trim();
  if (!assignedTo) {
    const { data: latest } = await supabase
      .from("c1_assignment")
      .select("assigned_to")
      .eq("invoice_id", cleanInvoiceId)
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    assignedTo = latest?.assigned_to || "STAFF";
  }

  const insertData: Record<string, unknown> = {
    invoice_id: cleanInvoiceId,
    assigned_to: assignedTo,
    assigned_by: params.updatedBy,
    follow_up_status: params.followUpStatus || "IN_PROGRESS",
    follow_up_action: params.followUpAction || null,
    promise_date: params.promiseDate || null,
    notes: params.notes?.trim() || null,
    attachment_url: params.attachmentUrl || null,
    updated_by: params.updatedBy,
    payment_amount: params.paymentAmount ? Number(params.paymentAmount) : 0,
  };

  const { data, error } = await supabase
    .from("c1_assignment")
    .insert(insertData)
    .select("assignment_id, invoice_id, assigned_to, assigned_by, assigned_at, follow_up_status, notes, follow_up_action, promise_date, attachment_url, updated_by, created_at, payment_amount")
    .single();

  if (error) throw error;

  if (data && params.followUpStatus === "COMPLETED") {
    try {
      await recordSettlementPaymentInSupabase({
        invoiceId: cleanInvoiceId,
        assignmentId: data.assignment_id,
        amount: Number(data.payment_amount) || 0,
        enteredBy: params.updatedBy,
      });
    } catch (settleErr) {
      console.error("Failed to record settlement payment:", settleErr);
    }
  }

  return { success: true, record: data };
}

export async function updateFollowUpProgressInSupabase(params: {
  assignmentId: string;
  invoiceId?: string;
  followUpStatus?: string;
  followUpAction?: string | null;
  promiseDate?: string | null;
  notes?: string | null;
  attachmentUrl?: string | null;
  paymentAmount?: number | null;
  updatedBy: string;
  assignedTo?: string | null;
}) {
  const cleanAssignmentId = params.assignmentId.trim();
  if (!cleanAssignmentId) return { success: false, error: "Assignment ID is required." };

  const supabase = getSupabaseClient();
  const updateData: Record<string, unknown> = {
    updated_by: params.updatedBy,
  };

  if (params.followUpStatus !== undefined) updateData.follow_up_status = params.followUpStatus;
  if (params.followUpAction !== undefined) updateData.follow_up_action = params.followUpAction;
  if (params.promiseDate !== undefined) updateData.promise_date = params.promiseDate;
  if (params.notes !== undefined) updateData.notes = params.notes?.trim() || null;
  if (params.attachmentUrl !== undefined) updateData.attachment_url = params.attachmentUrl;
  if (params.paymentAmount !== undefined) updateData.payment_amount = params.paymentAmount ? Number(params.paymentAmount) : 0;
  if (params.assignedTo !== undefined && params.assignedTo?.trim()) updateData.assigned_to = params.assignedTo.trim();

  let query = supabase.from("c1_assignment").update(updateData).eq("assignment_id", cleanAssignmentId);
  if (params.invoiceId?.trim()) {
    query = query.eq("invoice_id", params.invoiceId.trim());
  }

  const { data, error } = await query
    .select("assignment_id, invoice_id, assigned_to, assigned_by, assigned_at, follow_up_status, notes, follow_up_action, promise_date, attachment_url, updated_by, created_at, payment_amount")
    .single();

  if (error) throw error;

  if (data) {
    if (params.followUpStatus === "COMPLETED") {
      try {
        await recordSettlementPaymentInSupabase({
          invoiceId: data.invoice_id,
          assignmentId: data.assignment_id,
          amount: Number(data.payment_amount) || 0,
          enteredBy: params.updatedBy,
        });
      } catch (settleErr) {
        console.error("Failed to update settlement payment:", settleErr);
      }
    } else if (params.followUpStatus && params.followUpStatus !== "COMPLETED") {
      try {
        await reverseSettlementPaymentInSupabase(cleanAssignmentId, data.invoice_id);
      } catch (revErr) {
        console.error("Failed to reverse settlement payment:", revErr);
      }
    }
  }

  return { success: true, record: data };
}

export async function fetchAssignmentHistoryInSupabase(invoiceId: string) {
  const { data, error } = await getSupabaseClient()
    .from("c1_assignment")
    .select("assignment_id, invoice_id, assigned_to, assigned_by, assigned_at, follow_up_status, notes, follow_up_action, promise_date, attachment_url, updated_by, created_at, payment_amount")
    .eq("invoice_id", invoiceId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;

  // Deduplicate consecutive identical entries (e.g. rapid double-assignments)
  const rows = (data ?? []) as any[];
  const deduplicated: any[] = [];
  for (const row of rows) {
    const prev = deduplicated[deduplicated.length - 1];
    if (
      prev &&
      prev.assigned_to === row.assigned_to &&
      prev.follow_up_status === row.follow_up_status &&
      Math.abs(new Date(prev.assigned_at).getTime() - new Date(row.assigned_at).getTime()) < 60_000
    ) {
      continue;
    }
    deduplicated.push(row);
  }

  return deduplicated;
}

