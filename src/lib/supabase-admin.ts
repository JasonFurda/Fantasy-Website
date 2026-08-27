import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client for the handful of server-side writes the site
// needs (e.g. the private power-rankings submission). NEVER import this from a
// client component — the "server-only" guard makes that a build error. The
// service key bypasses RLS, so keep every caller behind its own auth check.
//
// Env: reuses NEXT_PUBLIC_SUPABASE_URL for the URL and SUPABASE_SERVICE_KEY for
// the key. Locally SUPABASE_SERVICE_KEY already lives in root .env (Python sync
// loads it too); on Vercel it must be added to the project's env vars.

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase admin env: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) " +
        "and SUPABASE_SERVICE_KEY. On Vercel, add SUPABASE_SERVICE_KEY to the " +
        "project's Environment Variables.",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
