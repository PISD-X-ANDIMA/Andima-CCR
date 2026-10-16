import "server-only";
import { createAdminClient } from "@/lib/server/admin";
import { CustomerAnalyticsItem, CustomerCodeDetail, CustomerCodeOutstandingRow, CustomerCodeSalesRow, InvoiceDetail, KpiSummary, StatementOfAccountData } from '@/types/customer';
import { INITIAL_KPI_SUMMARY, STATEMENT_AURORA_BLUE } from './customerData';

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
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, options.limit ?? 5);
  const kpi: KpiSummary = {
    ...INITIAL_KPI_SUMMARY,
    totalCustomers: 0,
    totalActiveCustomers: 0,
    totalRevenue: 0,
    totalCost: 0,
    currentMonthCost: 0,
    currentMonthSalesProfit: 0,
    totalOutstanding: 0,
    overdueOutstanding: 0,
    period: null,
    highRiskOutstanding: 0,
    highRiskAccountCount: 0,
    topContributingCustomer: undefined,
  };
  void page;
  void limit;
  return { customers: [] as CustomerAnalyticsItem[], kpi, totalItems: 0, fromDb: false };
}

function normalizeCustomerAnalyticsKpi(value: unknown): KpiSummary {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const numberOrFallback = (candidate: unknown, fallback: number | undefined) => {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === 'string' && candidate.trim() !== '' && Number.isFinite(Number(candidate))) return Number(candidate);
    return fallback;
  };

  return {
    ...INITIAL_KPI_SUMMARY,
    totalCustomers: numberOrFallback(raw.totalCustomers, numberOrFallback(raw.totalActiveCustomers, 0)),
    totalRevenue: numberOrFallback(raw.totalRevenue, 0),
    totalCost: numberOrFallback(raw.totalCost, 0),
    currentMonthCost: numberOrFallback(raw.currentMonthCost, numberOrFallback(raw.totalCost, 0)),
    currentMonthSalesProfit: numberOrFallback(raw.currentMonthSalesProfit, 0),
    totalOutstanding: numberOrFallback(raw.totalOutstanding, 0),
    overdueOutstanding: numberOrFallback(raw.overdueOutstanding, 0),
    period: typeof raw.period === 'string' ? raw.period : null,
    totalActiveCustomers: numberOrFallback(raw.totalActiveCustomers, 0),
    branchBreakdown: raw.branchBreakdown as KpiSummary['branchBreakdown'],
    averagePaymentCycle: numberOrFallback(raw.averagePaymentCycle, 0),
    paymentCycleDiffVsQ2: numberOrFallback(raw.paymentCycleDiffVsQ2, 0),
    highRiskOutstanding: numberOrFallback(raw.highRiskOutstanding, 0),
    highRiskAccountCount: numberOrFallback(raw.highRiskAccountCount, 0),
    highRiskGrowthPercent: numberOrFallback(raw.highRiskGrowthPercent, 0),
    topContributingCustomer: raw.topContributingCustomer as KpiSummary['topContributingCustomer'],
  };
}

/** Fetch company-level customer analytics from the validated C1 RPC. */
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

    if (error || !data || typeof data !== 'object' || !Array.isArray((data as { customers?: unknown }).customers)) return fallbackCustomerAnalytics(options);
    const result = data as { customers: CustomerAnalyticsItem[]; kpi?: unknown; total_items?: number };
    return {
      customers: result.customers,
      kpi: normalizeCustomerAnalyticsKpi(result.kpi),
      totalItems: Number(result.total_items) || 0,
      fromDb: true,
    };
  } catch (error) {
    console.error('Error querying Supabase customer analytics:', error);
    return fallbackCustomerAnalytics(options);
  }
}

