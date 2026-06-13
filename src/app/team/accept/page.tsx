'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const PENDING_KEY = 'fey:pending_invite'

type State = 'loading' | 'need-auth' | 'prompt' | 'joining' | 'done' | 'error'

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-appbg p-4">
        <Loader2 size={28} className="text-gray-300 animate-spin" />
      </div>
    }>
      <AcceptInviteInner />
    </Suspense>
  )
}

function AcceptInviteInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [state, setState] = useState<State>('loading')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  // Stash the token so it survives a sign-in round trip.
  const token = params?.get('token') ?? null
  useEffect(() => {
    if (token) { try { localStorage.setItem(PENDING_KEY, token) } catch { /* ignore */ } }
  }, [token])

  // Resolve auth → either ask to sign in, or show the name prompt.
  useEffect(() => {
    if (authLoading) return
    if (!user) { setState('need-auth'); return }
    const meta = user.user_metadata as Record<string, unknown> | undefined
    const suggested = (meta?.full_name ?? meta?.name ?? (user.email ?? '').split('@')[0]) as string
    setName((prev) => prev || suggested)
    setState((prev) => (prev === 'done' || prev === 'joining') ? prev : 'prompt')
  }, [authLoading, user])

  const join = async () => {
    let pending = token
    if (!pending) { try { pending = localStorage.getItem(PENDING_KEY) } catch { /* ignore */ } }
    if (!pending) { setState('error'); setMessage('This invite link is missing its token.'); return }
    if (!name.trim()) return

    setState('joining')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/v1/team/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ token: pending, name: name.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(body?.error?.message ?? 'This invite could not be accepted.')
      }
      try { localStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
      setState('done')
      setTimeout(() => router.replace('/'), 1200)
    } catch (e) {
      setState('error')
      setMessage(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-appbg p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
        {(state === 'loading') && (
          <>
            <Loader2 size={28} className="mx-auto mb-4 text-gray-300 animate-spin" />
            <p className="text-sm font-medium text-gray-700">Loading your invite…</p>
          </>
        )}

        {state === 'need-auth' && (
          <>
            <AlertCircle size={28} className="mx-auto mb-4 text-gray-300" />
            <p className="text-sm font-medium text-gray-800 mb-1">Sign in to join the team</p>
            <p className="text-xs text-gray-400 mb-5">Use the email address your invite was sent to.</p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              Sign in to continue
            </Link>
          </>
        )}

        {(state === 'prompt' || state === 'joining') && (
          <>
            <p className="text-base font-semibold text-gray-900 mb-1">You&apos;re almost in</p>
            <p className="text-xs text-gray-400 mb-5">What should your teammates call you?</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) void join() }}
              placeholder="Your name"
              className="w-full mb-4 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 text-center focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
            <button
              onClick={() => void join()}
              disabled={!name.trim() || state === 'joining'}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              {state === 'joining' && <Loader2 size={14} className="animate-spin" />}
              {state === 'joining' ? 'Joining…' : 'Join workspace'}
            </button>
          </>
        )}

        {state === 'done' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-800">You&apos;re in! Taking you to your workspace…</p>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle size={28} className="mx-auto mb-4 text-red-400" />
            <p className="text-sm font-medium text-gray-800 mb-1">Couldn&apos;t accept invite</p>
            <p className="text-xs text-gray-400 mb-5">{message}</p>
            <Link href="/" className="text-sm font-medium" style={{ color: 'var(--accent, #ED64A6)' }}>
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
