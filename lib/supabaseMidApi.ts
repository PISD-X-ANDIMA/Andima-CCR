import { getSupabaseClient } from './supabaseApi';
import { MidEscalationRecord } from '@/types/overdue';

export interface MidEscalationsQuery {
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function fetchMidEscalationsFromSupabase(query: MidEscalationsQuery = {}) {
  const supabase = getSupabaseClient();
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const offset = (page - 1) * limit;

  let builder = supabase
    .from('c1_mid_escalations')
    .select('*', { count: 'exact' });

  if (query.status && query.status !== 'all') {
    builder = builder.eq('status', query.status);
  }
  if (query.priority && query.priority !== 'all') {
    builder = builder.eq('priority', query.priority);
  }
  if (query.search && query.search.trim()) {
    const q = query.search.trim();
    builder = builder.or(`invoice_id.ilike.%${q}%,judul_issue.ilike.%${q}%,customer_name.ilike.%${q}%,pic.ilike.%${q}%`);
  }

  const { data, count, error } = await builder
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching MID escalations:', error);
    return { data: [] as MidEscalationRecord[], total: 0, error: error.message };
  }

  return {
    data: (data ?? []) as MidEscalationRecord[],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit) || 1,
  };
}
