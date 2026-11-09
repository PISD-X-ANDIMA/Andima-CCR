import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const getConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  return { url, key };
};

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const { url, key } = getConfig();
    client = createClient(url, key);
  }

  return client;
}

// Keep the existing `supabase.from(...)` API while deferring configuration
// validation until a client-side data request actually runs.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const configuredClient = getSupabaseClient();
    const value = Reflect.get(configuredClient, property);
    return typeof value === 'function' ? value.bind(configuredClient) : value;
  },
});
