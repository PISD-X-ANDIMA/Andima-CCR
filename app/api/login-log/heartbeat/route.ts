import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return Response.json({ error: 'Tidak terautentikasi.' }, { status: 401 });

  try {
    const admin = getSupabaseAdmin();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ error: 'Tidak terautentikasi.' }, { status: 401 });
    }

    const { data: login, error: findError } = await admin.from('b3_log_login')
      .select('id')
      .eq('register_id', user.id)
      .is('waktu_logout', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error('Gagal mencari sesi untuk heartbeat Log Login.', { code: findError.code });
      return Response.json({ error: 'Gagal memperbarui heartbeat.' }, { status: 500 });
    }
    if (!login) return Response.json({ success: true, logged: false });

    const { error: updateError } = await admin.from('b3_log_login')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', login.id)
      .is('waktu_logout', null);

    if (updateError) {
      console.error('Gagal menyimpan heartbeat Log Login.', { code: updateError.code });
      return Response.json({ error: 'Gagal memperbarui heartbeat.' }, { status: 500 });
    }

    return Response.json({ success: true, logged: true });
  } catch {
    console.error('Endpoint heartbeat Log Login gagal.');
    return Response.json({ error: 'Gagal memperbarui heartbeat.' }, { status: 500 });
  }
}
