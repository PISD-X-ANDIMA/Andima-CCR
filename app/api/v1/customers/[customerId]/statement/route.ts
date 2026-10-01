import { NextRequest, NextResponse } from 'next/server';
import { STATEMENT_AURORA_BLUE, INITIAL_CUSTOMERS } from '@/lib/customerData';
import { fetchStatementFromSupabase } from '@/lib/supabaseApi';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;

    // Check Supabase database first
    const dbStatement = await fetchStatementFromSupabase(customerId);
    if (dbStatement) {
      return NextResponse.json(dbStatement, { status: 200 });
    }

    // Check if customer ID matches Aurora Blue Group or generic
    if (customerId === 'CUST-0192' || customerId === 'aurora-blue') {
      return NextResponse.json(STATEMENT_AURORA_BLUE, { status: 200 });
    }

    const foundCust = INITIAL_CUSTOMERS.find((c) => c.id === customerId);

    if (foundCust) {
      return NextResponse.json(
        {
          customer_id: foundCust.id,
          customer_name: foundCust.location_detail || foundCust.customer_name,
          legal_entity: foundCust.customer_name,
          npwp: foundCust.npwp || '01.999.888.7-011.000',
          category: 'Multimodal Ocean & Inland Freight',
          segmentation: 'Enterprise Corporate Shipper',
          status_badge: 'Kredit Aktif - Batas Toleransi Normal',
          main_hub: `${foundCust.branch} Hub Terminal`,
          pic_account_officer: foundCust.pic,
          client_finance_contact: {
            name: `Finance Manager (${foundCust.customer_name})`,
            email: `finance@${foundCust.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.co.id`,
          },
          credit_limit: foundCust.credit_limit,
          review_cycle: 'Aktif s/d Des 2026',
          outstanding_balance: foundCust.total_outstanding,
          credit_usage_percent: Number(
            ((foundCust.total_outstanding / foundCust.credit_limit) * 100).toFixed(2)
          ),
          overdue_balance: 0,
          overdue_status_text: 'Semua dalam termin lancar',
          payment_accuracy: foundCust.payment_accuracy,
          avg_dso_days: foundCust.dso_trend.july_2026,
          top_days_policy: 30,
          mutations: [
            {
              trans_date: '01-07-2026',
              reference_no: 'OPEN-BAL-07',
              cargo_description: 'Saldo Awal Piutang',
              debit: 0,
              credit: 0,
              cumulative_balance: foundCust.total_outstanding,
              status: 'Saldo Awal',
            },
            {
              trans_date: '15-07-2026',
              reference_no: `INV-2026/07-9500`,
              bl_number: `BL-${foundCust.branch.slice(0, 3).toUpperCase()}-26-1020`,
              cargo_description: `Freight Multimodal Delivery ${foundCust.branch}`,
              due_date: '14-08-2026',
              debit: foundCust.sales_profit,
              credit: 0,
              cumulative_balance: foundCust.total_outstanding + foundCust.sales_profit,
              status: 'Belum Lunas',
              doc_action: 'Lihat INV',
            },
          ],
          bank_reconciliations: [
            {
              bank_name: 'Bank Mandiri Escrow Direct',
              account_no: 'TRF #559102',
              reference_no: '15 Juli 2026 • Verified ERP Module',
              date: '15-07-2026',
              amount: foundCust.sales_profit,
              matched_invoice: `Matched INV-2026/07-9500`,
            },
          ],
        },
        { status: 200 }
      );
    }

    return NextResponse.json(STATEMENT_AURORA_BLUE, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
