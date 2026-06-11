'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, Sparkles } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'name' | 'workspace'

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router       = useRouter()
  const { saveSetting } = useSettings()
  const { user }     = useAuth()

  // ── State ──────────────────────────────────────────────────────────────────

  const [step,          setStep]          = useState<Step>('name')
  const [name,          setName]          = useState('')
  const [slug,          setSlug]          = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [slugStatus,    setSlugStatus]    = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [slugMessage,   setSlugMessage]   = useState('')
  const [saving,        setSaving]        = useState(false)
  const [cardVisible,   setCardVisible]   = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // ── Pre-fill name from Google metadata ────────────────────────────────────

  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setName(user.user_metadata.full_name as string)
    } else if (user?.user_metadata?.name) {
      setName(user.user_metadata.name as string)
    }
  }, [user])

  // ── Card entrance animation ────────────────────────────────────────────────

  useEffect(() => {
    setCardVisible(false)
    const t = setTimeout(() => setCardVisible(true), 30)
    return () => clearTimeout(t)
  }, [step])

  // ── Slug availability check (debounced 400ms) ─────────────────────────────

  useEffect(() => {
    if (!slug) {
      setSlugStatus('idle')
      setSlugMessage('')
      return
    }

    if (slug.length < 3) {
      setSlugStatus('invalid')
      setSlugMessage('Must be at least 3 characters.')
      return
    }

    setSlugStatus('checking')
    setSlugMessage('')

    const id = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return

        const res = await fetch(`/api/v1/workspace/check-slug?slug=${encodeURIComponent(slug)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json() as { available: boolean; reason?: string }

        if (json.available) {
          setSlugStatus('available')
          setSlugMessage('')
        } else {
          setSlugStatus('taken')
          setSlugMessage(json.reason ?? 'That name is not available.')
        }
      } catch {
        setSlugStatus('idle')
      }
    }, 400)

    return () => clearTimeout(id)
  }, [slug])

  // ── Auto-suggest slug from workspace name ─────────────────────────────────

  const handleWorkspaceNameChange = useCallback((value: string) => {
    setWorkspaceName(value)
    if (value.trim()) {
      setSlug(slugify(value))
    }
  }, [])

  // ── Save and finish ───────────────────────────────────────────────────────

  const finish = useCallback(async () => {
    setSaving(true)
    try {
      saveSetting('username', name.trim())
      saveSetting('workspace_name', workspaceName.trim() || name.trim())

      // Save workspace_slug to fey_settings via Supabase
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        await supabase
          .from('fey_settings')
          .upsert(
            {
              user_id:        session.user.id,
              workspace_slug: slug,
              workspace_name: workspaceName.trim() || name.trim(),
              portal_active:  true,
            },
            { onConflict: 'user_id' },
          )
      }

      // Handle pending share link (legacy — from pre-workspace share links)
      const shareToken = localStorage.getItem('fey_pending_share')
      if (shareToken) {
        try {
          const { data: share } = await supabase
            .from('shared_clients')
            .select('*')
            .eq('token', shareToken)
            .eq('active', true)
            .maybeSingle()

          if (share && session?.user?.id) {
            const { data: origClient } = await supabase
              .from('clients')
              .select('*')
              .eq('id', share.client_id)
              .maybeSingle()

            if (origClient) {
              const { data: newClient } = await supabase
                .from('clients')
                .insert({
                  name:     origClient.name as string,
                  color:    origClient.color as string,
                  logo:     (origClient.logo as string) || '',
                  retainer: 0,
                  user_id:  session.user.id,
                  app:      'fey',
                })
                .select()
                .single()

              if (newClient) {
                const { data: origTasks } = await supabase
                  .from('tasks')
                  .select('*')
                  .eq('client_id', origClient.id)

                if (origTasks?.length) {
                  await supabase.from('tasks').insert(
                    origTasks.map((t: Record<string, unknown>) => ({
                      client_id:  (newClient as Record<string, unknown>).id,
                      user_id:    session.user.id,
                      title:      t.title,
                      done:       t.done,
                      paid:       false,
                      amount:     (t.amount as number) || 0,
                      currency:   (t.currency as string) || 'NGN',
                      deadline:   (t.deadline as string | null) ?? null,
                      sort_order: (t.sort_order as number) ?? 0,
                      app:        'fey',
                    })),
                  )
                }
              }
            }
          }
        } catch { /* share import failure is non-fatal */ }
        localStorage.removeItem('fey_pending_share')
      }

      saveSetting('onboarding_complete', 'true')
      router.push('/')
    } finally {
      setSaving(false)
    }
  }, [name, workspaceName, slug, saveSetting, router])

  // ── Shared styles ──────────────────────────────────────────────────────────

  const textColor  = '#111111'
  const mutedColor = '#6B7280'

  const inputStyle: React.CSSProperties = {
    width:        '100%',
    padding:      '14px 16px',
    borderRadius: '12px',
    border:       '2px solid rgba(0,0,0,0.10)',
    background:   '#fff',
    fontSize:     '16px',
    outline:      'none',
    marginBottom: '8px',
    minHeight:    '44px',
    boxSizing:    'border-box',
    fontFamily:   'inherit',
    color:        '#111',
  }

  const btnPrimary: React.CSSProperties = {
    width:           '100%',
    padding:         '14px',
    borderRadius:    '50px',
    backgroundColor: 'var(--accent, #ED64A6)',
    color:           'white',
    fontSize:        '15px',
    fontWeight:      400,
    border:          'none',
    cursor:          'pointer',
    marginTop:       '16px',
    minHeight:       '44px',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             '8px',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius:    '20px',
    width:           '100%',
    maxWidth:        '440px',
    padding:         '32px',
    boxShadow:       '0 8px 32px rgba(0,0,0,0.10)',
    boxSizing:       'border-box',
    transition:      'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
    transform:       cardVisible ? 'translateY(0)' : 'translateY(80px)',
    opacity:         cardVisible ? 1 : 0,
  }

  // ── Step indicators ────────────────────────────────────────────────────────

  const steps: Step[] = ['name', 'workspace']
  const currentStepIndex = steps.indexOf(step)

  // ── Render ─────────────────────────────────────────────────────────────────

  const canAdvanceName = name.trim().length >= 2

  const canFinish =
    slugStatus === 'available' &&
    workspaceName.trim().length >= 1

  return (
    <div
      style={{
        minHeight:       '100vh',
        backgroundColor: '#F7F8FA',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'space-between',
        padding:         '40px 24px 0',
        boxSizing:       'border-box',
      }}
    >
      {/* Progress dots */}
      <div
        style={{
          position:  'fixed',
          top:       '24px',
          left:      '50%',
          transform: 'translateX(-50%)',
          display:   'flex',
          gap:       '6px',
          zIndex:    10,
        }}
      >
        {steps.map((s, i) => (
          <div
            key={s}
            style={{
              width:           i === currentStepIndex ? '20px' : '6px',
              height:          '6px',
              borderRadius:    '3px',
              backgroundColor: i === currentStepIndex
                ? 'var(--accent, #ED64A6)'
                : i < currentStepIndex
                  ? 'rgba(0,0,0,0.30)'
                  : 'rgba(0,0,0,0.12)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Card area */}
      <div
        style={{
          flex:            1,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           '100%',
          maxWidth:        '440px',
          paddingTop:      '40px',
        }}
      >
        <div ref={cardRef} key={step} style={cardStyle}>

          {/* ── Step 1: Name ── */}
          {step === 'name' && (
            <>
              <h2
                style={{
                  fontFamily:   'var(--heading-font)',
                  fontSize:     '1.5rem',
                  fontWeight:   400,
                  lineHeight:   1.3,
                  margin:       '0 0 24px 0',
                  color:        textColor,
                }}
              >
                What should we call you?
              </h2>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canAdvanceName) setStep('workspace') }}
                placeholder="Your name"
                autoFocus
                style={inputStyle}
              />

              <button
                onClick={() => setStep('workspace')}
                disabled={!canAdvanceName}
                style={{ ...btnPrimary, opacity: canAdvanceName ? 1 : 0.5, cursor: canAdvanceName ? 'pointer' : 'not-allowed' }}
              >
                Continue
              </button>
            </>
          )}

          {/* ── Step 2: Workspace ── */}
          {step === 'workspace' && (
            <>
              <h2
                style={{
                  fontFamily:   'var(--heading-font)',
                  fontSize:     '1.5rem',
                  fontWeight:   400,
                  lineHeight:   1.3,
                  margin:       '0 0 8px 0',
                  color:        textColor,
                }}
              >
                Set up your workspace
              </h2>

              <p style={{ fontSize: '14px', color: mutedColor, margin: '0 0 24px 0' }}>
                Your clients will access their portal at{' '}
                <strong style={{ color: textColor }}>
                  {slug || 'yourname'}.theruff.agency
                </strong>
              </p>

              {/* Workspace name */}
              <label
                style={{
                  fontSize:      '13px',
                  fontWeight:    500,
                  color:         mutedColor,
                  marginBottom:  '6px',
                  display:       'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Workspace name
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => handleWorkspaceNameChange(e.target.value)}
                placeholder="e.g. Abiola Studio"
                autoFocus
                style={{ ...inputStyle, marginBottom: '20px' }}
              />

              {/* Workspace slug */}
              <label
                style={{
                  fontSize:      '13px',
                  fontWeight:    500,
                  color:         mutedColor,
                  marginBottom:  '6px',
                  display:       'block',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                URL slug
              </label>

              <div style={{ position: 'relative', marginBottom: '4px' }}>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="your-slug"
                  style={{
                    ...inputStyle,
                    marginBottom:  0,
                    paddingRight:  '40px',
                    borderColor:
                      slugStatus === 'available' ? '#10B981'
                      : slugStatus === 'taken' || slugStatus === 'invalid' ? '#EF4444'
                      : 'rgba(0,0,0,0.10)',
                  }}
                />
                {/* Status icon */}
                <div
                  style={{
                    position:   'absolute',
                    right:      '14px',
                    top:        '50%',
                    transform:  'translateY(-50%)',
                    display:    'flex',
                    alignItems: 'center',
                  }}
                >
                  {slugStatus === 'checking' && (
                    <Loader2 size={16} style={{ color: mutedColor, animation: 'spin 1s linear infinite' }} />
                  )}
                  {slugStatus === 'available' && (
                    <Check size={16} style={{ color: '#10B981' }} />
                  )}
                </div>
              </div>

              {/* Preview URL */}
              <p style={{ fontSize: '12px', color: mutedColor, marginBottom: '4px' }}>
                {slug
                  ? <><span style={{ opacity: 0.5 }}>theruff.agency/</span><strong style={{ color: textColor }}>{slug}</strong></>
                  : <span style={{ opacity: 0.5 }}>theruff.agency/your-slug</span>
                }
              </p>

              {/* Status message */}
              {slugMessage && (
                <p
                  style={{
                    fontSize:     '12px',
                    color:        slugStatus === 'taken' || slugStatus === 'invalid' ? '#EF4444' : '#10B981',
                    marginBottom: '16px',
                    marginTop:    '4px',
                  }}
                >
                  {slugMessage}
                </p>
              )}
              {slugStatus === 'available' && !slugMessage && (
                <p style={{ fontSize: '12px', color: '#10B981', marginBottom: '16px', marginTop: '4px' }}>
                  This name is available!
                </p>
              )}

              <button
                onClick={() => void finish()}
                disabled={!canFinish || saving}
                style={{
                  ...btnPrimary,
                  opacity: canFinish && !saving ? 1 : 0.5,
                  cursor:  canFinish && !saving ? 'pointer' : 'not-allowed',
                }}
              >
                {saving && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
                {saving ? 'Setting up…' : (
                  <>
                    <Sparkles size={15} />
                    Launch my workspace
                  </>
                )}
              </button>

              <button
                onClick={() => setStep('name')}
                style={{
                  background: 'none',
                  border:     'none',
                  fontSize:   '13px',
                  color:      mutedColor,
                  cursor:     'pointer',
                  marginTop:  '12px',
                  width:      '100%',
                  textAlign:  'center',
                  padding:    '4px',
                }}
              >
                ← Back
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
