import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

function getJakartaLogoutTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    tanggal: `${values.year}-${values.month}-${values.day}`,
    waktu: `${values.hour}:${values.minute}:${values.second}`,
  };
}

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return Response.json({ error: 'Tidak terautentikasi.' }, { status: 401 });

  try {
    const admin = getSupabaseAdmin();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return Response.json({ error: 'Tidak terautentikasi.' }, { status: 401 });

    const { data: login, error: findError } = await admin.from('b3_log_login')
      .select('id').eq('register_id', user.id).is('waktu_logout', null)
      .order('tanggal_login', { ascending: false }).order('waktu_login', { ascending: false })
      .limit(1).maybeSingle();
    if (findError) {
      console.error('Gagal mencari sesi terbuka Log Login.', { code: findError.code });
      return Response.json({ success: true, logged: false });
    }
    if (!login) return Response.json({ success: true, logged: false });

    const logoutTime = getJakartaLogoutTime();
    const { error: updateError } = await admin.from('b3_log_login').update({
      tanggal_logout: logoutTime.tanggal,
      waktu_logout: logoutTime.waktu,
    }).eq('id', login.id).is('waktu_logout', null);
    if (updateError) {
      console.error('Gagal memperbarui logout Log Login.', { code: updateError.code });
      return Response.json({ success: true, logged: false });
    }
    return Response.json({ success: true, logged: true });
  } catch {
    // Riwayat login tidak boleh menghalangi proses logout utama.
    console.error('Endpoint pencatatan logout Log Login gagal.');
    return Response.json({ success: true, logged: false });
  }
}
