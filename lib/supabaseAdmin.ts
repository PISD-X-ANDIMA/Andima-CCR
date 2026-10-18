import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Konfigurasi Supabase admin belum tersedia.');
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}
