import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_CUSTOMERS, INITIAL_KPI_SUMMARY } from '@/lib/customerData';
import { CustomerAnalyticsItem } from '@/types/customer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get('branch');
    const search = searchParams.get('search')?.toLowerCase() || '';
    const paymentCycle = searchParams.get('paymentCycle');
    const sortBy = searchParams.get('sortBy') || 'sales_profit'; // 'sales_profit' | 'cost' | 'total_outstanding' | 'customer_name'
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    let filtered: CustomerAnalyticsItem[] = [...INITIAL_CUSTOMERS];

    // Filter by branch
    if (branch && branch !== 'Semua Cabang' && branch !== 'all') {
      filtered = filtered.filter(
        (c) => c.branch.toLowerCase() === branch.toLowerCase()
      );
    }

    // Filter by search query (name or NPWP)
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(search) ||
          c.npwp.toLowerCase().includes(search) ||
          c.id.toLowerCase().includes(search)
      );
    }

    // Filter by payment cycle status if applicable
    if (paymentCycle && paymentCycle !== 'Semua Siklus Pembayaran') {
      if (paymentCycle === 'Lancar (< 30 Hari)') {
        filtered = filtered.filter((c) => c.dso_trend.july_2026 <= 30);
      } else if (paymentCycle === 'Overdue (> 30 Hari)') {
        filtered = filtered.filter((c) => c.dso_trend.july_2026 > 30);
      }
    }

    // Sorting
    filtered.sort((a, b) => {
      let valA: any = a.sales_profit;
      let valB: any = b.sales_profit;

      if (sortBy === 'cost') {
        valA = a.cost;
        valB = b.cost;
      } else if (sortBy === 'total_outstanding') {
        valA = a.total_outstanding;
        valB = b.total_outstanding;
      } else if (sortBy === 'customer_name') {
        valA = a.customer_name;
        valB = b.customer_name;
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json(
      {
        kpiSummary: INITIAL_KPI_SUMMARY,
        data: paginatedData,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalItems,
          itemsPerPage: limit,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
