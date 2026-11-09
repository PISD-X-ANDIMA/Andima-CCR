import "server-only";
import { createClient } from "@supabase/supabase-js";
export function createAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase projects may expose either the legacy service-role JWT or the
  // newer server-only secret key. Never fall back to a browser publishable key.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Server database configuration unavailable.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
