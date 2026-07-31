'use client'

import { Suspense, use, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { portalTokenKey } from '../layout'
import { usePortalBranding } from '@/hooks/usePortalBranding'
import { usePortalBase, portalBasePath } from '@/hooks/usePortalBase'

function PortalLoginInner({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const justJoined    = searchParams.get('joined') === '1'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading, setLoading] = useState(false)
  const branding = usePortalBranding(subdomain)
  const base     = usePortalBase(subdomain)

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/v1/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_slug: subdomain, email, password }),
      })
      const data = await res.json() as { token?: string; error?: { message: string } }

      if (!res.ok || !data.token) {
        setError(data.error?.message ?? 'Invalid email or password.')
        setLoading(false)
        return
      }

      // Store the portal JWT scoped to this workspace
      localStorage.setItem(portalTokenKey(subdomain), data.token)
      router.push(portalBasePath(subdomain))
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }, [email, password, subdomain, router])

  const accentColor = branding?.accent_color ?? '#101010'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Workspace branding header */}
        <div className="text-center mb-8">
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt={branding.business_name}
              className="h-10 w-10 rounded-xl object-cover mx-auto mb-3"
            />
          ) : (
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-base font-bold mx-auto mb-3"
              style={{ backgroundColor: accentColor }}
            >
              {(branding?.business_name ?? subdomain).charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-xl font-semibold text-gray-900">
            {branding?.business_name ?? subdomain}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your client portal</p>
        </div>

        {/* Success banner after joining */}
        {justJoined && (
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 mb-4">
            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-700">Account created! Sign in below to access your portal.</p>
          </div>
        )}

        <form onSubmit={(e) => void handleLogin(e)} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-2.5 rounded-full text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: accentColor }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don&apos;t have access?{' '}
          <a href={`${base}/join`} className="font-medium text-gray-800 hover:underline">
            Request access
          </a>
        </p>

      </div>
    </div>
  )
}

export default function PortalLoginPage({ params }: { params: Promise<{ subdomain: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    }>
      <PortalLoginInner params={params} />
    </Suspense>
  )
}
