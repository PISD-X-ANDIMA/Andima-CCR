import { NextRequest, NextResponse } from 'next/server';
import {
  fetchOverdueAlertsFromSupabase,
  assignPicInSupabase,
  triggerBatchMidFeedEscalationInSupabase,
} from '@/lib/supabaseOverdueApi';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status');
    const agingBucket = searchParams.get('agingBucket');
    const onlyOverdue30 = searchParams.get('onlyOverdue30') === 'true';

    const { invoices, kpi, fromDb } = await fetchOverdueAlertsFromSupabase();
    let filtered = [...invoices];

    if (onlyOverdue30) {
      filtered = filtered.filter(inv => inv.days_overdue > 30);
    }

    if (branch && branch !== 'Semua Cabang' && branch !== 'all') {
      filtered = filtered.filter(inv => inv.branch.toLowerCase() === branch.toLowerCase());
    }

    if (search) {
      filtered = filtered.filter(
        inv =>
          inv.invoice_number.toLowerCase().includes(search) ||
          inv.customer_name.toLowerCase().includes(search) ||
          inv.npwp.toLowerCase().includes(search)
      );
    }

    if (status && status !== 'Semua Status' && status !== 'all') {
      filtered = filtered.filter(inv => inv.risk_status.toLowerCase() === status.toLowerCase());
    }

    if (agingBucket && agingBucket !== 'Semua Bucket' && agingBucket !== 'all') {
      if (agingBucket === '1 - 30 Hari') {
        filtered = filtered.filter(inv => inv.days_overdue >= 1 && inv.days_overdue <= 30);
      } else if (agingBucket === '31 - 60 Hari') {
        filtered = filtered.filter(inv => inv.days_overdue >= 31 && inv.days_overdue <= 60);
      } else if (agingBucket === '> 60 Hari') {
        filtered = filtered.filter(inv => inv.days_overdue > 60);
      }
    }

    return NextResponse.json(
      {
        kpiSummary: kpi,
        totalItems: filtered.length,
        invoices: filtered,
        fromDb: fromDb,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, invoiceId, assignedTo, assignedBy, notes, invoiceIds } = body;

    if (action === 'ASSIGN_PIC') {
      const res = await assignPicInSupabase(invoiceId, assignedTo, assignedBy, notes);
      return NextResponse.json(
        {
          success: res.success,
          message: `PIC ${assignedTo} successfully assigned to invoice ${invoiceId}.`,
        },
        { status: 200 }
      );
    }

    if (action === 'BATCH_MID_ESCALATION') {
      const res = await triggerBatchMidFeedEscalationInSupabase(invoiceIds || []);
      return NextResponse.json(
        {
          success: res.success,
          message: `Batch MID Feed Escalation executed for ${res.count} overdue invoices.`,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process overdue action', message: error.message },
      { status: 500 }
    );
  }
}
