import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Loud on purpose — a silently-missing config here means every save/load
  // fails with a confusing network error instead of an obvious cause.
  console.warn(
    'Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (and in Vercel for production).'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '');
