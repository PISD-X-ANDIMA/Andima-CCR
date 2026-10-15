export type BranchLocation = 'Jakarta' | 'Semarang' | 'Surabaya' | 'Balikpapan' | 'Medan' | 'Tidak ditentukan';

export interface Customer {
  customer_id: string;
  customer_name: string;
  npwp?: string;
  branch: BranchLocation;
  active_status: boolean;
  credit_limit: number;
  payment_accuracy: number; // e.g. 94.2
  dso_days: number; // e.g. 22.4
  pic_name?: string;
  pic_phone?: string;
  finance_email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerMonthlyMetric {
  metric_id: string;
  customer_id: string;
  period_month: string; // YYYY-MM-01
  revenue: number;
  cost: number;
  sales_profit: number;
  total_outstanding: number;
  created_at?: string;
}

export interface InvoiceDetail {
  invoice_id: string;
  customer_id: string;
  invoice_number: string;
  bl_number?: string;
  description?: string;
  due_date: string;
  amount: number;
  payment_status: 'PAID' | 'UNPAID' | 'PARTIAL';
  bulk_close_status: 'PENDING' | 'CLOSED';
  created_at?: string;
}

export interface CustomerAnalyticsItem {
  id: string;
  customer_name: string;
  npwp: string;
  location_detail: string;
  branch: BranchLocation;
  branch_office_badge: string;
  sales_profit: number | null;
  revenue?: number | null;
  sales_profit_trend: 'up' | 'down' | 'flat';
  cost: number | null;
  total_outstanding: number | null;
  credit_limit: number;
  payment_accuracy: number;
  active_invoices_count: number;
  dso_trend: {
    may_2026: number;
    june_2026: number;
    july_2026: number;
  };
  pic: {
    name: string;
    phone: string;
  };
  connected_routes: Array<{
    route: string;
    volume: string;
  }>;
  job_count?: number;
  issue_count?: number;
  latest_job_number?: string | null;
  latest_activity_date?: string | null;
  latest_conversation?: string | null;
  assistance_count?: number;
}

export interface KpiSummary {
  totalCustomers?: number;
  period?: string | null;
  totalRevenue?: number | null;
  totalCost?: number | null;
  totalOutstanding?: number | null;
  overdueOutstanding?: number | null;
  totalActiveCustomers?: number;
  branchBreakdown?: { jkt: number; sub: number; smg: number; bpn: number; medan?: number };
  averagePaymentCycle?: number;
  paymentCycleDiffVsQ2?: number;
  highRiskOutstanding?: number;
  highRiskAccountCount?: number;
  highRiskGrowthPercent?: number;
  topContributingCustomer?: { name: string; rank: number; totalLogisticsVolume: number };
}

export interface AnalyticsResponse {
  kpiSummary: KpiSummary;
  data: CustomerAnalyticsItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface LedgerMutationItem {
  trans_date: string;
  reference_no: string;
  bl_number?: string;
  cargo_description: string;
  due_date?: string;
  debit: number;
  credit: number;
  cumulative_balance: number;
  status: string;
  doc_action?: string;
  raw_inv_id?: string;
}

export interface BankReconciliationItem {
  bank_name: string;
  account_no: string;
  reference_no: string;
  date: string;
  amount: number;
  matched_invoice: string;
}

export interface StatementOfAccountData {
  customer_id: string;
  customer_name: string;
  legal_entity: string;
  npwp: string;
  category: string;
  segmentation: string;
  status_badge: string;
  main_hub: string;
  pic_account_officer: {
    name: string;
    phone: string;
  };
  client_finance_contact: {
    name: string;
    email: string;
  };
  credit_limit: number;
  review_cycle: string;
  outstanding_balance: number;
  credit_usage_percent: number;
  overdue_balance: number;
  overdue_status_text: string;
  payment_accuracy: number;
  avg_dso_days: number;
  top_days_policy: number;
  mutations: LedgerMutationItem[];
  bank_reconciliations: BankReconciliationItem[];
}
