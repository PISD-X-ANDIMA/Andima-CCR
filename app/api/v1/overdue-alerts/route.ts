import { requireSession, checkOrigin } from "@/lib/server/http";
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchOverdueAlertsFromSupabase,
  assignPicInSupabase,
  triggerBatchMidFeedEscalationInSupabase,
} from '@/lib/supabaseOverdueApi';

export async function GET(req: NextRequest) {
  const session = await requireSession(); if (session.error) return session.error;
  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status');
    const agingBucket = searchParams.get('agingBucket');
    const onlyOverdue30 = searchParams.get('onlyOverdue30') !== 'false';

    const { invoices, kpi, fromDb } = await fetchOverdueAlertsFromSupabase({ onlyOverdue30 });
    let filtered = [...invoices];

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
  } catch {
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Unable to process request.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSession(); if (session.error) return session.error;
  const originError = checkOrigin(req); if (originError) return originError;
  try {
    const body = await req.json();
    const { action, invoiceId, assignedTo, notes, invoiceIds } = body;

    if (action === 'ASSIGN_PIC') {
      const res = await assignPicInSupabase(invoiceId, assignedTo, session.user!.id, notes);
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
  } catch {
    return NextResponse.json(
      { error: 'Failed to process overdue action', message: 'Unable to process request.' },
      { status: 500 }
    );
  }
}
