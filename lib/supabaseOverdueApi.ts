import { createClient } from '@supabase/supabase-js';
import { OverdueInvoiceItem, OverdueKpiSummary, WarningLetterParams } from '@/types/overdue';
import { INITIAL_OVERDUE_INVOICES, INITIAL_OVERDUE_KPI } from './overdueData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufjbbwqaztgkqmpdmcyv.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const getSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
};

/**
 * Fetch Overdue Alerts & Receivables from Supabase database with fallback
 */
export async function fetchOverdueAlertsFromSupabase() {
  try {
    const supabase = getSupabaseClient();
    const { data: dbAlerts, error: alertErr } = await supabase
      .from('c1_overdue_alert')
      .select('*');

    const { data: dbAssignments } = await supabase
      .from('c1_assignment')
      .select('*');

    if (alertErr || !dbAlerts || dbAlerts.length === 0) {
      return { invoices: INITIAL_OVERDUE_INVOICES, kpi: INITIAL_OVERDUE_KPI, fromDb: false };
    }

    // Merge DB alerts with assignments and initial invoice meta
    const mergedInvoices: OverdueInvoiceItem[] = dbAlerts.map((rec: any, idx: number) => {
      const initialMatch = INITIAL_OVERDUE_INVOICES.find(inv => inv.id === rec.invoice_id || inv.customer_id === rec.customer_id) || INITIAL_OVERDUE_INVOICES[idx % INITIAL_OVERDUE_INVOICES.length];
      const assignMatch = dbAssignments?.find(a => a.invoice_id === rec.invoice_id);

      return {
        id: rec.invoice_id || initialMatch.id,
        invoice_number: initialMatch.invoice_number,
        customer_id: rec.customer_id || initialMatch.customer_id,
        customer_name: initialMatch.customer_name,
        npwp: initialMatch.npwp,
        branch: initialMatch.branch,
        branch_code: initialMatch.branch_code,
        due_date: rec.due_date || initialMatch.due_date,
        amount_overdue: initialMatch.amount_overdue,
        payment_note: initialMatch.payment_note,
        days_overdue: rec.days_overdue ?? initialMatch.days_overdue,
        risk_status: rec.alert_status || initialMatch.risk_status,
        pic_assigned: assignMatch ? assignMatch.assigned_to : initialMatch.pic_assigned,
        pic_initials: assignMatch ? assignMatch.assigned_to.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : initialMatch.pic_initials,
        action_type: initialMatch.action_type,
        contact_person: initialMatch.contact_person,
        last_log: initialMatch.last_log,
        route: initialMatch.route,
      };
    });

    return { invoices: mergedInvoices, kpi: INITIAL_OVERDUE_KPI, fromDb: true };
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
