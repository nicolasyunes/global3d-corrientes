import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'

// Single source of truth for the admin session. Mounted inside the lazy
// `/admin` boundary (admin.route.tsx, PR3) so auth code never enters the
// public bundle. Resolves the persisted session on mount (getSession) and
// stays in sync with supabase-js via onAuthStateChange (INITIAL_SESSION /
// SIGNED_IN / SIGNED_OUT). `loading` stays true until the initial session
// resolves, so guards can avoid a premature redirect to login.

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  // Role is looked up separately from the session (profiles.role, read
  // through RLS as the signed-in user) so screens can gate on `isAdmin`
  // without every admin.route.tsx guard re-deriving it.
  useEffect(() => {
    let active = true

    if (!user) {
      setRole(null)
      setRoleLoading(false)
      return
    }

    setRoleLoading(true)
    void supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setRole(data?.role ?? null)
        setRoleLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      role,
      roleLoading,
      isAdmin: role === 'admin',
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, user, loading, role, roleLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