/** Fetch one canonical company from the same validated C1 analytics aggregate. */
export async function fetchCustomerAnalyticsItemFromSupabase(customerId: string) {
  const result = await fetchCustomerAnalyticsFromSupabase({
    search: customerId,
    sortBy: 'customer_name',
    sortOrder: 'asc',
    page: 1,
    limit: 1,
  });
  const direct = result.customers.find((customer) =>
    (customer.company_group_id ?? customer.customer_id ?? customer.id) === customerId,
  );
  if (direct) return direct;

  // Older links used CUST-####, while aliases may use a non-canonical UUID or
  // code. Resolve those identifiers through the customer master, then fetch
  // the canonical grouped row so the detail route remains backward compatible.
  const canonical = await resolveCanonicalCustomer(getSupabaseClient(), customerId);
  if (!canonical) return null;
  const canonicalResult = await fetchCustomerAnalyticsFromSupabase({
    search: canonical.customerId,
    sortBy: 'customer_name',
    sortOrder: 'asc',
    page: 1,
    limit: 1,
  });
  return canonicalResult.customers.find((customer) =>
    (customer.company_group_id ?? customer.customer_id ?? customer.id) === canonical.customerId,
  ) ?? null;
}

type CustomerInvoice = InvoiceDetail & {
  customer_code?: string | null;
  job_number?: string | null;
  mawb?: string | null;
  payments?: Array<{ payment_id: string; amount: number; payment_date: string; reference_no: string }>;
};

type CustomerMasterRow = {
  customer_id: string;
  customer_name: string | null;
  customer_code?: string | null;
  company_name_key?: string | null;
  active_status?: boolean | null;
};

