import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { RESET_PATH } from './ResetPasswordPage'

// If the recovery email link lands anywhere else (e.g. the site root when the
// redirect URL isn't allow-listed), still take the person to set a password.
export default function RecoveryRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') navigate(RESET_PATH, { replace: true })
    })
    return () => subscription.unsubscribe()
  }, [navigate])
  return null
}
