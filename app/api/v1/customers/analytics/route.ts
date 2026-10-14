import { requireSession } from "@/lib/server/http";
import { NextRequest, NextResponse } from 'next/server';
import { CustomerAnalyticsItem } from '@/types/customer';
import { fetchCustomerAnalyticsFromSupabase } from '@/lib/supabaseApi';
import { getCcrProfile, canUseCcr } from '@/lib/server/authorization';

export async function GET(req: NextRequest) {
  const session = await requireSession(); if (session.error) return session.error;
  if (!canUseCcr(await getCcrProfile(session.client, session.user!.id))) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'CCR access is required.' } }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const sortBy = searchParams.get('sortBy') || 'sales_profit'; // 'sales_profit' | 'cost' | 'total_outstanding' | 'customer_name'
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    const { customers, kpi } = await fetchCustomerAnalyticsFromSupabase(session.client);
    let filtered: CustomerAnalyticsItem[] = [...customers];

    // Filter by search query (name or NPWP)
    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.customer_name.toLowerCase().includes(search) ||
          c.npwp.toLowerCase().includes(search) ||
          c.location_detail.toLowerCase().includes(search) ||
          c.id.toLowerCase().includes(search)
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      let valA: string | number = a.sales_profit ?? Number.NEGATIVE_INFINITY;
      let valB: string | number = b.sales_profit ?? Number.NEGATIVE_INFINITY;

      if (sortBy === 'cost') {
        valA = a.cost ?? Number.NEGATIVE_INFINITY;
        valB = b.cost ?? Number.NEGATIVE_INFINITY;
      } else if (sortBy === 'total_outstanding') {
        valA = a.total_outstanding ?? Number.NEGATIVE_INFINITY;
        valB = b.total_outstanding ?? Number.NEGATIVE_INFINITY;
      } else if (sortBy === 'customer_name') {
        valA = a.customer_name;
        valB = b.customer_name;
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(String(valB)) : String(valB).localeCompare(valA);
      }
      return sortOrder === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json(
      {
        kpiSummary: kpi,
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
  } catch (error) {
    console.error("Customer analytics query failed:", error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Unable to process request.' },
      { status: 500 }
    );
  }
}
