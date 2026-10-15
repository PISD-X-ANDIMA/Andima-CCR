import "server-only";
import { createAdminClient } from "@/lib/server/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CustomerAnalyticsItem, InvoiceDetail, StatementOfAccountData } from '@/types/customer';
import { STATEMENT_AURORA_BLUE } from './customerData';

export const getSupabaseClient = createAdminClient;

export type CustomerAnalyticsQuery = {
  branch?: string | null;
  search?: string | null;
  paymentCycle?: string | null;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
};

function fallbackCustomerAnalytics(options: CustomerAnalyticsQuery) {
  const branch = options.branch?.trim().toLowerCase() || "";
  const search = options.search?.trim().toLowerCase() || "";
  const paymentCycle = options.paymentCycle?.trim() || "";
  const sortBy = options.sortBy || "sales_profit";
  const sortOrder = options.sortOrder === "asc" ? "asc" : "desc";
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, options.limit ?? 5);

  let filtered = [...INITIAL_CUSTOMERS];
  if (branch && branch !== "semua cabang" && branch !== "all") filtered = filtered.filter((customer) => customer.branch.toLowerCase() === branch);
  if (search) filtered = filtered.filter((customer) => [customer.customer_name, customer.npwp, customer.id].some((value) => value.toLowerCase().includes(search)));
  if (paymentCycle === "Lancar (< 30 Hari)") filtered = filtered.filter((customer) => customer.dso_trend.july_2026 <= 30);
  if (paymentCycle === "Overdue (> 30 Hari)") filtered = filtered.filter((customer) => customer.dso_trend.july_2026 > 30);

  filtered.sort((left, right) => {
    const leftValue = sortBy === "customer_name" ? left.customer_name : sortBy === "cost" ? left.cost : sortBy === "total_outstanding" ? left.total_outstanding : left.sales_profit;
    const rightValue = sortBy === "customer_name" ? right.customer_name : sortBy === "cost" ? right.cost : sortBy === "total_outstanding" ? right.total_outstanding : right.sales_profit;
    const comparison = typeof leftValue === "string" ? leftValue.localeCompare(String(rightValue)) : Number(leftValue) - Number(rightValue);
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const totalItems = filtered.length;
  return {
    customers: filtered.slice((page - 1) * limit, page * limit),
    kpi: INITIAL_KPI_SUMMARY,
    totalItems,
    fromDb: false,
  };
}

/**
<<<<<<< HEAD
 * Fetch customer analytics from the indexed C1 RPC with a seed fallback.
 */
export async function fetchCustomerAnalyticsFromSupabase(options: CustomerAnalyticsQuery = {}) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('c1_get_customer_analytics', {
      p_branch: options.branch ?? null,
      p_search: options.search ?? '',
      p_payment_cycle: options.paymentCycle ?? '',
      p_sort_by: options.sortBy ?? 'sales_profit',
      p_sort_order: options.sortOrder ?? 'desc',
      p_page: options.page ?? 1,
      p_limit: options.limit ?? 5,
    });

    if (error || !data || !Array.isArray((data as { customers?: unknown }).customers) || !(data as { customers: unknown[] }).customers.length) {
      return fallbackCustomerAnalytics(options);
    }

    const result = data as { customers: CustomerAnalyticsItem[]; kpi: typeof INITIAL_KPI_SUMMARY; total_items: number };
    return { customers: result.customers, kpi: result.kpi, totalItems: Number(result.total_items) || 0, fromDb: true };
  } catch (error) {
    console.error('Error querying Supabase customer analytics:', error);
    return fallbackCustomerAnalytics(options);
=======
 * Fetch customer records from the company master table.
 */
export async function fetchCustomerAnalyticsFromSupabase(client?: SupabaseClient) {
  const supabase = client ?? getSupabaseClient();
  const [
    { data: companyRows, error: companyError },
    { data: salesRows, error: salesError },
    { data: outstandingRows, error: outstandingError },
    { data: costRows, error: costError },
    { data: jobRows, error: jobsError },
    { data: worksheetRows, error: worksheetsError },
    { data: conversationRows, error: conversationsError },
  ] = await Promise.all([
    supabase
    .from('a1_company_list')
    .select('company_list_id, name, company_name, customer_code, address')
    .order('company_name', { ascending: true }),
    supabase
      .from('c1_company_sales_staging_rows')
      .select('customer_id, customer_name, period_month, revenue, total_cost, document_id, c1_document_uploads!inner(validation_status, uploaded_at)')
      .eq('c1_document_uploads.validation_status', 'validated'),
    supabase
      .from('c1_outstanding_staging_rows')
      .select('customer_id, customer_name, outstanding_amount, due_date, invoice_number, document_id, c1_document_uploads!inner(validation_status, uploaded_at)')
      .eq('c1_document_uploads.validation_status', 'validated'),
    supabase.from('c2_cost_transactions').select('customer_name, actual_cost, period_month, job_number, branch_code'),
    supabase.from('jobs').select('customer_id, customer_name, job_number, delivery_location, has_issue, created_at, planned_date_time'),
    supabase.from('a2_worksheets').select('customer_id, job_no, create_date, status_kendala, has_issue, issue_note, handover_location'),
    supabase.from('a2_record_conversations').select('customer_id, conversation_date, summary, need_assistance'),
  ]);

  if (companyError) throw new Error(`Unable to fetch company list: ${companyError.message}`);
  if (salesError) throw new Error(`Unable to fetch customer sales: ${salesError.message}`);
  if (outstandingError) throw new Error(`Unable to fetch customer outstanding: ${outstandingError.message}`);
  if (costError) throw new Error(`Unable to fetch customer costs: ${costError.message}`);
  if (jobsError) throw new Error(`Unable to fetch customer jobs: ${jobsError.message}`);
  if (worksheetsError) throw new Error(`Unable to fetch customer worksheets: ${worksheetsError.message}`);
  if (conversationsError) throw new Error(`Unable to fetch customer conversations: ${conversationsError.message}`);

  const normalizeName = (value: string) => value.trim().toLocaleLowerCase('id-ID');
  const companyCandidates = companyRows ?? [];
  const bestCompany = (current: (typeof companyCandidates)[number] | undefined, candidate: (typeof companyCandidates)[number]) => {
    if (!current) return candidate;
    const currentQuality = (current.address?.trim().length ?? 0) + (current.customer_code?.trim().length ?? 0);
    const candidateQuality = (candidate.address?.trim().length ?? 0) + (candidate.customer_code?.trim().length ?? 0);
    return candidateQuality > currentQuality ? candidate : current;
  };
  const companyGroups = new Map<string, (typeof companyCandidates)[number]>();
  for (const company of companyCandidates) {
    const key = normalizeName(company.company_name || company.name);
    companyGroups.set(key, bestCompany(companyGroups.get(key), company));
>>>>>>> origin/feat/c1-membantuwebdev
  }
  const companies = [...companyGroups.values()];
  const companyById = new Map<string, (typeof companies)[number]>();
  const companyByName = new Map<string, (typeof companies)[number]>();
  for (const raw of companyCandidates) {
    const company = companyGroups.get(normalizeName(raw.company_name || raw.name))!;
    companyById.set(raw.company_list_id, company);
    companyByName.set(normalizeName(company.name), company);
    companyByName.set(normalizeName(company.company_name), company);
    companyByName.set(normalizeName(raw.name), company);
    companyByName.set(normalizeName(raw.company_name), company);
  }

  const latestPeriod = (salesRows ?? []).reduce<string | null>((latest, row) => {
    const period = row.period_month;
    return !latest || period > latest ? period : latest;
  }, null);
  const latestSalesDocument = (salesRows ?? [])
    .filter((row) => row.period_month === latestPeriod)
    .sort((a, b) => String(b.c1_document_uploads?.[0]?.uploaded_at ?? "").localeCompare(String(a.c1_document_uploads?.[0]?.uploaded_at ?? "")))[0]?.document_id;
  const currentSales = (salesRows ?? []).filter((row) => row.period_month === latestPeriod && row.document_id === latestSalesDocument);
  const customerMetrics = new Map<string, { revenue: number; cost: number; hasSales: boolean; hasCost: boolean; outstanding: number; overdue: number; invoiceCount: number; company?: (typeof companies)[number]; customerName: string; jobCount: number; issueCount: number; latestJobNumber: string | null; latestActivityDate: string | null; latestConversationDate: string | null; latestConversation: string | null; assistanceCount: number; location: string }>();
  const resolveCustomer = (customerId: string | null, customerName: string) => {
    const company = (customerId && companyById.get(customerId)) || companyByName.get(normalizeName(customerName));
    return { key: company ? normalizeName(company.company_name || company.name) : normalizeName(customerName), company, name: company?.company_name || company?.name || customerName };
  };
  const getMetric = (customerId: string | null, customerName: string) => {
    const resolved = resolveCustomer(customerId, customerName);
    let metric = customerMetrics.get(resolved.key);
    if (!metric) {
      metric = { revenue: 0, cost: 0, hasSales: false, hasCost: false, outstanding: 0, overdue: 0, invoiceCount: 0, company: resolved.company, customerName: resolved.name, jobCount: 0, issueCount: 0, latestJobNumber: null, latestActivityDate: null, latestConversationDate: null, latestConversation: null, assistanceCount: 0, location: resolved.company?.address || '-' };
      customerMetrics.set(resolved.key, metric);
    }
    return metric;
  };

  for (const company of companies) getMetric(company.company_list_id, company.company_name || company.name);
  for (const row of currentSales) {
    const metric = getMetric(row.customer_id, row.customer_name);
    metric.hasSales = true;
    metric.hasCost = true;
    metric.revenue += Number(row.revenue || 0);
    metric.cost += Number(row.total_cost || 0);
  }

  const costPeriods = (costRows ?? []).reduce((periods, row) => {
    const key = resolveCustomer(null, row.customer_name).key;
    const value = Date.parse(`1 ${row.period_month}`);
    const current = periods.get(key);
    if (!current || (Number.isFinite(value) && value > current.value)) periods.set(key, { period: row.period_month, value });
    return periods;
  }, new Map<string, { period: string; value: number }>());
  const latestCosts = new Map<string, number>();
  const latestCostBranches = new Map<string, string>();
  for (const row of costRows ?? []) {
    const key = resolveCustomer(null, row.customer_name).key;
    if (costPeriods.get(key)?.period === row.period_month) {
      latestCosts.set(key, (latestCosts.get(key) ?? 0) + Number(row.actual_cost || 0));
      if (row.branch_code) latestCostBranches.set(key, row.branch_code);
    }
  }
  for (const [key, amount] of latestCosts) {
    const metric = customerMetrics.get(key);
    if (metric && !metric.hasSales) {
      metric.cost = amount;
      metric.hasCost = true;
      if (!metric.company?.address && latestCostBranches.get(key)) metric.location = latestCostBranches.get(key)!;
    }
  }

  const activityOrder = (value: string | null | undefined) => value ? Date.parse(value) || 0 : 0;
  for (const row of jobRows ?? []) {
    const metric = getMetric(row.customer_id, row.customer_name);
    metric.jobCount += 1;
    if (row.has_issue) metric.issueCount += 1;
    const activityDate = row.planned_date_time || row.created_at;
    if (activityOrder(activityDate) >= activityOrder(metric.latestActivityDate)) {
      metric.latestActivityDate = activityDate;
      metric.latestJobNumber = row.job_number;
      if (!metric.company?.address && row.delivery_location) metric.location = row.delivery_location;
    }
  }
  for (const row of worksheetRows ?? []) {
    const metric = getMetric(row.customer_id, '');
    if (row.has_issue || row.status_kendala === 'kendala_terdeteksi') metric.issueCount += 1;
    const activityDate = row.create_date;
    if (activityOrder(activityDate) >= activityOrder(metric.latestActivityDate)) {
      metric.latestActivityDate = activityDate;
      metric.latestJobNumber = row.job_no;
      if (!metric.company?.address && row.handover_location) metric.location = row.handover_location;
    }
  }
  for (const row of conversationRows ?? []) {
    const metric = getMetric(row.customer_id, '');
    if (row.need_assistance) metric.assistanceCount += 1;
    if (activityOrder(row.conversation_date) >= activityOrder(metric.latestConversationDate)) {
      metric.latestConversationDate = row.conversation_date;
      metric.latestConversation = row.summary;
    }
    if (activityOrder(row.conversation_date) >= activityOrder(metric.latestActivityDate)) metric.latestActivityDate = row.conversation_date;
  }
  const today = new Date().toISOString().slice(0, 10);
  const latestOutstandingByInvoice = new Map<string, (typeof outstandingRows)[number]>();
  for (const row of outstandingRows ?? []) {
    const resolved = resolveCustomer(row.customer_id, row.customer_name);
    const key = `${resolved.key}:${row.invoice_number}`;
    const current = latestOutstandingByInvoice.get(key);
    if (!current || String(row.c1_document_uploads?.[0]?.uploaded_at ?? "") > String(current.c1_document_uploads?.[0]?.uploaded_at ?? "")) {
      latestOutstandingByInvoice.set(key, row);
    }
  }
  for (const row of latestOutstandingByInvoice.values()) {
    const metric = getMetric(row.customer_id, row.customer_name);
    const amount = Number(row.outstanding_amount || 0);
    metric.outstanding += amount;
    metric.invoiceCount += 1;
    if (row.due_date < today) metric.overdue += amount;
  }

  const mappedCustomers: CustomerAnalyticsItem[] = [...customerMetrics.entries()].map(([id, metric]) => ({
    id: metric.company?.company_list_id || id,
    customer_name: metric.customerName,
    npwp: metric.company?.customer_code || '-',
    location_detail: metric.location,
    branch: 'Tidak ditentukan',
    branch_office_badge: metric.company?.address || '-',
    sales_profit: metric.hasSales ? metric.revenue - metric.cost : null,
    revenue: metric.hasSales ? metric.revenue : null,
    sales_profit_trend: 'flat',
    cost: metric.hasCost ? metric.cost : null,
    total_outstanding: metric.invoiceCount ? metric.outstanding : null,
    credit_limit: 0,
    payment_accuracy: 0,
    active_invoices_count: metric.invoiceCount,
    dso_trend: { may_2026: 0, june_2026: 0, july_2026: 0 },
    pic: { name: '-', phone: '-' },
    connected_routes: [],
    job_count: metric.jobCount,
    issue_count: metric.issueCount,
    latest_job_number: metric.latestJobNumber,
    latest_activity_date: metric.latestActivityDate,
    latest_conversation: metric.latestConversation,
    assistance_count: metric.assistanceCount,
  }));

  const totalRevenue = currentSales.length ? currentSales.reduce((sum, row) => sum + Number(row.revenue || 0), 0) : null;
  const hasAnyCost = [...customerMetrics.values()].some((metric) => metric.hasCost);
  const totalCost = hasAnyCost ? [...customerMetrics.values()].reduce((sum, metric) => sum + metric.cost, 0) : null;
  const totalOutstanding = [...customerMetrics.values()].reduce((sum, metric) => sum + metric.outstanding, 0);
  const overdueOutstanding = [...customerMetrics.values()].reduce((sum, metric) => sum + metric.overdue, 0);
  const kpiSummary = {
    totalCustomers: mappedCustomers.length,
    period: latestPeriod,
    totalRevenue,
    totalCost,
    totalOutstanding: (outstandingRows ?? []).length ? totalOutstanding : null,
    overdueOutstanding: (outstandingRows ?? []).length ? overdueOutstanding : null,
  };

  return { customers: mappedCustomers, kpi: kpiSummary, fromDb: true };
}

/**
 * Fetch invoices for customer from Supabase invoice_detail table
 */
export async function fetchInvoicesFromSupabase(customerId: string) {
  try {
    const supabase = getSupabaseClient();
    const { data: invoices, error } = await supabase
      .from('invoice_detail')
      .select('*')
      .eq('customer_id', customerId);

    if (error || !invoices || invoices.length === 0) {
      return null;
    }

    return invoices.map((inv: any) => ({
      invoice_id: inv.invoice_id,
      customer_id: inv.customer_id,
      invoice_number: inv.invoice_number,
      bl_number: inv.bl_number,
      description: inv.description,
      due_date: inv.due_date,
      amount: Number(inv.amount),
      payment_status: inv.payment_status,
      bulk_close_status: inv.bulk_close_status,
    })) as InvoiceDetail[];
  } catch (error) {
    console.error(`Error querying Supabase invoices for ${customerId}:`, error);
    return null;
  }
}

/**
 * Perform Bulk Close on Supabase invoice_detail table
 */
export async function bulkCloseInvoicesInSupabase(customerId: string, invoiceIds?: string[]) {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('invoice_detail')
      .update({ bulk_close_status: 'CLOSED' })
      .eq('customer_id', customerId);

    if (invoiceIds && invoiceIds.length > 0 && !invoiceIds.includes('ALL_PENDING')) {
      query = query.in('invoice_id', invoiceIds);
    }

    const { data, error } = await query.select();
    if (error) {
      console.error('Supabase bulk close error:', error);
      return { success: false, error: error.message };
    }
    return { success: true, count: data?.length || 0 };
  } catch (error: any) {
    console.error('Supabase bulk close exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch statement of account for customer from Supabase DB
 */
export async function fetchStatementFromSupabase(customerId: string): Promise<StatementOfAccountData | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: cust, error: custErr } = await supabase
      .from('customer')
      .select('*')
      .or(`customer_id.eq.${customerId},customer_name.ilike.%${customerId}%`)
      .single();

    if (custErr || !cust) {
      return null;
    }

    const { data: invoices } = await supabase
      .from('invoice_detail')
      .select('*')
      .eq('customer_id', cust.customer_id);

    const mutations = (invoices || []).map((inv: any) => ({
      trans_date: new Date(inv.created_at || Date.now()).toLocaleDateString('id-ID'),
      reference_no: inv.invoice_number,
      bl_number: inv.bl_number || undefined,
      cargo_description: inv.description || 'Freight Delivery',
      due_date: inv.due_date,
      debit: Number(inv.amount),
      credit: inv.payment_status === 'PAID' ? Number(inv.amount) : 0,
      cumulative_balance: Number(inv.amount),
      status: inv.payment_status === 'PAID' ? 'Lunas Terposting' : 'Belum Lunas',
      doc_action: 'Lihat INV',
      raw_inv_id: inv.invoice_id,
    }));

    return {
      customer_id: cust.customer_id,
      customer_name: cust.customer_name,
      legal_entity: cust.customer_name,
      npwp: cust.npwp || '01.345.890.1-021.000',
      category: 'Multimodal Ocean & Inland Freight',
      segmentation: 'Tier-1 Corporate Shipper',
      status_badge: 'Kredit Aktif - Batas Toleransi Normal',
      main_hub: `${cust.branch} Hub Terminal`,
      pic_account_officer: {
        name: cust.pic_name || 'Hendrawan Kusuma',
        phone: cust.pic_phone || '+62 21 5082 1199',
      },
      client_finance_contact: {
        name: `Finance Dept (${cust.customer_name})`,
        email: cust.finance_email || 'finance@customer.co.id',
      },
      credit_limit: Number(cust.credit_limit || 5000000000),
      review_cycle: 'Aktif s/d Des 2026',
      outstanding_balance: 1082000000,
      credit_usage_percent: 21.64,
      overdue_balance: 0,
      overdue_status_text: 'Semua dalam termin lancar',
      payment_accuracy: Number(cust.payment_accuracy || 94.2),
      avg_dso_days: Number(cust.dso_days || 22.4),
      top_days_policy: 30,
      mutations: mutations.length > 0 ? mutations : STATEMENT_AURORA_BLUE.mutations,
      bank_reconciliations: STATEMENT_AURORA_BLUE.bank_reconciliations,
    };
  } catch (error) {
    console.error(`Error querying Supabase statement for ${customerId}:`, error);
    return null;
  }
}
