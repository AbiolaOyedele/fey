'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type State = 'loading' | 'form' | 'joining' | 'done' | 'error' | 'invalid'

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
  const token = params?.get('token') ?? null

  const [state, setState] = useState<State>('loading')
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  // Resolve the invite (workspace name + locked email).
  useEffect(() => {
    if (!token) { setState('invalid'); setMessage('This invite link is missing its token.'); return }
    void (async () => {
      try {
        const res = await fetch(`/api/v1/team/invites/lookup?token=${encodeURIComponent(token)}`)
        if (!res.ok) { setState('invalid'); setMessage('This invite is no longer valid.'); return }
        const data = await res.json() as { email: string; workspaceName: string }
        setEmail(data.email)
        setWorkspaceName(data.workspaceName)
        setState('form')
      } catch {
        setState('invalid'); setMessage('Could not load this invite. Please try again.')
      }
    })()
  }, [token])

  const join = useCallback(async () => {
    if (!token || !name.trim() || password.length < 8) return
    setState('joining'); setMessage('')
    try {
      // 1. Server creates/repairs the account (auto-confirmed) + joins the
      //    workspace. Token-gated, so no prior session is needed.
      const res = await fetch('/api/v1/team/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim(), password }),
      })
      const data = await res.json().catch(() => null) as { email?: string; token_hash?: string | null; existing?: boolean; error?: { message?: string } } | null
      if (!res.ok) throw new Error(data?.error?.message ?? 'This invite could not be accepted.')

      // Existing Fey account: we deliberately don't (and can't) set their password
      // here. They're now a member — send them to sign in with their own login.
      if (data?.existing) {
        setState('done')
        setMessage('You already have a Fey account — sign in to open this workspace.')
        setTimeout(() => router.replace('/login'), 1600)
        return
      }

      // 2. Sign in immediately — prefer the one-time token, fall back to password.
      let signedIn = false
      if (data?.token_hash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' })
        signedIn = !error
      }
      if (!signedIn) {
        const { error } = await supabase.auth.signInWithPassword({ email: data?.email ?? email, password })
        signedIn = !error
      }
      if (!signedIn) throw new Error('Your account is ready. Please sign in to continue.')

      setState('done')
      setTimeout(() => router.replace('/'), 1200)
    } catch (e) {
      setState('error')
      setMessage(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }, [token, name, password, email, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-appbg p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full">
        {state === 'loading' && (
          <div className="text-center">
            <Loader2 size={28} className="mx-auto mb-4 text-gray-300 animate-spin" />
            <p className="text-sm font-medium text-gray-700">Loading your invite…</p>
          </div>
        )}

        {(state === 'form' || state === 'joining' || state === 'error') && (
          <>
            <div className="text-center mb-5">
              <p className="text-base font-semibold text-gray-900">Join {workspaceName}</p>
              <p className="text-xs text-gray-400 mt-0.5">Set up your account to get started.</p>
            </div>
            <label className="block text-2xs font-medium text-gray-400 mb-1">Email</label>
            <input
              value={email}
              readOnly
              className="w-full mb-3 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500 cursor-not-allowed"
            />
            <label className="block text-2xs font-medium text-gray-400 mb-1">Your name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full mb-3 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-gray-400"
            />
            <label className="block text-2xs font-medium text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && password.length >= 8) void join() }}
              placeholder="At least 8 characters"
              className="w-full mb-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-gray-400"
            />
            <p className="text-2xs text-gray-300 mb-4">{password && password.length < 8 ? 'Password must be at least 8 characters.' : ' '}</p>

            {state === 'error' && <p className="text-xs text-red-500 mb-3">{message}</p>}

            <button
              onClick={() => void join()}
              disabled={!name.trim() || password.length < 8 || state === 'joining'}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              {state === 'joining' && <Loader2 size={14} className="animate-spin" />}
              {state === 'joining' ? 'Joining…' : 'Join workspace'}
            </button>
          </>
        )}

        {state === 'done' && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-800">You&apos;re in! Taking you to your workspace…</p>
          </div>
        )}

        {state === 'invalid' && (
          <div className="text-center">
            <AlertCircle size={28} className="mx-auto mb-4 text-red-400" />
            <p className="text-sm font-medium text-gray-800 mb-1">Invite not valid</p>
            <p className="text-xs text-gray-400 mb-5">{message}</p>
            <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--accent, #ED64A6)' }}>Go to sign in</Link>
          </div>
        )}
      </div>
    </div>
  )
}
