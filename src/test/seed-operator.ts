import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Node-only seeded operator session for tests/scripts. Relocated out of
// `features/admin/dev-session.ts` by the auth-access change; the file also
// owned a browser-only dev seam (`ensureDevOperatorSession` +
// `VITE_ENABLE_DEV_SESSION`) which was DELETED once the real magic-link login
// UI landed (PR3). This Node helper survives for automated tests only.
//
// The `profiles` row is created by the `handle_new_user` trigger on
// auth.users insert (see supabase/migrations/20260820120000_handle_new_user.sql)
// — NOT by a manual upsert. Each call therefore proves the real-auth flow
// end-to-end (signup → trigger → profiles row). If the trigger is missing, the
// helper fails loudly instead of returning an operator that silently reads zero
// rows under RLS.
//
// Env-gated: uses the service role (SUPABASE_SERVICE_ROLE_KEY, non-VITE) to
// create a THROWAWAY operator with a runtime-generated password, then signs in
// with the anon client so RLS applies. The password is discarded — never
// committed and never read from .env.
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

  // Fires the on_auth_user_created trigger, which inserts the profiles row.
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

  // The trigger runs synchronously inside the same insert, so the profile must
  // exist right after createUser resolves. Verify it (service role bypasses
  // RLS) and fail loud if the trigger is absent or broken.
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()
  if (profileError || !profile) {
    await service.auth.admin.deleteUser(userId)
    throw new Error(
      `handle_new_user trigger did not create a profile for ${email}: ${profileError?.message}`,
    )
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
