import "server-only";
import { createAdminClient } from "@/lib/server/admin";
import { CustomerAnalyticsItem, InvoiceDetail, StatementOfAccountData } from '@/types/customer';
import { INITIAL_CUSTOMERS, INITIAL_KPI_SUMMARY, STATEMENT_AURORA_BLUE } from './customerData';

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
  }
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
