export interface SupabaseEnv {
  readonly supabaseUrl: string
  readonly supabaseAnonKey: string
}

function readEnv(): SupabaseEnv {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || url.trim() === '') {
    throw new Error(
      'Missing environment variable: VITE_SUPABASE_URL (see .env.example).',
    )
  }

  if (!anonKey || anonKey.trim() === '') {
    throw new Error(
      'Missing environment variable: VITE_SUPABASE_ANON_KEY (see .env.example).',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(
      'Malformed environment variable: VITE_SUPABASE_URL must be a valid URL.',
    )
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(
      'Malformed environment variable: VITE_SUPABASE_URL must use http(s).',
    )
  }

  return { supabaseUrl: url, supabaseAnonKey: anonKey }
}

// Fails fast at import time: a missing or malformed env var turns into an
// immediate, legible crash instead of a deferred network error.
export const env: SupabaseEnv = readEnv()
