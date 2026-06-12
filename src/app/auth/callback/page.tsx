'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * OAuth callback — runs on the CLIENT so the PKCE code exchange uses the code
 * verifier the browser client stored in localStorage when sign-in began. (A
 * server route can't read that verifier, which is why the exchange was failing
 * with ?error=auth_failed.)
 *
 * detectSessionInUrl may complete the exchange on its own; we also exchange
 * manually and reconcile, so it's robust either way.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Finishing sign-in…')

  useEffect(() => {
    let done = false
    const finish = (path: string) => {
      if (done) return
      done = true
      router.replace(path)
    }

    const url = new URL(window.location.href)

    // OAuth provider returned an error (e.g. the user cancelled).
    if (url.searchParams.get('error')) {
      finish('/login?error=auth_failed')
      return
    }

    // If detectSessionInUrl finishes the exchange, we hear about it here.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish('/')
    })

    void (async () => {
      // Maybe the session already landed (detectSessionInUrl beat us).
      const { data: { session: existing } } = await supabase.auth.getSession()
      if (existing) { finish('/'); return }

      const code = url.searchParams.get('code')
      if (!code) { finish('/login?error=missing_code'); return }

      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        // Could be a race with detectSessionInUrl consuming the code first.
        const { data: { session } } = await supabase.auth.getSession()
        if (session) { finish('/'); return }
        console.error('[auth/callback] exchange failed:', error.message)
        setMessage('Sign-in failed. Redirecting…')
        finish('/login?error=auth_failed')
        return
      }
      finish('/')
    })()

    const timeout = setTimeout(() => finish('/login?error=auth_failed'), 10_000)
    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-appbg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-400">{message}</p>
      </div>
    </div>
  )
}
