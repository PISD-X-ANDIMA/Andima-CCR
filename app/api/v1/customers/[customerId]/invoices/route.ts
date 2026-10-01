import { NextRequest, NextResponse } from 'next/server';
import { AURORA_BLUE_INVOICES } from '@/lib/customerData';

// In-memory store for pending updates during session execution
let invoicesStore = [...AURORA_BLUE_INVOICES];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const bulkCloseStatus = searchParams.get('bulk_close_status');

    let result = invoicesStore.filter((inv) => inv.customer_id === customerId);

    // If generic customer id provided and no specific invoices found, default to template invoices
    if (result.length === 0) {
      result = [
        {
          invoice_id: `${customerId}-inv-1`,
          customer_id: customerId,
          invoice_number: `INV-2026/07-98${customerId.slice(-2)}`,
          bl_number: `BL-JKT-26-88${customerId.slice(-2)}`,
          description: 'Freight 40ft FCL Container Logistics',
          due_date: '2026-08-15',
          amount: 350000000,
          payment_status: 'UNPAID',
          bulk_close_status: 'PENDING',
        },
        {
          invoice_id: `${customerId}-inv-2`,
          customer_id: customerId,
          invoice_number: `INV-2026/07-99${customerId.slice(-2)}`,
          bl_number: `BL-JKT-26-89${customerId.slice(-2)}`,
          description: 'Handling & Terminal Storage Fees',
          due_date: '2026-08-20',
          amount: 150000000,
          payment_status: 'UNPAID',
          bulk_close_status: 'PENDING',
        },
      ];
    }

    if (status) {
      result = result.filter((inv) => inv.payment_status === status);
    }
    if (bulkCloseStatus) {
      result = result.filter((inv) => inv.bulk_close_status === bulkCloseStatus);
    }

    return NextResponse.json(
      {
        customerId,
        totalInvoices: result.length,
        invoices: result,
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const body = await req.json();
    const { invoiceIds, action } = body; // action: 'BULK_CLOSE'

    if (action === 'BULK_CLOSE' || !action) {
      // Update targeted invoice store
      invoicesStore = invoicesStore.map((inv) => {
        if (
          inv.customer_id === customerId &&
          (!invoiceIds || invoiceIds.length === 0 || invoiceIds.includes(inv.invoice_id))
        ) {
          return {
            ...inv,
            bulk_close_status: 'CLOSED',
          };
        }
        return inv;
      });

      return NextResponse.json(
        {
          success: true,
          message: `Bulk close operation completed successfully for customer ${customerId}.`,
          updatedCustomerId: customerId,
          closedInvoiceIds: invoiceIds || ['ALL_PENDING'],
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Invalid action provided' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to perform bulk close operation', message: error.message },
      { status: 500 }
    );
  }
}
