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
    const { customers, kpi, totalItems } = await fetchCustomerAnalyticsFromSupabase({ branch, search, paymentCycle, sortBy, sortOrder, page, limit });
    const rpcDuration = performance.now() - rpcStarted;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const response = NextResponse.json({
      kpiSummary: kpi,
      data: customers,
      pagination: { currentPage: page, totalPages, totalItems, itemsPerPage: limit },
    }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
    return timing(response, { auth: authDuration, rpc: rpcDuration, mapping: 0 });
  } catch (error) {
    console.error('Customer analytics query failed:', error);
    return timing(NextResponse.json(
      { error: 'Internal Server Error', message: 'Unable to process request.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    ), { auth: authDuration });
  }
}
