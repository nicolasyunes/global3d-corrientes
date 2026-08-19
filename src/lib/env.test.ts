import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('env validation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws naming VITE_SUPABASE_URL when the URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    await expect(import('./env')).rejects.toThrow(/VITE_SUPABASE_URL/)
  })

  it('throws naming VITE_SUPABASE_ANON_KEY when the key is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    await expect(import('./env')).rejects.toThrow(/VITE_SUPABASE_ANON_KEY/)
  })

  it('throws naming VITE_SUPABASE_URL on a malformed URL', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'not-a-url')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    await expect(import('./env')).rejects.toThrow(/VITE_SUPABASE_URL/)
  })

  it('passes with well-formed values', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    const { env } = await import('./env')
    expect(env.supabaseUrl).toBe('https://example.supabase.co')
    expect(env.supabaseAnonKey).toBe('anon-key')
  })
})
