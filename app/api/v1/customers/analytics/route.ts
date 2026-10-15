import { requireSession } from "@/lib/server/http";
import { NextRequest, NextResponse } from 'next/server';
import { fetchCustomerAnalyticsFromSupabase } from '@/lib/supabaseApi';
import { getCcrProfile, canUseCcr } from '@/lib/server/authorization';

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  const timing = (response: NextResponse, phases: Record<string, number>) => {
    const total = Math.round(performance.now() - startedAt);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Server-Timing', [...Object.entries(phases).map(([name, duration]) => `${name};dur=${Math.round(duration)}`), `total;dur=${total}`].join(', '));
    response.headers.set('X-Analytics-Duration-Ms', String(total));
    return response;
  };
  const authStarted = performance.now();
  const session = await requireSession();
  if (session.error) return timing(session.error, { auth: performance.now() - authStarted });
  const profile = await getCcrProfile(session.client, session.user!.id, { includeOrgDetails: false });
  const authDuration = performance.now() - authStarted;
  if (!canUseCcr(profile)) {
    return timing(NextResponse.json({ error: { code: 'FORBIDDEN', message: 'CCR access is required.' } }, { status: 403 }), { auth: authDuration });
  }
  try {
    const { searchParams } = new URL(req.url);
<<<<<<< HEAD
    const branch = searchParams.get('branch');
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const paymentCycle = searchParams.get('paymentCycle');
    const sortBy = searchParams.get('sortBy') || 'sales_profit';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '5', 10);
    const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
    const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 5;

    const rpcStarted = performance.now();
    const { customers, kpi, totalItems } = await fetchCustomerAnalyticsFromSupabase({
      branch,
      search,
      paymentCycle,
      sortBy,
      sortOrder,
      page,
      limit,
=======
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
>>>>>>> origin/feat/c1-membantuwebdev
    });
    const rpcDuration = performance.now() - rpcStarted;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const mappingStarted = performance.now();

    const response = NextResponse.json(
      {
        kpiSummary: kpi,
        data: customers,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems,
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
<<<<<<< HEAD
    const mappingDuration = performance.now() - mappingStarted;
    return timing(response, { auth: authDuration, rpc: rpcDuration, mapping: mappingDuration });
  } catch {
    return timing(NextResponse.json(
=======
  } catch (error) {
    console.error("Customer analytics query failed:", error);
    return NextResponse.json(
>>>>>>> origin/feat/c1-membantuwebdev
      { error: 'Internal Server Error', message: 'Unable to process request.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    ), { auth: authDuration });
  }
}
