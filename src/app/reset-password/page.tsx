'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * Password reset — reached from the link in the recovery email. Supabase parses
 * the recovery token from the URL and establishes a short-lived session
 * (PASSWORD_RECOVERY), after which we let the user set a new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)       // recovery session established
  const [checked, setChecked] = useState(false)   // finished checking for a session
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') { setReady(true); setChecked(true) }
    })
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      setChecked(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => router.replace('/'), 1500)
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.svg" alt="Fey" className="w-9 h-9 rounded-xl mb-8" />

        {done ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-800">Password updated — signing you in…</p>
          </div>
        ) : !checked ? (
          <Loader2 size={24} className="animate-spin text-gray-300" />
        ) : !ready ? (
          <div className="text-center">
            <p className="text-base font-semibold text-gray-900 mb-1">Link expired</p>
            <p className="text-xs text-gray-400 mb-5">This reset link is invalid or has expired. Request a new one from the sign-in page.</p>
            <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--accent, #ED64A6)' }}>Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="w-full">
            <h1 className="font-display text-2xl font-semibold text-gray-900 text-center mb-1">Set a new password</h1>
            <p className="text-xs text-gray-400 text-center mb-6">Choose a strong password you’ll remember.</p>
            <input
              type="password"
              required
              autoFocus
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 mb-2.5"
            />
            <input
              type="password"
              required
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 mb-2.5"
            />
            {error && <p className="text-xs text-red-500 text-center mb-2">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full text-white text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
