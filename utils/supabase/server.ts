import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "./cookies";
export const createClient = (cookieStore: Awaited<ReturnType<typeof cookies>>) => createServerClient(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)!,
  (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
  { cookieOptions: sessionCookieOptions, cookies: {
    getAll: () => cookieStore.getAll(),
    setAll: (values) => { values.forEach(({ name, value, options }) => cookieStore.set(name, value, { ...options, ...sessionCookieOptions })); },
  } }
);
