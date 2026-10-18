import { supabase } from '@/lib/supabaseClient';
import { sanitizeActivityDescription, sanitizeActivitySearch, type ActivityAction } from '@/lib/activity';
import { UAParser } from 'ua-parser-js';

type Profile = {
  full_name: string | null;
  email: string | null;
  departement_id: string | null;
  position: { title: string | null } | null;
  department: { name: string | null } | null;
};
type ActivityRecord = {
  id: string; action: ActivityAction; description: string | null;
  ip_address: string | null; user_agent: string | null; created_at: string;
  profile: Profile | null;
};
export type ActivityLog = {
  id: string; action: ActivityAction; name: string; email: string;
  department: string; departmentId: string | null; role: string;
  ipAddress: string; userAgent: string; description: string; createdAt: string;
};
export type ActivityFilters = {
  page?: number; pageSize?: number; search?: string; action?: ActivityAction | '';
  departmentId?: string; ascending?: boolean;
  startDate?: string; endDate?: string;
};

export function getActivityDateRange(startDate = '', endDate = '') {
  function midnight(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tanggal tidak valid.');
    const time = Date.parse(`${value}T00:00:00+07:00`);
    if (!Number.isFinite(time) || new Date(time + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) !== value) {
      throw new Error('Tanggal tidak valid.');
    }
    return time;
  }
  const start = startDate ? midnight(startDate) : undefined;
  const end = endDate ? midnight(endDate) : undefined;
  if (start !== undefined && end !== undefined && start > end) throw new Error('Tanggal akhir harus sama atau setelah tanggal mulai.');
  return {
    start: start === undefined ? undefined : new Date(start).toISOString(),
    endExclusive: end === undefined ? undefined : new Date(end + 24 * 60 * 60 * 1000).toISOString(),
  };
}
const activitySelect = `id, action, description, ip_address, user_agent, created_at,
  profile:b2_register!register_id(full_name, email, departement_id,
    position:d3_positions!position_id(title), department:d3_departments!departement_id(name))`;

export function formatUserAgent(value: string | null): string {
  if (!value) return '-';
  const browser = new UAParser(value).getBrowser();
  return browser.name ? [browser.name, browser.major].filter(Boolean).join(' ') : 'Unknown';
}

function mapActivity(row: ActivityRecord): ActivityLog {
  return {
    id: row.id, action: row.action, name: row.profile?.full_name || '-',
    email: row.profile?.email || '-', department: row.profile?.department?.name || '-',
    departmentId: row.profile?.departement_id ?? null, role: row.profile?.position?.title || '-',
    ipAddress: row.ip_address || '-', userAgent: formatUserAgent(row.user_agent),
    description: row.description || '-', createdAt: row.created_at,
  };
}

// Prepare ordinary activity delivery without blocking the caller.
export async function prepareActivity(action: ActivityAction, description: string): Promise<() => void> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw new Error('Session tidak tersedia.');
    if (!session) return () => {};
    const token = session.access_token;
    const safeDescription = sanitizeActivityDescription(description);
    return () => {
      try {
        void fetch('/api/activity', {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, description: safeDescription }), keepalive: true,
        }).then(async (response) => {
          if (!response.ok) {
            const body = await response.json().catch(() => null);
            const code = typeof body?.code === 'string' && /^[A-Z0-9_]{5,50}$/.test(body.code) ? body.code : 'UNKNOWN';
            console.error('Gagal mencatat Log Activity:', response.status, code);
          }
        }).catch(() => console.error('Gagal mengirim Log Activity.'));
      } catch { console.error('Gagal mengirim Log Activity.'); }
    };
  } catch {
    console.error('Gagal menyiapkan Log Activity.');
    return () => {};
  }
}

export function trackActivity(action: ActivityAction, description: string): void {
  void prepareActivity(action, description).then((send) => send()).catch(() => console.error('Gagal mencatat Log Activity.'));
}

export async function logoutWithActivity(description: string, scope: 'global' | 'local' = 'global') {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw new Error('Session tidak tersedia.');
    if (session) {
      // Log Login is updated independently; a failure here must not affect Log Activity or logout.
      try {
        await fetch('/api/login-log/logout', {
          method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` },
          keepalive: true, signal: AbortSignal.timeout(4000),
        });
      } catch { console.error('Gagal mengirim pencatatan logout Log Login.'); }

      // The server authenticates before revoking the session and logs only after success.
      const response = await fetch('/api/activity', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'Logout', description: sanitizeActivityDescription(description), logoutScope: scope }),
        keepalive: true, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) console.error('Gagal mencatat logout di server:', response.status);
    }
  } catch { console.error('Gagal mengirim Log Activity logout.'); }
  // Clears the local session too. Supabase tolerates an already-revoked session.
  // If the endpoint failed, this still performs the user's requested logout.
  return supabase.auth.signOut({ scope });
}

export function matchesActivity(activity: ActivityLog, filters: ActivityFilters): boolean {
  const search = sanitizeActivitySearch(filters.search ?? '').toLowerCase();
  const range = getActivityDateRange(filters.startDate, filters.endDate);
  const time = Date.parse(activity.createdAt);
  return (!filters.action || activity.action === filters.action)
    && (!filters.departmentId || activity.departmentId === filters.departmentId)
    && (!range.start || time >= Date.parse(range.start))
    && (!range.endExclusive || time < Date.parse(range.endExclusive))
    && (!search || [activity.name, activity.email, activity.description, activity.action]
      .some((value) => value.toLowerCase().includes(search)));
}

export async function getActivities({ page = 1, pageSize = 10, search = '', action = '', departmentId, ascending = false, startDate = '', endDate = '' }: ActivityFilters = {}) {
  const size = [10, 25, 50].includes(pageSize) ? pageSize : 10;
  const start = (Math.max(1, Math.floor(page)) - 1) * size;
  const term = sanitizeActivitySearch(search);
  const range = getActivityDateRange(startDate, endDate);
  let query = supabase.from('b1_activity').select(activitySelect, { count: 'exact' });
  if (range.start) query = query.gte('created_at', range.start);
  if (range.endExclusive) query = query.lt('created_at', range.endExclusive);
  if (departmentId) {
    const ids = await findProfileIds('', departmentId);
    if (!ids.length) return { rows: [], total: 0 };
    query = query.in('register_id', ids);
  }
  if (term) {
    const ids = await findProfileIds(term, departmentId);
    const clauses = [`description.ilike.*${term}*`, `action.ilike.*${term}*`];
    // IP is inet: profile, action and description are searchable without casting it.
    if (ids.length) clauses.push(`register_id.in.(${ids.join(',')})`);
    query = query.or(clauses.join(','));
  }
  if (action) query = query.eq('action', action);
  const { data, error, count } = await query.order('created_at', { ascending }).order('id', { ascending }).range(start, start + size - 1);
  if (error) throw new Error(error.message);
  return { rows: ((data ?? []) as unknown as ActivityRecord[]).map(mapActivity), total: count ?? 0 };
}

async function findProfileIds(search: string, departmentId?: string): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from('b2_register').select('id').order('id').range(offset, offset + 499);
    if (departmentId) query = query.eq('departement_id', departmentId);
    if (search) query = query.or(`full_name.ilike.*${search}*,email.ilike.*${search}*`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    ids.push(...(data ?? []).map((profile) => profile.id));
    if (!data || data.length < 500) return ids;
  }
}

export async function getActivityById(id: string): Promise<ActivityLog | null> {
  const { data, error } = await supabase.from('b1_activity').select(activitySelect).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapActivity(data as unknown as ActivityRecord) : null;
}
