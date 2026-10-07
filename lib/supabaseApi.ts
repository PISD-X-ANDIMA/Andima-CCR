import { createClient } from '@supabase/supabase-js';
import { CustomerAnalyticsItem, InvoiceDetail, StatementOfAccountData } from '@/types/customer';
import { INITIAL_CUSTOMERS, INITIAL_KPI_SUMMARY, STATEMENT_AURORA_BLUE } from './customerData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufjbbwqaztgkqmpdmcyv.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const getSupabaseClient = () => {
  if (!supabaseKey) {
    throw new Error('Supabase customer analytics client is not configured. Set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
};

/**
 * Fetch customer analytics from Supabase database with fallback to seed data
 */
export async function fetchCustomerAnalyticsFromSupabase() {
  try {
    const supabase = getSupabaseClient();
    const { data: customerRows, error: custError } = await supabase
      .from('customer')
      .select('*');

    if (custError || !customerRows || customerRows.length === 0) {
      return { customers: INITIAL_CUSTOMERS, kpi: INITIAL_KPI_SUMMARY, fromDb: false };
    }

    // Fetch monthly metrics for all customers if available
    const { data: metricsRows } = await supabase
      .from('customer_monthly_metrics')
      .select('*');

    // Fetch active invoices count per customer if available
    const { data: invoiceRows } = await supabase
      .from('invoice_detail')
      .select('customer_id, payment_status, bulk_close_status');

    const mappedCustomers: CustomerAnalyticsItem[] = customerRows.map((c: any, idx: number) => {
      const custMetrics = metricsRows?.filter((m: any) => m.customer_id === c.customer_id) || [];
      const custInvoices = invoiceRows?.filter((inv: any) => inv.customer_id === c.customer_id) || [];

      // Calculate aggregated metrics
      const latestMetric = custMetrics[custMetrics.length - 1];
      const salesProfit = latestMetric ? Number(latestMetric.sales_profit) : 350000000 + (idx * 50000000);
      const cost = latestMetric ? Number(latestMetric.cost) : 300000000 + (idx * 40000000);
      const totalOutstanding = latestMetric ? Number(latestMetric.total_outstanding) : 500000000 + (idx * 60000000);

      const displayId = c.customer_id.startsWith('CUST-')
        ? c.customer_id
        : `CUST-${String(idx + 1).padStart(4, '0')}`;

      return {
        id: displayId,
        customer_name: c.customer_name,
        npwp: c.npwp || '01.345.890.1',
        location_detail: `${c.branch} Port Area`,
        branch: c.branch,
        branch_office_badge: c.branch === 'Jakarta' ? 'Jakarta Pusat' : c.branch,
        sales_profit: salesProfit,
        sales_profit_trend: 'up',
        cost: cost,
        total_outstanding: totalOutstanding,
        credit_limit: Number(c.credit_limit || 1000000000),
        payment_accuracy: Number(c.payment_accuracy || 90.0),
        active_invoices_count: custInvoices.length > 0 ? custInvoices.length : 15,
        dso_trend: {
          may_2026: Number(c.dso_days || 25) + 3,
          june_2026: Number(c.dso_days || 25) + 1,
          july_2026: Number(c.dso_days || 25),
        },
        pic: {
          name: c.pic_name || 'Account Executive',
          phone: c.pic_phone || '+62 21 5082 1199',
        },
        connected_routes: [
          { route: `${c.branch} - Regional Port`, volume: '30 TEUs / bln' },
        ],
      };
    });

    // Calculate KPI Summary
    const totalActiveCustomers = mappedCustomers.length;
    const branchBreakdown = {
      jkt: mappedCustomers.filter((c) => c.branch === 'Jakarta').length,
      sub: mappedCustomers.filter((c) => c.branch === 'Surabaya').length,
      smg: mappedCustomers.filter((c) => c.branch === 'Semarang').length,
      bpn: mappedCustomers.filter((c) => c.branch === 'Balikpapan').length,
      medan: mappedCustomers.filter((c) => c.branch === 'Medan').length,
    };

    const avgDso = mappedCustomers.reduce((acc, curr) => acc + curr.dso_trend.july_2026, 0) / (totalActiveCustomers || 1);
    const topCust = [...mappedCustomers].sort((a, b) => b.sales_profit - a.sales_profit)[0];

    const kpiSummary = {
      totalActiveCustomers,
      branchBreakdown,
      averagePaymentCycle: Number(avgDso.toFixed(1)),
      paymentCycleDiffVsQ2: -2.1,
      highRiskOutstanding: 4850000,
      highRiskAccountCount: 4,
      highRiskGrowthPercent: 6.4,
      topContributingCustomer: {
        name: topCust?.customer_name || 'Aurora Blue',
        rank: 1,
        totalLogisticsVolume: topCust?.sales_profit || 4200000000,
      },
    };

    return { customers: mappedCustomers, kpi: kpiSummary, fromDb: true };
  } catch (error) {
    console.error('Error querying Supabase customer analytics:', error);
    return { customers: INITIAL_CUSTOMERS, kpi: INITIAL_KPI_SUMMARY, fromDb: false };
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