type CanonicalCustomer = { customerId: string; customerName: string | null; memberIds: string[]; members: CustomerMasterRow[] };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function companyNameKey(value: unknown) {
  return String(value ?? "")
    .replace(/\b\d{2,4}-\d{6,12}\b|\b[A-Z]{2,6}\d{6,}\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Resolve IDs emitted by both the current and legacy customer analytics RPCs. */
async function resolveCanonicalCustomer(supabase: ReturnType<typeof getSupabaseClient>, requestedId: string): Promise<CanonicalCustomer | null> {
  const normalized = requestedId.trim();
  if (!normalized) return null;

  const selectCustomers = async (fields: string): Promise<CustomerMasterRow[]> => {
    const result = await supabase.from('c1_customer').select(fields).order('created_at', { ascending: true, nullsFirst: false }).order('customer_id', { ascending: true });
    if (!result.error) return ((result.data ?? []) as unknown as CustomerMasterRow[]).filter((row) => row.active_status !== false);
    if (fields.includes('company_name_key') && /column .*|schema cache|does not exist/i.test(String(result.error.message ?? result.error))) {
      const fallback = await supabase.from('c1_customer').select('customer_id, customer_name, customer_code, active_status').order('customer_id', { ascending: true });
      if (fallback.error) throw fallback.error;
      return ((fallback.data ?? []) as CustomerMasterRow[]).filter((row) => row.active_status !== false);
    }
    throw result.error;
  };
  const rows = await selectCustomers('customer_id, customer_name, customer_code, company_name_key, active_status');
  let selected = rows.find((row: any) => UUID_PATTERN.test(normalized) && String(row.customer_id) === normalized)
    ?? rows.find((row: any) => String(row.customer_code ?? '').toLowerCase() === normalized.toLowerCase());
  if (!selected) {
    const legacyMatch = /^CUST-(\d+)$/i.exec(normalized);
    const displayRank = legacyMatch ? Number(legacyMatch[1]) : 0;
    selected = Number.isSafeInteger(displayRank) && displayRank > 0 ? rows[displayRank - 1] : undefined;
  }
  if (!selected) return null;
  const key = String((selected as any).company_name_key || companyNameKey((selected as any).customer_name));
  const members = rows.filter((row: CustomerMasterRow) => String(row.company_name_key || companyNameKey(row.customer_name)) === key);
  return {
    customerId: String((selected as any).customer_id),
    customerName: (selected as any).customer_name ?? null,
    memberIds: members.map((row: any) => String(row.customer_id)),
    members,
  };
}

const CUSTOMER_IDENTIFIER_PATTERN = /\b(?:\d{2,4}-\d{6,12}|[A-Z]{2,6}\d{6,})\b/gi;

function codeMatchesMember(code: string, member: CustomerMasterRow) {
  const normalizedCode = code.trim().toLowerCase();
  if (!normalizedCode) return false;
  if (String(member.customer_code ?? '').trim().toLowerCase() === normalizedCode) return true;
  return [...String(member.customer_name ?? '').matchAll(CUSTOMER_IDENTIFIER_PATTERN)]
    .some((match) => match[0].toLowerCase() === normalizedCode);
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function validatedDocumentIds(supabase: ReturnType<typeof getSupabaseClient>, documentType: 'COMPANY_SALES_REPORT' | 'OUTSTANDING_REPORT') {
  const { data, error } = await supabase
    .from('c1_document_uploads')
    .select('id')
    .eq('validation_status', 'validated')
    .eq('document_type', documentType);
  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}

/** Fetch all validated Sales/Outstanding rows for one clickable customer code. */
export async function fetchCustomerCodeDetailFromSupabase(customerId: string, code: string): Promise<CustomerCodeDetail | null> {
  const supabase = getSupabaseClient();
  const canonical = await resolveCanonicalCustomer(supabase, customerId);
  const normalizedCode = code.trim();
  if (!canonical || !normalizedCode) return null;

  const members = canonical.members.filter((member) => codeMatchesMember(normalizedCode, member));
  if (!members.length) return null;
  const memberIds = members.map((member) => String(member.customer_id));
  const aliases = members.map((member) => ({
    customer_id: String(member.customer_id),
    customer_code: member.customer_code ?? null,
    customer_name: member.customer_name ?? '',
  }));

  const [salesDocumentIds, outstandingDocumentIds] = await Promise.all([
    validatedDocumentIds(supabase, 'COMPANY_SALES_REPORT'),
    validatedDocumentIds(supabase, 'OUTSTANDING_REPORT'),
  ]);

  const salesRows: CustomerCodeSalesRow[] = [];
  if (salesDocumentIds.length) {
    const { data, error } = await supabase
      .from('c1_company_sales_staging_rows')
      .select('id, document_id, row_number, period_month, customer_name, customer_id, c1_customer_id, revenue, trucking_cost, handling_cost, storage_cost, other_operational_cost, total_cost')
      .in('document_id', salesDocumentIds)
      .in('c1_customer_id', memberIds)
      .order('period_month', { ascending: false })
      .order('row_number', { ascending: true });
    if (error) throw error;
    const seenSalesRows = new Set<string>();
    for (const row of data ?? []) {
      const rowKey = String(row.id ?? `${row.document_id}:${row.row_number}`);
      if (seenSalesRows.has(rowKey)) continue;
      seenSalesRows.add(rowKey);
      const totalCost = numeric(row.total_cost);
      salesRows.push({
        id: String(row.id),
        document_id: String(row.document_id),
        row_number: Number(row.row_number) || 0,
        period_month: String(row.period_month),
        customer_name: String(row.customer_name ?? ''),
        customer_id: row.customer_id ? String(row.customer_id) : null,
        c1_customer_id: row.c1_customer_id ? String(row.c1_customer_id) : null,
        revenue: numeric(row.revenue),
        trucking_cost: numeric(row.trucking_cost),
        handling_cost: numeric(row.handling_cost),
        storage_cost: numeric(row.storage_cost),
        other_operational_cost: numeric(row.other_operational_cost),
        total_cost: totalCost,
        sales_profit: numeric(row.revenue) - totalCost,
      });
    }
  }

  const outstandingRows: CustomerCodeOutstandingRow[] = [];
  if (outstandingDocumentIds.length) {
    const { data, error } = await supabase
      .from('c1_outstanding_staging_rows')
      .select('id, document_id, row_number, invoice_number, customer_name, customer_id, c1_customer_id, outstanding_amount, due_date, create_date, job_number, mawb, bulk_close_status, created_at')
      .in('document_id', outstandingDocumentIds)
      .in('c1_customer_id', memberIds)
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('due_date', { ascending: true })
      .order('row_number', { ascending: true });
    if (error) throw error;
    const seenInvoices = new Set<string>();
    for (const row of data ?? []) {
      const invoiceKey = String(row.invoice_number ?? '').trim().toLowerCase();
      const rowKey = String(row.id ?? `${row.document_id}:${row.row_number}`);
      if (invoiceKey ? seenInvoices.has(invoiceKey) : seenInvoices.has(rowKey)) continue;
      if (invoiceKey) seenInvoices.add(invoiceKey); else seenInvoices.add(rowKey);
      outstandingRows.push({
        id: String(row.id),
        document_id: String(row.document_id),
        row_number: Number(row.row_number) || 0,
        invoice_number: String(row.invoice_number ?? ''),
        customer_name: String(row.customer_name ?? ''),
        customer_id: row.customer_id ? String(row.customer_id) : null,
        c1_customer_id: row.c1_customer_id ? String(row.c1_customer_id) : null,
        outstanding_amount: numeric(row.outstanding_amount),
        due_date: String(row.due_date),
        create_date: row.create_date ? String(row.create_date) : null,
        job_number: row.job_number ? String(row.job_number) : null,
        mawb: row.mawb ? String(row.mawb) : null,
        bulk_close_status: String(row.bulk_close_status ?? 'PENDING'),
      });
    }
    outstandingRows.sort((left, right) => left.due_date.localeCompare(right.due_date) || left.row_number - right.row_number);
  }

  return {
    company_group_id: canonical.customerId,
    customer_id: canonical.customerId,
    code: normalizedCode,
    aliases,
    sales_rows: salesRows,
    outstanding_rows: outstandingRows,
  };
}

async function validatedOutstandingRows(requestedCustomerId: string) {
  const supabase = getSupabaseClient();
  const customer = await resolveCanonicalCustomer(supabase, requestedCustomerId);
  if (!customer) return { customer: null, rows: [] as any[] };
  const { data: documents, error: documentsError } = await supabase
    .from('c1_document_uploads')
    .select('id')
    .eq('validation_status', 'validated')
    .eq('document_type', 'OUTSTANDING_REPORT');
  if (documentsError) throw documentsError;
  const documentIds = (documents ?? []).map((row: { id: string }) => row.id);
  if (!documentIds.length) return { customer, rows: [] as any[] };

  const baseQuery = 'id, document_id, invoice_number, customer_name, customer_id, outstanding_amount, due_date, create_date, job_number, mawb, created_at';
  const enhanced = await supabase
    .from('c1_outstanding_staging_rows')
    .select(`${baseQuery}, c1_customer_id, bulk_close_status`)
    .in('document_id', documentIds)
    .in('c1_customer_id', customer.memberIds)
    .order('created_at', { ascending: false });
  let enhancedError = enhanced.error;
  if (!enhanced.error) {
    const legacyRows = await supabase
      .from('c1_outstanding_staging_rows')
      .select(`${baseQuery}, c1_customer_id, bulk_close_status`)
      .in('document_id', documentIds)
      .in('customer_id', customer.memberIds)
      .order('created_at', { ascending: false });
    if (!legacyRows.error) {
      const merged = [...(enhanced.data ?? []), ...(legacyRows.data ?? [])];
      const seen = new Set<string>();
      const deduplicated = merged.filter((row) => { const key = String(row.id); if (seen.has(key)) return false; seen.add(key); return true; });
      if (deduplicated.length || !customer.customerName) return { customer, rows: deduplicated };
      const byName = await supabase
        .from('c1_outstanding_staging_rows')
        .select(`${baseQuery}, c1_customer_id, bulk_close_status`)
        .in('document_id', documentIds)
        .ilike('customer_name', customer.customerName)
        .order('created_at', { ascending: false });
      if (!byName.error) return { customer, rows: byName.data ?? [] };
      if (!/column .*|schema cache|does not exist/i.test(String(byName.error.message ?? byName.error))) throw byName.error;
    }
    enhancedError = legacyRows.error;
  }

  // Older targets do not have the columns added by the company analytics migration.
  // Query only the original ingestion schema there instead of failing the detail page.
  if (!enhancedError) return { customer, rows: [] as any[] };
  if (!/column .*|schema cache|does not exist/i.test(String(enhancedError.message ?? enhancedError))) throw enhancedError;
  const fallback = await supabase
      .from('c1_outstanding_staging_rows')
      .select(baseQuery)
      .in('document_id', documentIds)
      .in('customer_id', customer.memberIds)
      .order('created_at', { ascending: false });
  if (!fallback.error && (fallback.data?.length || !customer.customerName)) return { customer, rows: fallback.data ?? [] };
  if (!fallback.error && customer.customerName) {
    const byName = await supabase
      .from('c1_outstanding_staging_rows')
      .select(baseQuery)
      .in('document_id', documentIds)
      .ilike('customer_name', customer.customerName)
      .order('created_at', { ascending: false });
    if (!byName.error) return { customer, rows: byName.data ?? [] };
    throw byName.error;
  }
  if (fallback.error && customer.customerName && /column .*customer_id|schema cache|does not exist/i.test(String(fallback.error.message ?? fallback.error))) {
    const byName = await supabase
      .from('c1_outstanding_staging_rows')
      .select(baseQuery)
      .in('document_id', documentIds)
      .ilike('customer_name', customer.customerName)
      .order('created_at', { ascending: false });
    if (!byName.error) return { customer, rows: byName.data ?? [] };
    throw byName.error;
  }
  throw fallback.error;
}

/** Fetch the latest validated outstanding invoice rows for one canonical company. */
export async function fetchInvoicesFromSupabase(customerId: string, options: { includeClosed?: boolean; overdueOnly?: boolean; asOf?: string } = {}) {
  try {
    const supabase = getSupabaseClient();
    const result = await validatedOutstandingRows(customerId);
    if (!result.customer) return [];
    const rows = result.rows;
    const latest = new Map<string, any>();
    for (const row of rows) {
      const key = String(row.invoice_number ?? '').trim().toLowerCase();
      if (key && !latest.has(key)) latest.set(key, row);
    }
    let invoices = Array.from(latest.values());
    if (!options.includeClosed) invoices = invoices.filter((row) => (row.bulk_close_status ?? 'PENDING') === 'PENDING');

    const invoiceNumbers = invoices.map((row) => row.invoice_number).filter(Boolean);
    const paymentResult = invoiceNumbers.length
      ? await supabase.from('c1_payment_transactions').select('payment_id, invoice_number, amount, payment_date, reference_no').in('customer_id', result.customer.memberIds).in('invoice_number', invoiceNumbers).order('payment_date', { ascending: false })
      : { data: [], error: null };
    // Payment history was introduced after the initial C1 deployment. A
    // missing table must not make validated invoice detail unreadable; the
    // invoice remains available with zero payment history until migration is applied.
    if (paymentResult.error && !/relation .*c1_payment_transactions|schema cache|does not exist/i.test(String(paymentResult.error.message ?? paymentResult.error))) throw paymentResult.error;
    const paymentsByInvoice = new Map<string, Array<{ payment_id: string; amount: number; payment_date: string; reference_no: string }>>();
    for (const payment of paymentResult.data ?? []) {
      const key = String(payment.invoice_number).trim().toLowerCase();
      const list = paymentsByInvoice.get(key) ?? [];
      list.push({ payment_id: payment.payment_id, amount: Number(payment.amount) || 0, payment_date: payment.payment_date, reference_no: payment.reference_no });
      paymentsByInvoice.set(key, list);
    }
    const mappedInvoices = invoices.map((row): CustomerInvoice => {
      const payments = paymentsByInvoice.get(String(row.invoice_number).trim().toLowerCase()) ?? [];
      const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const outstanding = Number(row.outstanding_amount) || 0;
      return {
        invoice_id: String(row.id),
        customer_id: result.customer!.customerId,
        invoice_number: row.invoice_number,
        bl_number: row.mawb ?? undefined,
        description: row.job_number ?? undefined,
        due_date: row.due_date,
        amount: outstanding + paidAmount,
        paid_amount: paidAmount,
        remaining_amount: Math.max(outstanding - paidAmount, 0),
        payment_date: payments[0]?.payment_date,
        payment_status: outstanding - paidAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
        bulk_close_status: row.bulk_close_status ?? 'PENDING',
        created_at: row.created_at,
        payments,
      };
    });
    if (!options.overdueOnly) return mappedInvoices;
    const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
    return mappedInvoices.filter((invoice) =>
      invoice.bulk_close_status === 'PENDING'
      && invoice.due_date < asOf
      && Number(invoice.remaining_amount ?? 0) > 0,
    );
  } catch (error) {
    console.error(`Error querying Supabase invoices for ${customerId}:`, error);
    throw error;
  }
}

export async function recordPaymentInSupabase(input: {
  customerId: string;
  invoiceNumber: string;
  amount: number;
  paymentDate: string;
  referenceNo: string;
  enteredBy: string;
}) {
  const invoices = await fetchInvoicesFromSupabase(input.customerId, { includeClosed: true });
  const invoice = invoices.find((item) => item.invoice_number.trim().toLowerCase() === input.invoiceNumber.trim().toLowerCase());
  if (!invoice) return { success: false as const, code: 'INVOICE_NOT_FOUND', message: 'Invoice tidak ditemukan pada data tervalidasi.' };
  const remaining = Number(invoice.remaining_amount ?? invoice.amount);
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { success: false as const, code: 'INVALID_AMOUNT', message: 'Nominal pembayaran harus lebih besar dari nol.' };
  if (input.amount > remaining) return { success: false as const, code: 'PAYMENT_EXCEEDS_OUTSTANDING', message: 'Nominal pembayaran melebihi outstanding invoice.' };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('c1_record_payment', {
    p_customer_id: String(invoice.customer_id),
    p_invoice_number: invoice.invoice_number,
    p_amount: input.amount,
    p_payment_date: input.paymentDate,
    p_reference_no: input.referenceNo.trim(),
    p_entered_by: input.enteredBy,
  });
  if (error) {
    const message = String(error.message ?? 'Payment write failed');
    const code = message.split(':', 1)[0];
    if (code === 'PAYMENT_EXCEEDS_OUTSTANDING' || code === 'INVALID_AMOUNT' || code === 'INVALID_PAYMENT') {
      return { success: false as const, code, message: message.slice(code.length + 1).trim() };
    }
    throw error;
  }
  return { success: true as const, payment: data };
}

/** Perform Bulk Close on Supabase invoice_detail table. */
export async function bulkCloseInvoicesInSupabase(customerId: string, invoiceIds?: string[]) {
  try {
    const supabase = getSupabaseClient();
    let query = supabase.from('invoice_detail').update({ bulk_close_status: 'CLOSED' }).eq('customer_id', customerId);
    if (invoiceIds && invoiceIds.length > 0 && !invoiceIds.includes('ALL_PENDING')) query = query.in('invoice_id', invoiceIds);
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

/** Fetch statement of account for customer from Supabase DB. */
export async function fetchStatementFromSupabase(customerId: string): Promise<StatementOfAccountData | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: cust, error: custErr } = await supabase.from('customer').select('*').or(`customer_id.eq.${customerId},customer_name.ilike.%${customerId}%`).single();
    if (custErr || !cust) return null;
    const { data: invoices } = await supabase.from('invoice_detail').select('*').eq('customer_id', cust.customer_id);
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
      pic_account_officer: { name: cust.pic_name || 'Hendrawan Kusuma', phone: cust.pic_phone || '+62 21 5082 1199' },
      client_finance_contact: { name: `Finance Dept (${cust.customer_name})`, email: cust.finance_email || 'finance@customer.co.id' },
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
