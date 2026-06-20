'use client'

export const dynamic = 'force-dynamic'

import { Suspense, use, useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { usePortalBranding } from '@/hooks/usePortalBranding'
import { usePortalBase, portalBasePath } from '@/hooks/usePortalBase'
import { portalTokenKey } from '@/hooks/usePortalAuth'

// ─── Inner page ───────────────────────────────────────────────────────────────

function JoinPageInner({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const searchParams  = useSearchParams()
  const router        = useRouter()

  const branding = usePortalBranding(subdomain)
  const base     = usePortalBase(subdomain)
  const [form,    setForm]  = useState({ name: '', email: '', password: '' })
  const [code,    setCode]  = useState('')
  const [error,   setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Pull code from URL — it's auto-filled and hidden when present
  const codeFromUrl = searchParams.get('code') ?? ''

  useEffect(() => {
    if (codeFromUrl) setCode(codeFromUrl)
  }, [codeFromUrl])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleJoin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) { setError('Please enter your access code.'); return }
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/v1/portal/auth/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_slug: subdomain,
          name:           form.name,
          email:          form.email,
          password:       form.password,
          invite_code:    code.trim().toUpperCase(),
        }),
      })
      const data = await res.json() as { token?: string; error?: { message: string } }
      if (!res.ok) {
        setError(data.error?.message ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      // Account created — sign in immediately and go straight into the portal.
      if (data.token) {
        localStorage.setItem(portalTokenKey(subdomain), data.token)
        router.replace(portalBasePath(subdomain))
      } else {
        router.replace(`${portalBasePath(subdomain)}/login?joined=1`)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }, [subdomain, form, code, router])

  const accent       = branding?.accent_color ?? '#ED64A6'
  // Use the workspace/brand name (company or slug), not the owner's personal name.
  const displayName  = branding?.business_name || subdomain
  const ownerInitial = displayName.charAt(0).toUpperCase()
  const isComplete   = form.name && form.email && form.password.length >= 8 && code

  const inputCls = `
    w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm
    text-gray-900 outline-none focus:border-gray-400 transition-all
    placeholder:text-gray-400
  `.trim()

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F5F5F7',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      boxSizing: 'border-box',
    }}>
      {!branding ? (
        <Loader2 size={20} className="animate-spin text-gray-400" />
      ) : (
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Owner avatar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px', gap: '12px' }}>
            {branding?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logo_url}
                alt={branding.business_name}
                style={{ width: '56px', height: '56px', borderRadius: '16px', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                backgroundColor: accent, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '22px', fontWeight: 600,
              }}>
                {ownerInitial}
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#111', margin: 0, lineHeight: 1.2 }}>
                Join {displayName}&apos;s workspace
              </h1>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: '6px 0 0' }}>
                Create your account to access the client portal.
              </p>
            </div>
          </div>

          {/* Form card */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            boxSizing: 'border-box',
            width: '100%',
          }}>
            <form onSubmit={(e) => void handleJoin(e)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Your name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  required
                  autoFocus
                  autoComplete="name"
                  placeholder="Jane Smith"
                  className={inputCls}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  required
                  autoComplete="email"
                  placeholder="jane@company.com"
                  className={inputCls}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Choose a password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  className={inputCls}
                />
              </div>

              {/* Access code — hidden if pre-filled from invite link */}
              {codeFromUrl ? (
                <input type="hidden" value={code} />
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                    Access code
                  </label>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '6px' }}>
                    Found in the invite link your team sent you.
                  </p>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. A3B7X9M2"
                    className={inputCls}
                    style={{ letterSpacing: '0.1em' }}
                  />
                </div>
              )}

              {error && (
                <p style={{ fontSize: '13px', color: '#EF4444', backgroundColor: '#FEF2F2', padding: '10px 14px', borderRadius: '12px', margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !isComplete}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '50px',
                  backgroundColor: accent,
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: loading || !isComplete ? 'not-allowed' : 'pointer',
                  opacity: loading || !isComplete ? 0.45 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'opacity 0.2s',
                  minHeight: '44px',
                  marginTop: '4px',
                }}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Joining…' : 'Join workspace'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#9CA3AF', marginTop: '20px' }}>
            Already have access?{' '}
            <a
              href={`${base}/login`}
              style={{ color: '#374151', fontWeight: 500, textDecoration: 'none' }}
            >
              Sign in
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

export default function JoinPage({ params }: { params: Promise<{ subdomain: string }> }) {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    }>
      <JoinPageInner params={params} />
    </Suspense>
  )
}
