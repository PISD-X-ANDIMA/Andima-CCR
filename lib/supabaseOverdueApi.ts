import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { OverdueInvoiceItem, OverdueKpiSummary, WarningLetterParams } from '@/types/overdue';
import { INITIAL_OVERDUE_INVOICES, INITIAL_OVERDUE_KPI } from './overdueData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufjbbwqaztgkqmpdmcyv.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

export const getSupabaseClient = () => {
  if (!supabaseKey) {
    throw new Error('Supabase server client is not configured. Set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
};

/**
 * Fetch Overdue Alerts & Receivables from Supabase database with fallback
 */
type OverdueQueryOptions = {
  startDate?: string;
  endDateExclusive?: string;
  onlyOverdue30?: boolean;
};

type StagingOutstanding = {
  id: string;
  document_id: string;
  invoice_number: string;
  customer_id?: string | null;
  customer_name: string;
  outstanding_amount: number | string;
  due_date: string;
};

type AlertDbRow = {
  id?: string | null;
  invoice_id?: string | null;
  customer_id?: string | null;
  due_date?: string | null;
  days_overdue?: number | null;
  alert_status?: string | null;
};

function daysOverdue(dueDate: string, now = new Date()) {
  const due = new Date(`${dueDate}T00:00:00Z`);
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000));
}

function inDateRange(value: string, options: OverdueQueryOptions) {
  return (!options.startDate || value >= options.startDate) && (!options.endDateExclusive || value < options.endDateExclusive);
}

/**
 * Single source of truth for overdue invoices used by both dashboards.
 * c1_overdue_alert is preferred; validated outstanding staging supplies the
 * invoice metadata and acts as a fallback when alert rows have not been built.
 */
export async function fetchOverdueAlertsFromSupabase(options: OverdueQueryOptions = {}, client?: SupabaseClient) {
  try {
    const supabase = client ?? getSupabaseClient();
    const { data: dbAlerts, error: alertErr } = await supabase
      .from('c1_overdue_alert')
      .select('*');

    const { data: dbAssignments } = await supabase
      .from('c1_assignment')
      .select('*');

    const { data: stagingRows } = await supabase
      .from('c1_outstanding_staging_rows')
      .select('id, document_id, invoice_number, customer_id, customer_name, outstanding_amount, due_date')
      .order('due_date', { ascending: true });

    const documentIds = [...new Set((stagingRows ?? []).map((row) => row.document_id).filter(Boolean))];
    let validatedDocumentIds = new Set<string>();
    if (documentIds.length) {
      const { data: documents } = await supabase
        .from('c1_document_uploads')
        .select('id')
        .in('id', documentIds)
        .eq('validation_status', 'validated');
      validatedDocumentIds = new Set((documents ?? []).map((document) => document.id));
    }

    const validatedRows = ((stagingRows ?? []) as StagingOutstanding[]).filter((row) => validatedDocumentIds.has(row.document_id));
    const stagingByInvoice = new Map(validatedRows.map((row) => [row.invoice_number.toLowerCase(), row]));
    const now = new Date();

    const fromAlertRows: OverdueInvoiceItem[] = (alertErr || !dbAlerts ? [] : dbAlerts as AlertDbRow[]).map((rec, idx) => {
      const staging = stagingByInvoice.get(String(rec.invoice_id ?? '').toLowerCase())
        || validatedRows.find((row) => row.customer_id === rec.customer_id && row.due_date === rec.due_date);
      const initialMatch = INITIAL_OVERDUE_INVOICES.find((inv) => inv.id === rec.invoice_id || inv.customer_id === rec.customer_id)
        || INITIAL_OVERDUE_INVOICES[idx % INITIAL_OVERDUE_INVOICES.length];
      const dueDate = rec.due_date || staging?.due_date || initialMatch.due_date;
      const assignment = dbAssignments?.find((item) => item.invoice_id === rec.invoice_id);
      const assignedTo = assignment?.assigned_to || initialMatch.pic_assigned;
      const overdueDays = rec.days_overdue ?? daysOverdue(dueDate, now);
      return {
        id: rec.invoice_id || staging?.invoice_number || initialMatch.id,
        invoice_number: staging?.invoice_number || initialMatch.invoice_number || String(rec.invoice_id ?? rec.id),
        customer_id: staging?.customer_id || rec.customer_id || initialMatch.customer_id,
        customer_name: staging?.customer_name || initialMatch.customer_name,
        npwp: initialMatch.npwp,
        branch: initialMatch.branch,
        branch_code: initialMatch.branch_code,
        due_date: dueDate,
        amount_overdue: staging ? Number(staging.outstanding_amount) : initialMatch.amount_overdue,
        payment_note: initialMatch.payment_note,
        days_overdue: overdueDays,
        risk_status: (rec.alert_status || initialMatch.risk_status) as OverdueInvoiceItem["risk_status"],
        pic_assigned: assignedTo,
        pic_initials: assignedTo ? assignedTo.split(' ').map((name: string) => name[0]).join('').slice(0, 2).toUpperCase() : initialMatch.pic_initials,
        action_type: initialMatch.action_type,
        contact_person: initialMatch.contact_person,
        last_log: initialMatch.last_log,
        route: initialMatch.route,
      };
    });

    const sourceRows = fromAlertRows.length ? fromAlertRows : validatedRows.map((row, idx) => {
      const initialMatch = INITIAL_OVERDUE_INVOICES[idx % INITIAL_OVERDUE_INVOICES.length];
      const overdueDays = daysOverdue(row.due_date, now);
      return {
        ...initialMatch,
        id: row.invoice_number,
        invoice_number: row.invoice_number,
        customer_id: row.customer_id || initialMatch.customer_id,
        customer_name: row.customer_name,
        due_date: row.due_date,
        amount_overdue: Number(row.outstanding_amount),
        days_overdue: overdueDays,
        pic_assigned: initialMatch.pic_assigned,
      };
    });

    const filtered = sourceRows
      .filter((invoice) => inDateRange(invoice.due_date, options))
      .filter((invoice) => invoice.days_overdue > 0)
      .filter((invoice) => !options.onlyOverdue30 || invoice.days_overdue > 30)
      .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.invoice_number.localeCompare(b.invoice_number));
    const uniqueInvoices = [...new Map(filtered.map((invoice) => [invoice.invoice_number.toLowerCase(), invoice])).values()];

    const invoices = uniqueInvoices.length || fromAlertRows.length || validatedRows.length ? uniqueInvoices : INITIAL_OVERDUE_INVOICES
      .filter((invoice) => inDateRange(invoice.due_date, options))
      .filter((invoice) => invoice.days_overdue > 0)
      .filter((invoice) => !options.onlyOverdue30 || invoice.days_overdue > 30)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));

    return { invoices, kpi: INITIAL_OVERDUE_KPI, fromDb: Boolean(fromAlertRows.length || validatedRows.length) };
  } catch (err) {
    console.error("Error querying Supabase overdue alerts:", err);
    return { invoices: INITIAL_OVERDUE_INVOICES, kpi: INITIAL_OVERDUE_KPI, fromDb: false };
  }
}

