export type RiskStatus = 'LEGAL ESCALATION' | 'HIGH RISK' | 'WATCHLIST' | 'NEGOSIASI';

export interface OverdueAlertRecord {
  alert_id: string;
  invoice_id: string;
  customer_id: string;
  due_date: string;
  evaluation_date: string;
  days_overdue: number;
  overdue_alert: boolean;
  alert_status: RiskStatus | string;
  created_at?: string;
  updated_at?: string;
}

export interface AssignmentRecord {
  assignment_id: string;
  invoice_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  follow_up_status: string;
  notes?: string;
  created_at?: string;
}

export interface MidFeedRecord {
  feed_id: string;
  invoice_id: string;
  customer_id: string;
  days_overdue: number;
  alert_status: string;
  assignment_summary?: any;
  exported_at?: string;
}

export interface ExportRequestRecord {
  request_id: string;
  requested_by: string;
  format: 'PDF' | 'XLSX' | 'CSV';
  period_filter: any;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at?: string;
}

export interface ExportFileRecord {
  file_id: string;
  request_id: string;
  storage_reference: string;
  generated_at?: string;
  download_status: 'AVAILABLE' | 'EXPIRED';
}

export interface OverdueInvoiceItem {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  npwp: string;
  branch: string;
  branch_code: string;
  due_date: string;
  amount_overdue: number;
  payment_note?: string;
  days_overdue: number;
  risk_status: RiskStatus;
  pic_assigned?: string;
  pic_initials?: string;
  action_type: 'SP-1' | 'SP-2' | 'AUDIT' | 'TERMIN' | 'TUGASKAN';
  contact_person: {
    name: string;
    role: string;
    phone: string;
  };
  last_log: {
    date: string;
    time: string;
    text: string;
    logged_by: string;
  };
  route: string;
}

export interface OverdueKpiSummary {
  totalOverdueValue: number;
  totalOverdueValueGrowth: number;
  affectedInvoicesCount: number;
  criticalAgingValue: number;
  criticalAgingPercent: number;
  criticalDebtorsCount: number;
  avgDsoDelay: number;
  slaDiff: number;
  targetRecoveryDays: number;
  unassignedPicCount: number;
  unassignedFloatingValue: number;
}

export interface WarningLetterParams {
  escalationLevel: 'SP-1' | 'SP-2' | 'SP-3';
  registrationNumber: string;
  issueDate: string;
  deadlineDate: string;
  picName: string;
  escrowBank: 'mandiri' | 'bca';
  channels: {
    email: boolean;
    whatsapp: boolean;
    courier: boolean;
    portal: boolean;
  };
  attachSoa: boolean;
  attachStpf: boolean;
  internalNotes: string;
}
