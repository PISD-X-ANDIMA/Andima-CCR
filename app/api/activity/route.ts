import { ACTIVITY_ACTIONS, sanitizeActivityDescription } from '@/lib/activity';
import { getClientIp } from '@/lib/get-client-ip';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function activityFailure(stage: string, databaseCode?: string) {
  const code = databaseCode && /^[A-Z0-9]{5,12}$/.test(databaseCode) ? databaseCode : undefined;
  console.error('Gagal mencatat Log Activity di server.', { stage, databaseCode: code });
  return Response.json({ error: 'Gagal mencatat aktivitas.', code: code ?? `ACTIVITY_${stage.toUpperCase()}_ERROR` }, { status: 500 });
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return Response.json({ error: 'Tidak terautentikasi.', code: 'ACTIVITY_TOKEN_MISSING' }, { status: 401 });

  let stage = 'config';
  let logoutCompleted = false;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    stage = 'auth';
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      const authCode = authError?.code?.toUpperCase();
      const code = authCode && /^[A-Z0-9_]{1,40}$/.test(authCode) ? `AUTH_${authCode}` : 'ACTIVITY_TOKEN_INVALID';
      console.error('Token Log Activity ditolak.', { code });
      return Response.json({ error: 'Tidak terautentikasi.', code }, { status: 401 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
      return Response.json({ error: 'JSON tidak valid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || !('action' in body) || !('description' in body)
      || !ACTIVITY_ACTIONS.some((action) => action === body.action)
      || typeof body.description !== 'string' || !body.description.trim() || body.description.length > 500) {
      return Response.json({ error: 'Action atau description tidak valid (maksimal 500 karakter).' }, { status: 400 });
    }

    const logoutScope = 'logoutScope' in body ? body.logoutScope : undefined;
    if (logoutScope !== undefined && (body.action !== 'Logout' || (logoutScope !== 'local' && logoutScope !== 'global'))) {
      return Response.json({ error: 'Scope logout tidak valid.' }, { status: 400 });
    }
    if (logoutScope) {
      stage = 'logout';
      const { error } = await supabaseAdmin.auth.admin.signOut(token, logoutScope);
      if (error) return activityFailure(stage);
      logoutCompleted = true;
    }

    stage = 'insert';
    const { error } = await supabaseAdmin.from('b1_activity').insert({
      user_id: user.id,
      register_id: user.id,
      action: body.action,
      description: sanitizeActivityDescription(body.description),
      ip_address: getClientIp(request.headers),
      user_agent: request.headers.get('user-agent'),
    });
    if (error) {
      const failure = activityFailure(stage, error.code);
      // Logout already succeeded: a failed log must not undo the primary action.
      return logoutScope ? Response.json({ success: true, logged: false }) : failure;
    }
    return Response.json({ success: true }, { status: 201 });
  } catch {
    // Codes and stages are safe diagnostics; never print bodies, tokens or raw errors.
    const failure = activityFailure(stage);
    return logoutCompleted
      ? Response.json({ success: true, logged: false }) : failure;
  }
}
