'use client'

import { use, useState, useEffect } from 'react'
import { CreditCard, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ── Types ──────────────────────────────────────────────────────────────────────

interface PaymentRequest {
  id: string
  amount: number
  currency: string
  description: string
  message: string
  status: string
  owner_id: string
}

interface OwnerBranding {
  company_name: string
  logo: string
  accent_color: string
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦', USD: '$', GBP: '£', EUR: '€', ZAR: 'R', KES: 'KSh', GHS: '₵',
}

function fmt(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + ' '
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [request,  setRequest]  = useState<PaymentRequest | null>(null)
  const [branding, setBranding] = useState<OwnerBranding | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [email,   setEmail]   = useState('')
  const [paying,  setPaying]  = useState(false)
  const [payErr,  setPayErr]  = useState('')

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from('crm_payment_requests')
        .select('id, amount, currency, description, message, status, owner_id')
        .eq('share_token', token)
        .single()

      if (error ?? !data) { setNotFound(true); setLoading(false); return }

      const row = data as PaymentRequest
      setRequest(row)

      // Fetch owner branding from fey_settings
      const { data: brandingRow } = await supabase
        .from('fey_settings')
        .select('company_name, logo, accent_color')
        .eq('user_id', row.owner_id)
        .maybeSingle()

      setBranding({
        company_name: (brandingRow as Partial<OwnerBranding> | null)?.company_name ?? 'Payment Request',
        logo:         (brandingRow as Partial<OwnerBranding> | null)?.logo         ?? '',
        accent_color: (brandingRow as Partial<OwnerBranding> | null)?.accent_color ?? '#ED64A6',
      })

      setLoading(false)
    })()
  }, [token])

  const handlePay = async () => {
    if (!request || !email.trim()) { setPayErr('Please enter your email address.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setPayErr('Please enter a valid email address.'); return }

    setPaying(true)
    setPayErr('')

    try {
      const res = await fetch('/api/v1/pay/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: email.trim() }),
      })
      const json = await res.json() as { authorizationUrl?: string; error?: { message: string } }

      if (!res.ok || !json.authorizationUrl) {
        setPayErr(json.error?.message ?? 'Payment initialization failed. Please try again.')
        return
      }

      window.location.href = json.authorizationUrl
    } catch {
      setPayErr('Something went wrong. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  const accent = branding?.accent_color ?? '#ED64A6'

  // ── States ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (notFound || !request) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <XCircle size={48} className="text-gray-200 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Payment not found</h1>
        <p className="text-gray-500 text-sm">This payment link is invalid or has expired.</p>
      </div>
    )
  }

  if (request.status === 'paid') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle2 size={48} className="mb-4" style={{ color: accent }} />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Already paid</h1>
        <p className="text-gray-500 text-sm">This payment request has already been completed. Thank you!</p>
      </div>
    )
  }

  if (request.status !== 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <XCircle size={48} className="text-gray-200 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link unavailable</h1>
        <p className="text-gray-500 text-sm">This payment request is no longer available.</p>
      </div>
    )
  }

  // ── Active payment request ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Header band */}
        <div className="h-2" style={{ backgroundColor: accent }} />

        <div className="p-6">
          {/* Logo / business name */}
          <div className="flex items-center gap-3 mb-6">
            {branding?.logo ? (
              <img src={branding.logo} alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-gray-50 border border-gray-100" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base" style={{ backgroundColor: accent }}>
                {(branding?.company_name ?? 'P').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{branding?.company_name ?? 'Payment Request'}</p>
              <p className="text-xs text-gray-400">Secure payment</p>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-center">
            <p className="text-xs text-gray-400 mb-1">Amount due</p>
            <p className="text-3xl font-bold text-gray-900">{fmt(request.amount, request.currency)}</p>
          </div>

          {/* Description */}
          {request.description && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-900">{request.description}</p>
            </div>
          )}

          {/* Message */}
          {request.message && (
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">{request.message}</p>
          )}

          {/* Email input */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Your email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setPayErr('') }}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:bg-white transition-all"
              onKeyDown={(e) => { if (e.key === 'Enter') void handlePay() }}
            />
            {payErr && <p className="text-xs text-red-500 mt-1.5">{payErr}</p>}
          </div>

          {/* Pay button */}
          <button
            onClick={() => void handlePay()}
            disabled={paying || !email.trim()}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {paying ? (
              <><Loader2 size={16} className="animate-spin" />Processing…</>
            ) : (
              <><CreditCard size={15} />Pay {fmt(request.amount, request.currency)}</>
            )}
          </button>

          <p className="text-2xs text-gray-400 text-center mt-3">
            Secured by Paystack · Your payment info is never shared
          </p>
        </div>
      </div>
    </div>
  )
}