/**
 * Assign PIC to an overdue invoice (Inserts to c1_assignment table)
 */
export async function assignPicInSupabase(invoiceId: string, assignedTo: string, assignedBy: string = 'System Admin', notes: string = 'Assignment changed') {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('c1_assignment')
      .insert({
        invoice_id: invoiceId,
        assigned_to: assignedTo,
        assigned_by: assignedBy,
        follow_up_status: 'ASSIGNED',
        notes: notes,
      })
      .select();

    if (error) {
      console.error("Supabase assignment error:", error);
      return { success: false, error: error.message };
    }
    return { success: true, record: data?.[0] };
  } catch (err: any) {
    console.error("Supabase assignment exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger Batch MID Feed Escalation (Inserts to c1_mid_feed table)
 */
export async function triggerBatchMidFeedEscalationInSupabase(invoiceIds: string[]) {
  try {
    const supabase = getSupabaseClient();
    const feedRecords = invoiceIds.map(id => ({
      invoice_id: id,
      customer_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01',
      days_overdue: 60,
      alert_status: 'MID_ESCALATED',
      assignment_summary: { batch: true, timestamp: new Date().toISOString() },
    }));

    const { data, error } = await supabase
      .from('c1_mid_feed')
      .insert(feedRecords)
      .select();

    if (error) {
      console.error("Supabase MID feed error:", error);
      return { success: false, error: error.message };
    }
    return { success: true, count: data?.length || 0 };
  } catch (err: any) {
    console.error("Supabase MID feed exception:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Request Async Export File (Inserts to c1_export_request and c1_export_file tables)
 */
export async function requestExportFileInSupabase(format: 'PDF' | 'XLSX' | 'CSV', requestedBy: string, periodFilter: any) {
  try {
    const supabase = getSupabaseClient();
    const { data: reqData, error: reqErr } = await supabase
      .from('c1_export_request')
      .insert({
        requested_by: requestedBy,
        format: format,
        period_filter: periodFilter,
        status: 'PROCESSING',
      })
      .select()
      .single();

    if (reqErr || !reqData) {
      console.error("Supabase export request error:", reqErr);
      return { success: false, error: reqErr?.message };
    }

    // Insert corresponding export file record
    const { data: fileData, error: fileErr } = await supabase
      .from('c1_export_file')
      .insert({
        request_id: reqData.request_id,
        storage_reference: `exports/OVERDUE_ALERT_REPORT_${Date.now()}.${format.toLowerCase()}`,
        download_status: 'AVAILABLE',
      })
      .select()
      .single();

    if (fileErr) {
      console.error("Supabase export file error:", fileErr);
    }

    return {
      success: true,
      requestId: reqData.request_id,
      fileId: fileData?.file_id,
      storageRef: fileData?.storage_reference,
    };
  } catch (err: any) {
    console.error("Supabase export request exception:", err);
    return { success: false, error: err.message };
  }
}
