import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Dev-only seeded operator session — the no-login-UI seam.
//
// RLS grants workshop access `to authenticated` (`orders_all`, `customers_all`),
// so the admin surface returns zero rows without a signed-in session. This
// module supplies that session for dev and for the cloud integration test, and
// is intentionally absent from production.
//
// Two halves, both env-gated:
//
//   ensureDevOperatorSession()  Browser seam. No-op unless
//                               VITE_ENABLE_DEV_SESSION === '1'. It only checks
//                               for an existing session — it never ships the
//                               service role or any credential into the bundle.
//
//   seedOperatorSession()       Node seam (tests/scripts). Uses the service role
//                               (SUPABASE_SERVICE_ROLE_KEY, non-VITE) to create a
//                               THROWAWAY operator with a runtime-generated
//                               password, then signs in with the anon client so
//                               RLS applies. The password is discarded — never
//                               committed and never read from .env.
//
// Deliberately avoids top-level imports of `@/lib/env` / `@/lib/supabase` (both
// throw at import time when credentials are absent), so an integration test can
// import this module and skip cleanly when env is not configured.
// ---------------------------------------------------------------------------

type Client = SupabaseClient<Database>

export interface SeededOperator {
  email: string
  password: string
  userId: string
  client: Client
  service: Client
}

const DEV_SESSION_ENABLED = import.meta.env.VITE_ENABLE_DEV_SESSION === '1'

function resolveUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url) throw new Error('Missing VITE_SUPABASE_URL.')
  return url
}

function resolveAnonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!key) throw new Error('Missing VITE_SUPABASE_ANON_KEY.')
  return key
}

function loadServiceRoleKey(): string | undefined {
  try {
    process.loadEnvFile()
  } catch {
    // .env absent; fall through to an already-populated process.env.
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}

function throwawayPassword(): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `dev-${suffix}`
}

export async function seedOperatorSession(opts?: {
  email?: string
}): Promise<SeededOperator> {
  const serviceRoleKey = loadServiceRoleKey()
  if (!serviceRoleKey) {
    throw new Error(
      'seedOperatorSession needs SUPABASE_SERVICE_ROLE_KEY (Node only).',
    )
  }

  const service = createClient<Database>(resolveUrl(), serviceRoleKey, {
    auth: { persistSession: false },
  })

  const email = opts?.email ?? `dev-operator-${Date.now()}@global3d.local`
  const password = throwawayPassword()

  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
  if (createError || !created.user) {
    throw new Error(`auth.admin.createUser failed: ${createError?.message}`)
  }
  const userId = created.user.id

  const { error: profileError } = await service
    .from('profiles')
    .upsert({ id: userId, role: 'operator' })
  if (profileError) {
    await service.auth.admin.deleteUser(userId)
    throw new Error(`profile seed failed: ${profileError.message}`)
  }

  const client = createClient<Database>(resolveUrl(), resolveAnonKey(), {
    auth: { persistSession: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError) {
    await service.auth.admin.deleteUser(userId)
    throw new Error(`signInWithPassword failed: ${signInError.message}`)
  }

  return { email, password, userId, client, service }
}

export async function ensureDevOperatorSession(): Promise<boolean> {
  if (!DEV_SESSION_ENABLED) return false
  // Lazy import: the anon client is only pulled in when the seam is enabled.
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session !== null
}
