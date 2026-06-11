'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ data: unknown; error: unknown }>
  signIn: (email: string, password: string) => Promise<{ data: unknown; error: unknown }>
  signInWithGoogle: () => Promise<{ data: unknown; error: unknown }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let resolved = false

    const finishLoading = (nextSession: Session | null) => {
      if (!mounted || resolved) return
      resolved = true
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        finishLoading(nextSession)
      }
      if (event === 'SIGNED_IN' && nextSession?.user) {
        const pending = JSON.parse(localStorage.getItem('fey_pending_shares') || '[]') as Record<string, unknown>[]
        if (pending.length > 0) {
          Promise.all(
            pending.map((payload) =>
              supabase
                .from('user_linked_clients')
                .upsert({ user_id: nextSession.user.id, ...payload }, { onConflict: 'user_id,token' })
            )
          ).then(() => localStorage.removeItem('fey_pending_shares')).catch(() => null)
        }
      }
    })

    const fallback = setTimeout(async () => {
      if (resolved) return
      const { data: { session: fallbackSession } } = await supabase.auth.getSession()
      finishLoading(fallbackSession)
    }, 500)

    return () => {
      mounted = false
      clearTimeout(fallback)
      subscription.unsubscribe()
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { data, error }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}/`
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    return { data, error }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

const AUTH_STUB: AuthContextValue = {
  user: null,
  session: null,
  loading: false,
  signUp: async () => ({ data: null, error: null }),
  signIn: async () => ({ data: null, error: null }),
  signInWithGoogle: async () => ({ data: null, error: null }),
  signOut: async () => undefined,
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  // Outside AuthProvider (e.g. demo mode) — return a safe no-op stub so pages
  // that call useAuth() don't crash. user/session will be null, which is fine
  // because demo mode's data hooks short-circuit on IS_DEMO before needing userId.
  return ctx ?? AUTH_STUB
}
