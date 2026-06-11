'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'name' | 'workspace'
type SlugState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30)
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { saveSetting } = useSettings()

  const [step,      setStep]      = useState<Step>('name')
  const [name,      setName]      = useState('')
  const [slug,      setSlug]      = useState('')
  const [slugState, setSlugState] = useState<SlugState>('idle')
  const [slugReason,setSlugReason]= useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const cardRef      = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const slugInputRef = useRef<HTMLInputElement>(null)
  const checkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pre-fill name from Google metadata
  useEffect(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined
    const full = (meta?.full_name ?? meta?.name ?? '') as string
    if (full) setName(full)
  }, [user])

  // Card entrance animation
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = 'translateY(64px)'
    el.style.opacity = '0'
    const t = setTimeout(() => {
      el.style.transition = 'transform 0.42s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease'
      el.style.transform = 'translateY(0)'
      el.style.opacity = '1'
    }, 20)
    return () => clearTimeout(t)
  }, [step])

  // Auto-focus
  useEffect(() => {
    if (step === 'name') nameInputRef.current?.focus()
    else slugInputRef.current?.focus()
  }, [step])

  // ── Slug availability check ────────────────────────────────────────────────

  const checkSlug = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setSlugState('idle')
      return
    }

    setSlugState('checking')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch(
        `/api/v1/workspace/check-slug?slug=${encodeURIComponent(value)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const json = await res.json() as { available: boolean; reason?: string }
      if (json.available) {
        setSlugState('available')
        setSlugReason('')
      } else {
        setSlugState('taken')
        setSlugReason(json.reason ?? 'Not available.')
      }
    } catch {
      setSlugState('idle')
    }
  }, [])

  const handleSlugChange = (raw: string) => {
    const cleaned = toSlug(raw)
    setSlug(cleaned)
    setSlugState('idle')
    if (checkTimeout.current) clearTimeout(checkTimeout.current)
    if (cleaned.length >= 3) {
      checkTimeout.current = setTimeout(() => void checkSlug(cleaned), 500)
    }
  }

  // ── Advance step ──────────────────────────────────────────────────────────

  const goToWorkspace = () => {
    if (!name.trim()) return
    const el = cardRef.current
    if (el) {
      el.style.transition = 'transform 0.25s ease, opacity 0.25s ease'
      el.style.transform = 'scale(0.94)'
      el.style.opacity = '0'
    }
    setTimeout(() => {
      // Suggest a slug from the name
      if (!slug) {
        const suggested = toSlug(name.trim())
        setSlug(suggested)
        void checkSlug(suggested)
      }
      setStep('workspace')
    }, 250)
  }

  // ── Finish setup ─────────────────────────────────────────────────────────

  const finishSetup = useCallback(async () => {
    if (slugState !== 'available' || !slug || saving) return
    setSaving(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expired. Please sign in again.'); setSaving(false); return }

      // Save name
      await saveSetting('username', name.trim())

      // Upsert workspace slug + name + mark fey onboarding complete
      const { error: dbErr } = await supabase
        .from('fey_settings')
        .upsert(
          {
            user_id:                 session.user.id,
            workspace_slug:          slug,
            workspace_name:          name.trim(),
            fey_onboarding_complete: 'true',
          },
          { onConflict: 'user_id' },
        )

      if (dbErr) throw dbErr

      // Mirror to localStorage so reload survives DB hiccups
      try { localStorage.setItem(`fey:onboarding_complete:${session.user.id}`, 'true') } catch { /* unavailable */ }

      // Update in-memory settings so AppShell stops blocking
      await saveSetting('fey_onboarding_complete', 'true')

      router.replace('/')
    } catch (err) {
      setError('Something went wrong. Please try again.')
      console.error('[setup]', err)
      setSaving(false)
    }
  }, [slug, slugState, name, saving, saveSetting, router])

  // ─── Shared styles ────────────────────────────────────────────────────────

  const accent = 'var(--accent, #ED64A6)'
  const muted  = '#6B7280'

  const inputCls = `
    w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm
    outline-none focus:border-gray-400 transition-all text-gray-900
  `.trim()

  const btnPrimary: React.CSSProperties = {
    width: '100%', padding: '14px', borderRadius: '50px',
    backgroundColor: accent, color: '#fff', fontSize: '15px',
    fontWeight: 400, border: 'none', cursor: 'pointer',
    minHeight: '44px', marginTop: '8px',
  }

  // Slug status indicator
  const slugIcon = () => {
    if (slugState === 'checking') return <Loader2 size={15} className="animate-spin text-gray-400" />
    if (slugState === 'available') return <Check size={15} className="text-emerald-500" />
    if (slugState === 'taken' || slugState === 'invalid') return <X size={15} className="text-red-400" />
    return null
  }

  // ─── Card content ─────────────────────────────────────────────────────────

  const nameCard = (
    <>
      <h2 style={{ fontFamily: 'var(--heading-font)', fontSize: '1.6rem', fontWeight: 400, margin: '0 0 8px', color: '#111', lineHeight: 1.3 }}>
        What should we call you?
      </h2>
      <p style={{ fontSize: '14px', color: muted, margin: '0 0 24px' }}>
        This is your name inside the app.
      </p>

      <input
        ref={nameInputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) goToWorkspace() }}
        placeholder="Your name"
        className={inputCls}
        style={{ marginBottom: '20px' }}
      />

      <button
        onClick={goToWorkspace}
        disabled={!name.trim()}
        style={{ ...btnPrimary, opacity: name.trim() ? 1 : 0.45, cursor: name.trim() ? 'pointer' : 'not-allowed' }}
      >
        Continue
      </button>
    </>
  )

  const workspaceCard = (
    <>
      <h2 style={{ fontFamily: 'var(--heading-font)', fontSize: '1.6rem', fontWeight: 400, margin: '0 0 8px', color: '#111', lineHeight: 1.3 }}>
        Choose your workspace URL
      </h2>
      <p style={{ fontSize: '14px', color: muted, margin: '0 0 24px' }}>
        This is your unique address. Clients will use it to access their portal.
      </p>

      {/* Slug input */}
      <div style={{ position: 'relative', marginBottom: '6px' }}>
        <input
          ref={slugInputRef}
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && slugState === 'available') void finishSetup() }}
          placeholder="your-name"
          className={inputCls}
          style={{ paddingRight: '40px' }}
        />
        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
          {slugIcon()}
        </span>
      </div>

      {/* Preview URL */}
      <p style={{ fontSize: '12px', color: slug && slugState === 'available' ? '#10B981' : muted, marginBottom: '4px', transition: 'color 0.2s' }}>
        {slug
          ? `${slug}.theruff.agency`
          : 'yourname.theruff.agency'}
      </p>

      {/* Error reason */}
      {(slugState === 'taken' || slugState === 'invalid') && slugReason && (
        <p style={{ fontSize: '12px', color: '#EF4444', marginBottom: '4px' }}>{slugReason}</p>
      )}

      {error && (
        <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '8px' }}>{error}</p>
      )}

      <button
        onClick={() => void finishSetup()}
        disabled={slugState !== 'available' || saving}
        style={{
          ...btnPrimary,
          marginTop: '16px',
          opacity: slugState === 'available' && !saving ? 1 : 0.45,
          cursor:  slugState === 'available' && !saving ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        {saving && <Loader2 size={16} className="animate-spin" />}
        {saving ? 'Setting up…' : 'Finish setup'}
      </button>

      <button
        onClick={() => setStep('name')}
        style={{ background: 'none', border: 'none', fontSize: '13px', color: muted, cursor: 'pointer', marginTop: '12px', width: '100%' }}
      >
        ← Back
      </button>
    </>
  )

  // ─── Progress dots ────────────────────────────────────────────────────────

  const steps: Step[] = ['name', 'workspace']
  const stepIndex = steps.indexOf(step)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#F5F5F7',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', boxSizing: 'border-box',
    }}>
      {/* Progress dots */}
      <div style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px', zIndex: 10 }}>
        {steps.map((s, i) => (
          <div key={s} style={{
            width: i === stepIndex ? '20px' : '6px',
            height: '6px', borderRadius: '3px',
            backgroundColor: i === stepIndex ? accent : 'rgba(0,0,0,0.12)',
            transition: 'all 0.3s ease',
          }} />
        ))}
      </div>

      {/* Logo */}
      <img src="/favicon.svg" alt="Fey" style={{ width: '36px', height: '36px', borderRadius: '10px', marginBottom: '32px' }} />

      {/* Card */}
      <div
        ref={cardRef}
        key={step}
        style={{
          backgroundColor: '#fff', borderRadius: '20px',
          width: '100%', maxWidth: '440px',
          padding: '32px', boxSizing: 'border-box',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        }}
      >
        {step === 'name' ? nameCard : workspaceCard}
      </div>
    </div>
  )
}
