import { NextRequest, NextResponse } from 'next/server';
import { requireSession, apiError } from '@/lib/server/http';
import { getCcrProfile, canUseCcr } from '@/lib/server/authorization';
import { fetchMidEscalationsFromSupabase } from '@/lib/supabaseMidApi';

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (session.error) return session.error;

  const profile = await getCcrProfile(session.client, session.user!.id);
  if (!canUseCcr(profile)) {
    return apiError("CCR access is required.", 403, "FORBIDDEN");
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? undefined;
    const priority = searchParams.get('priority') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const page = Number(searchParams.get('page') ?? '1') || 1;
    const limit = Number(searchParams.get('limit') ?? '20') || 20;

    const result = await fetchMidEscalationsFromSupabase({
      status,
      priority,
      search,
      page,
      limit,
    });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Failed to get MID escalations:', error);
    return apiError('Unable to process request.', 500, 'INTERNAL_SERVER_ERROR');
  }
}
