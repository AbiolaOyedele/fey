'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { posthog } from '@/lib/posthog'
import { workspaceUrl, activeWorkspaceSlug } from '@/utils/host'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'

interface WsChoice { name: string; slug: string }

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="white"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="white"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="white"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="white"/>
    </svg>
  )
}

function LoginPageInner() {
  const router        = useRouter()
  const pathname      = usePathname()
  const searchParams  = useSearchParams()
  const { user, loading: authLoading, signIn, signUp, signInWithGoogle } = useAuth()

  useEffect(() => {
    const fromShare = searchParams?.get('from_share')
    const token     = searchParams?.get('token')
    if (fromShare === 'true' && token) {
      localStorage.setItem('fey_pending_share', token)
    }
  }, [searchParams])

  const defaultMode = pathname === '/register' ? 'signup' : 'signup'
  const [mode,      setMode]      = useState<'signup' | 'signin'>(defaultMode as 'signup' | 'signin')
  const [showEmail, setShowEmail] = useState(false)
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [info,      setInfo]      = useState('')
  const [loading,   setLoading]   = useState(false)

  const [wsChoices, setWsChoices] = useState<WsChoice[] | null>(null)

  // After sign-in: if the account belongs to several workspaces, let them pick
  // which to enter; otherwise go straight in.
  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('workspace_members')
        .select('workspaces ( name, slug )')
        .eq('user_id', user.id)
      if (cancelled) return
      const rows = ((data ?? []) as Array<{ workspaces: { name: string; slug: string | null } | { name: string; slug: string | null }[] | null }>)
        .map((r) => (Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces))
        .filter((w): w is WsChoice => !!w?.slug)
      const unique = Array.from(new Map(rows.map((w) => [w.slug, w])).values())
      if (unique.length > 1) {
        setWsChoices(unique)
      } else {
        const slug = unique[0]?.slug
        if (slug && activeWorkspaceSlug() !== slug) window.location.href = workspaceUrl(slug)
        else router.replace('/')
      }
    })()
    return () => { cancelled = true }
  }, [authLoading, user, router])

  if (authLoading) return null

  if (user && wsChoices) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="Fey" className="w-9 h-9 rounded-xl mb-8 mx-auto" />
          <h1 className="font-display text-2xl font-semibold text-gray-900 text-center mb-1">Choose a workspace</h1>
          <p className="text-xs text-gray-400 text-center mb-6">You have access to a few — pick one to continue.</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
            {wsChoices.map((w) => (
              <button
                key={w.slug}
                onClick={() => { window.location.href = workspaceUrl(w.slug) }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: 'var(--accent, #ED64A6)' }}>
                  {w.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-800 truncate">{w.name}</span>
                  <span className="block text-2xs text-gray-400">{w.slug}.theruff.agency</span>
                </span>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    const { error: err } = await signInWithGoogle()
    if (err) { setError((err as Error).message); setLoading(false) }
  }

  const switchMode = (next: 'signup' | 'signin') => {
    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
    setConfirm('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')

    if (mode === 'signup') {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (password !== confirm) { setError('Passwords do not match.'); return }
      setLoading(true)
      const { error: err } = await signUp(email, password)
      setLoading(false)
      if (err) { setError((err as Error).message); return }
      posthog.capture('signup_completed')
      setInfo('Check your email to confirm your account, then sign in.')
      return
    }

    setLoading(true)
    const { error: err } = await signIn(email, password)
    setLoading(false)
    if (err) setError((err as Error).message)
  }

  const handleForgot = async () => {
    if (!email.trim()) { setError('Enter your email above, then tap reset.'); return }
    setLoading(true); setError(''); setInfo('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) setError(err.message)
    else setInfo('Check your email for a link to reset your password.')
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center">

        <img src="/favicon.svg" alt="Fey" className="w-9 h-9 rounded-xl mb-10" />

        <h1 className="font-display text-[3rem] sm:text-[4rem] leading-[1.05] font-normal text-gray-900 text-center mb-14">
          Your work,<br />organized.
        </h1>

        <button
          onClick={() => void handleGoogle()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-full text-white text-base font-normal transition-opacity hover:opacity-90 disabled:opacity-60 mb-4"
          style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>

        <button
          onClick={() => { setShowEmail((v) => !v); setError(''); setInfo('') }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-3"
        >
          {mode === 'signup' ? 'Sign up with email' : 'Sign in with email'}
          <ChevronDown
            size={15}
            className="transition-transform duration-200"
            style={{ transform: showEmail ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {showEmail && (
          <form onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-2.5 animate-slideUp">
            <input
              type="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 transition-all"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 transition-all"
            />
            {mode === 'signup' && (
              <input
                type="password"
                required
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 transition-all"
              />
            )}

            {mode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleForgot()}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            {info  && <p className="text-xs text-green-600 text-center">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full text-white text-sm font-normal flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>

            <p className="text-center text-xs text-gray-400 pt-1">
              {mode === 'signup' ? (
                <>Already have an account?{' '}
                  <button type="button" onClick={() => switchMode('signin')} className="underline text-gray-600 hover:text-gray-900">Sign in</button>
                </>
              ) : (
                <>Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => switchMode('signup')} className="underline text-gray-600 hover:text-gray-900">Sign up</button>
                </>
              )}
            </p>
          </form>
        )}

        {!showEmail && (
          <p className="text-xs text-gray-400 mt-2">
            Already have an account?{' '}
            <button
              onClick={() => { setShowEmail(true); switchMode('signin') }}
              className="underline text-gray-600 hover:text-gray-900"
            >
              Sign in
            </button>
          </p>
        )}

        <p className="text-center text-xs text-gray-400 mt-10 leading-relaxed">
          By using Fey, you agree to our{' '}
          <a href="#" className="underline hover:text-gray-600">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}
