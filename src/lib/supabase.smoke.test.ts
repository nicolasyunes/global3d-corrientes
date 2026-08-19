import { describe, expect, it } from 'vitest'

const hasEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

// Opt-in integration test: runs only when Supabase env is configured, so
// dev/CI never depend on a live project. Absent env -> skipped, not failed.
describe.skipIf(!hasEnv)('Supabase connectivity smoke test', () => {
  it('proves connectivity with one typed query', async () => {
    const { supabase } = await import('./supabase')
    // Single typed query: read at most one row from the `smoke` table.
    // An empty result set is a valid connection (tolerated, not an error).
    const { data, error } = await supabase.from('smoke').select('id').limit(1)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})
