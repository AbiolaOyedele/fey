'use client'

export const dynamic = 'force-dynamic'

import { use, useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'

export default function PortalSignupPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const searchParams  = useSearchParams()

  const [form, setForm] = useState({ name: '', email: '', password: '', contactId: '' })

  // Pre-fill access code from ?code= query param (set by "Copy invite link")
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) setForm((prev) => ({ ...prev, contactId: code }))
  }, [searchParams])
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/v1/portal/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subdomain,
        name:       form.name,
        email:      form.email,
        password:   form.password,
        contact_id: form.contactId,
      }),
    })
    const data = await res.json() as { error?: { message: string } }
    if (!res.ok) {
      setError(data.error?.message ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }, [subdomain, form])

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access requested</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your account has been created. You can now sign in to access your portal.
          </p>
          <a
            href={`/portal/${subdomain}/login`}
            className="inline-block px-6 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: '#101010' }}
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Request Portal Access</h1>
          <p className="text-sm text-gray-500 mt-1">Create your account to access the client portal</p>
        </div>

        <form onSubmit={(e) => void handleSignup(e)} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              required
              autoComplete="name"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
              placeholder="Jane Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
              placeholder="jane@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access code</label>
            <p className="text-[12px] text-gray-400 mb-1">Your unique access code provided by the team.</p>
            <input
              type="text"
              value={form.contactId}
              onChange={set('contactId')}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:border-gray-400 focus:bg-white transition-colors font-mono"
              placeholder="e.g. a1b2c3d4-…"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !form.name || !form.email || !form.password || !form.contactId}
            className="w-full py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#101010' }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have access?{' '}
          <a href={`/portal/${subdomain}/login`} className="font-medium text-gray-800 hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
