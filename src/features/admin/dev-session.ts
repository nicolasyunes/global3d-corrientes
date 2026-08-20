// ---------------------------------------------------------------------------
// Dev-only browser session seam — the no-login-UI dev helper.
//
// RLS grants workshop access `to authenticated` (`orders_all`, `customers_all`),
// so the admin surface returns zero rows without a signed-in session. This
// module supplies that session in dev; it is intentionally absent from
// production.
//
//   ensureDevOperatorSession()  Browser seam. No-op unless
//                               VITE_ENABLE_DEV_SESSION === '1'. It only checks
//                               for an existing session — it never ships the
//                               service role or any credential into the bundle.
//
// The Node-only seed helper (`seedOperatorSession`) was relocated to
// `src/test/seed-operator.ts` in the auth-access change: tests there now prove
// the `handle_new_user` trigger instead of manually upserting a profile. This
// browser seam is retired when the real login UI lands (PR3).
// ---------------------------------------------------------------------------

const DEV_SESSION_ENABLED = import.meta.env.VITE_ENABLE_DEV_SESSION === '1'

export async function ensureDevOperatorSession(): Promise<boolean> {
  if (!DEV_SESSION_ENABLED) return false
  // Lazy import: the anon client is only pulled in when the seam is enabled.
  const { supabase } = await import('@/lib/supabase')
  const { data } = await supabase.auth.getSession()
  return data.session !== null
}
