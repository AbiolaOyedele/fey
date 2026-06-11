'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Sparkles, Check } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = [
  { code: 'NGN', label: 'NGN ₦' },
  { code: 'USD', label: 'USD $' },
  { code: 'GBP', label: 'GBP £' },
  { code: 'EUR', label: 'EUR €' },
] as const

const APP_MODES_OPTS = [
  { value: 'clients', label: 'Client work & payments' },
  { value: 'tasks', label: 'Personal tasks' },
  { value: 'dual', label: 'Both' },
] as const

const PRESET_COLORS = [
  '#667EEA', '#F56565', '#ED8936', '#38B2AC',
  '#9F7AEA', '#ED64A6', '#48BB78', '#4299E1',
] as const

const FONT_OPTIONS = [
  { value: '', label: 'Default (NoirPro)' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Urbanist', label: 'Urbanist' },
  { value: 'Spectral', label: 'Spectral' },
  { value: 'Spectral SC', label: 'Spectral SC' },
  { value: 'Playfair Display', label: 'Playfair Display' },
] as const

const CARD_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardId =
  | 'name'
  | 'company'
  | 'logo'
  | 'accent'
  | 'fonts'
  | 'mode_currency'
  | 'dashboard'
  | 'card_size'
  | 'welcome'

interface CardDef {
  id: CardId
  color: string
  canSkip?: boolean
}

type CardSizeValue = 'small' | 'medium' | 'large'
type AppModeValue = 'clients' | 'tasks' | 'dual' | ''
type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR' | ''

// ---------------------------------------------------------------------------
// Card definitions
// ---------------------------------------------------------------------------

const REGULAR_CARDS: CardDef[] = [
  { id: 'name', color: '#FDE8E8' },
  { id: 'company', color: '#FEF3C7' },
  { id: 'mode_currency', color: '#D1FAE5' },
  { id: 'welcome', color: '#DBEAFE' },
]

const NERD_CARDS: CardDef[] = [
  { id: 'name', color: '#FCE7F3', canSkip: false },
  { id: 'company', color: '#E0F2FE', canSkip: false },
  { id: 'logo', color: '#FEF9C3', canSkip: true },
  { id: 'accent', color: '#DCFCE7', canSkip: false },
  { id: 'fonts', color: '#F3E8FF', canSkip: true },
  { id: 'mode_currency', color: '#FFE4E6', canSkip: false },
  { id: 'dashboard', color: '#ECFDF5', canSkip: true },
  { id: 'card_size', color: '#FFF7ED', canSkip: false },
  { id: 'welcome', color: '#F0F9FF', canSkip: false },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeHex = (v: string): string =>
  v.trim().startsWith('#') ? v.trim() : `#${v.trim()}`

const isValidHex = (v: string): boolean =>
  /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(v))

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter()
  const { saveSetting } = useSettings()

  // Check if user came from a share link (only on client)
  const pendingShareToken =
    typeof window !== 'undefined'
      ? (localStorage.getItem('fey_pending_share') ?? null)
      : null

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [isNerd, setIsNerd] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)

  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  // Default to 'dual' if coming from share link
  const [appMode, setAppMode] = useState<AppModeValue>(
    pendingShareToken ? 'dual' : ''
  )
  const [currency, setCurrency] = useState<CurrencyCode>('')
  const [logo, setLogo] = useState('')
  const [accentColor, setAccentColor] = useState('#ED64A6')
  const [accentHex, setAccentHex] = useState('#ED64A6')
  const [headingFont, setHeadingFont] = useState('')
  const [bodyFont, setBodyFont] = useState('')
  const [customHeadingFont, setCustomHeadingFont] = useState('')
  const [customHeadingFontName, setCustomHeadingFontName] = useState('')
  const [customBodyFont, setCustomBodyFont] = useState('')
  const [customBodyFontName, setCustomBodyFontName] = useState('')
  const [dashboardHeading, setDashboardHeading] = useState('')
  const [dashboardSubtitle, setDashboardSubtitle] = useState('')
  const [cardSize, setCardSize] = useState<CardSizeValue>('medium')

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------

  const nameRef = useRef<HTMLInputElement>(null)
  const companyRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const headingFontRef = useRef<HTMLInputElement>(null)
  const bodyFontRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const cards = isNerd ? NERD_CARDS : REGULAR_CARDS
  const currentCard = cards[cardIndex]

  const canAdvance =
    currentCard.id === 'mode_currency' ? !!(appMode && currency) : true

  // -------------------------------------------------------------------------
  // Card entrance animation
  // -------------------------------------------------------------------------

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = 'translateY(80px)'
    el.style.opacity = '0'
    const t = setTimeout(() => {
      el.style.transition =
        'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease'
      el.style.transform = 'translateY(0)'
      el.style.opacity = '1'
    }, 20)
    return () => clearTimeout(t)
  }, [cardIndex, isNerd])

  // -------------------------------------------------------------------------
  // Shared style objects
  // -------------------------------------------------------------------------

  const textColor = '#111111'
  const mutedColor = '#6B7280'

  const continueStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px',
    borderRadius: '50px',
    backgroundColor: 'var(--accent, #ED64A6)',
    color: 'white',
    fontSize: '15px',
    fontWeight: 400,
    border: 'none',
    cursor: canAdvance ? 'pointer' : 'not-allowed',
    opacity: canAdvance ? 1 : 0.5,
    marginTop: '8px',
    minHeight: '44px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '2px solid rgba(0,0,0,0.10)',
    background: '#fff',
    fontSize: '16px',
    outline: 'none',
    marginBottom: '20px',
    minHeight: '44px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    color: '#111',
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    borderRadius: '50px',
    border: active
      ? '2px solid var(--accent, #ED64A6)'
      : '2px solid rgba(0,0,0,0.10)',
    background: active ? 'var(--accent, #ED64A6)' : '#fff',
    color: active ? '#fff' : '#111',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: active ? 500 : 400,
    transition: 'all 0.2s ease',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  })

  const headingStyle: React.CSSProperties = {
    fontFamily: 'var(--heading-font)',
    fontSize: '1.5rem',
    fontWeight: 400,
    lineHeight: 1.3,
    margin: '0 0 24px 0',
    color: textColor,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    color: mutedColor,
    marginBottom: '10px',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const completeOnboarding = useCallback(async () => {
    saveSetting('onboarding_complete', 'true')

    // Handle pending share link — copy client + tasks to new user
    const token = localStorage.getItem('fey_pending_share')
    if (token) {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const newUserId = sessionData?.session?.user?.id

        if (newUserId) {
          const { data: share } = await supabase
            .from('shared_clients')
            .select('*')
            .eq('token', token)
            .eq('active', true)
            .maybeSingle()

          if (share) {
            const { data: origClient } = await supabase
              .from('clients')
              .select('*')
              .eq('id', share.client_id)
              .maybeSingle()

            if (origClient) {
              const { data: newClient } = await supabase
                .from('clients')
                .insert({
                  name: origClient.name as string,
                  color: origClient.color as string,
                  logo: (origClient.logo as string) || '',
                  retainer: 0,
                  user_id: newUserId,
                  app: 'fey',
                })
                .select()
                .single()

              if (newClient) {
                const { data: origTasks } = await supabase
                  .from('tasks')
                  .select('*')
                  .eq('client_id', origClient.id)

                if (origTasks && origTasks.length > 0) {
                  await supabase.from('tasks').insert(
                    origTasks.map((t: Record<string, unknown>) => ({
                      client_id: (newClient as Record<string, unknown>).id,
                      user_id: newUserId,
                      title: t.title,
                      done: t.done,
                      paid: false,
                      amount: (t.amount as number) || 0,
                      currency: (t.currency as string) || 'NGN',
                      deadline: (t.deadline as string | null) ?? null,
                      sort_order: (t.sort_order as number) ?? 0,
                      app: 'fey',
                    }))
                  )
                }
              }
            }
          }
        }
      } catch {
        // silently fail — not critical
      }
      localStorage.removeItem('fey_pending_share')
    }

    router.push('/')
  }, [saveSetting, router])

  const saveCardSettings = useCallback(
    (cardId: CardId) => {
      switch (cardId) {
        case 'name':
          saveSetting('username', name.trim())
          break
        case 'company':
          saveSetting('company_name', company.trim())
          break
        case 'logo':
          saveSetting('logo', logo)
          break
        case 'accent':
          saveSetting('accent_color', accentColor)
          document.documentElement.style.setProperty('--accent', accentColor)
          break
        case 'fonts':
          saveSetting('heading_font', headingFont)
          saveSetting('font_family', bodyFont)
          if (customHeadingFont) {
            saveSetting('custom_heading_font', customHeadingFont)
            saveSetting('custom_heading_font_name', customHeadingFontName)
          }
          if (customBodyFont) {
            saveSetting('custom_body_font', customBodyFont)
            saveSetting('custom_body_font_name', customBodyFontName)
          }
          break
        case 'mode_currency':
          saveSetting('app_mode', appMode || 'dual')
          saveSetting('currency', currency || 'NGN')
          break
        case 'dashboard':
          saveSetting('dashboard_heading', dashboardHeading)
          saveSetting('dashboard_subtitle', dashboardSubtitle)
          break
        case 'card_size':
          saveSetting('card_size', cardSize)
          break
        case 'welcome':
          void completeOnboarding()
          break
        default:
          break
      }
    },
    [
      name,
      company,
      logo,
      accentColor,
      headingFont,
      bodyFont,
      customHeadingFont,
      customHeadingFontName,
      customBodyFont,
      customBodyFontName,
      appMode,
      currency,
      dashboardHeading,
      dashboardSubtitle,
      cardSize,
      saveSetting,
      completeOnboarding,
    ]
  )

  const advance = useCallback(
    async (skipCurrent = false) => {
      const el = cardRef.current
      if (el) {
        el.style.transition = 'transform 0.3s ease, opacity 0.3s ease'
        el.style.transform = 'scale(0.95)'
        el.style.opacity = '0'
      }

      if (!skipCurrent) {
        saveCardSettings(currentCard.id)
      }

      if (currentCard.id === 'welcome' && !skipCurrent) {
        // completeOnboarding already called in saveCardSettings
        return
      }

      await new Promise<void>((r) => setTimeout(r, 300))

      if (cardIndex >= cards.length - 1) {
        void completeOnboarding()
        return
      }

      setCardIndex((i) => i + 1)
    },
    [cardIndex, cards.length, currentCard, saveCardSettings, completeOnboarding]
  )

  const skipAll = useCallback(() => {
    saveSetting('onboarding_complete', 'true')
    router.push('/')
  }, [saveSetting, router])

  const switchNerd = useCallback(() => {
    setIsNerd(true)
    setCardIndex(0)
  }, [])

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        alert('Logo must be under 2MB.')
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          setLogo(ev.target.result)
        }
      }
      reader.readAsDataURL(file)
    },
    []
  )

  const handleFontUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, type: 'heading' | 'body') => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        alert('Font file must be under 2MB.')
        return
      }
      const allowed = ['.ttf', '.otf', '.woff2']
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (!allowed.includes(ext)) {
        alert('Please upload a .ttf, .otf, or .woff2 font file.')
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (typeof ev.target?.result !== 'string') return
        const data = ev.target.result
        if (type === 'heading') {
          setCustomHeadingFont(data)
          setCustomHeadingFontName(file.name.replace(/\.[^.]+$/, ''))
        } else {
          setCustomBodyFont(data)
          setCustomBodyFontName(file.name.replace(/\.[^.]+$/, ''))
        }
      }
      reader.readAsDataURL(file)
    },
    []
  )

  // -------------------------------------------------------------------------
  // Card content renderer
  // -------------------------------------------------------------------------

  function renderCardContent() {
    switch (currentCard.id) {
      case 'name':
        return (
          <>
            <h2 style={headingStyle}>
              {isNerd
                ? 'What should we call you?'
                : 'First, what should we call you?'}
            </h2>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) void advance()
              }}
              placeholder="Your name"
              autoFocus
              style={inputStyle}
            />
            <button
              onClick={() => {
                if (name.trim()) void advance()
              }}
              disabled={!name.trim()}
              style={{
                ...continueStyle,
                opacity: name.trim() ? 1 : 0.5,
                cursor: name.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Continue
            </button>
          </>
        )

      case 'company':
        return (
          <>
            <h2 style={headingStyle}>
              {isNerd
                ? 'Your company or brand name?'
                : "What's your company or brand?"}
            </h2>
            <input
              ref={companyRef}
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && company.trim()) void advance()
              }}
              placeholder="Company or brand name"
              autoFocus
              style={inputStyle}
            />
            <button
              onClick={() => {
                if (company.trim()) void advance()
              }}
              disabled={!company.trim()}
              style={{
                ...continueStyle,
                opacity: company.trim() ? 1 : 0.5,
                cursor: company.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Continue
            </button>
          </>
        )

      case 'logo':
        return (
          <>
            <h2 style={headingStyle}>Upload your logo</h2>
            <p
              style={{
                fontSize: '14px',
                color: mutedColor,
                marginBottom: '20px',
                marginTop: 0,
              }}
            >
              Optional — you can skip this for now.
            </p>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
            />

            <div
              onClick={() => logoInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(0,0,0,0.15)',
                borderRadius: '12px',
                padding: '32px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.5)',
                marginBottom: '20px',
                minHeight: '120px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt="Logo preview"
                  style={{
                    maxHeight: '80px',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px',
                  }}
                />
              ) : (
                <>
                  <ImageIcon size={28} style={{ color: mutedColor, margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '14px', color: mutedColor }}>
                    Click to upload image
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: mutedColor,
                      opacity: 0.7,
                    }}
                  >
                    Max 2MB
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {currentCard.canSkip && (
                <button
                  onClick={() => void advance(true)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '50px',
                    border: '2px solid rgba(0,0,0,0.10)',
                    background: 'rgba(255,255,255,0.6)',
                    color: mutedColor,
                    fontSize: '15px',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  Skip
                </button>
              )}
              <button
                onClick={() => void advance()}
                style={{ ...continueStyle, flex: 2, marginTop: 0 }}
              >
                {logo ? 'Continue' : 'Continue without logo'}
              </button>
            </div>
          </>
        )

      case 'accent':
        return (
          <>
            <h2 style={headingStyle}>Pick your accent color</h2>
            <p
              style={{
                fontSize: '14px',
                color: mutedColor,
                marginBottom: '20px',
                marginTop: 0,
              }}
            >
              This color will be used for buttons and highlights across the app.
            </p>

            {/* Color swatches */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                marginBottom: '20px',
              }}
            >
              {PRESET_COLORS.map((color) => (
                <div
                  key={color}
                  onClick={() => {
                    setAccentColor(color)
                    setAccentHex(color)
                  }}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    cursor: 'pointer',
                    border:
                      accentColor === color
                        ? '3px solid #111'
                        : '3px solid transparent',
                    boxSizing: 'border-box',
                    transition: 'border 0.15s ease',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {/* Hex input */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <input
                type="text"
                value={accentHex}
                onChange={(e) => {
                  setAccentHex(e.target.value)
                  if (isValidHex(e.target.value)) {
                    setAccentColor(normalizeHex(e.target.value))
                  }
                }}
                placeholder="#ED64A6"
                style={{
                  ...inputStyle,
                  marginBottom: 0,
                  flex: 1,
                  fontFamily: 'var(--body-font)',
                }}
              />
              {/* Live preview pill */}
              <div
                style={{
                  padding: '10px 20px',
                  borderRadius: '50px',
                  backgroundColor: accentColor,
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                Preview
              </div>
            </div>

            <button onClick={() => void advance()} style={continueStyle}>
              Continue
            </button>
          </>
        )

      case 'fonts':
        return (
          <>
            <h2 style={headingStyle}>Choose your fonts</h2>
            <p
              style={{
                fontSize: '14px',
                color: mutedColor,
                marginBottom: '20px',
                marginTop: 0,
              }}
            >
              Customize the typography of your workspace.
            </p>

            <div
              style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}
            >
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Heading font</label>
                <select
                  value={headingFont}
                  onChange={(e) => setHeadingFont(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '2px solid rgba(0,0,0,0.08)',
                    background: 'rgba(255,255,255,0.7)',
                    fontSize: '14px',
                    outline: 'none',
                    minHeight: '44px',
                    cursor: 'pointer',
                  }}
                >
                  {FONT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Body font</label>
                <select
                  value={bodyFont}
                  onChange={(e) => setBodyFont(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '2px solid rgba(0,0,0,0.08)',
                    background: 'rgba(255,255,255,0.7)',
                    fontSize: '14px',
                    outline: 'none',
                    minHeight: '44px',
                    cursor: 'pointer',
                  }}
                >
                  {FONT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom font uploads */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Custom fonts (optional)</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <input
                    ref={headingFontRef}
                    type="file"
                    accept=".ttf,.otf,.woff2"
                    onChange={(e) => handleFontUpload(e, 'heading')}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => headingFontRef.current?.click()}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '2px dashed rgba(0,0,0,0.12)',
                      background: 'rgba(255,255,255,0.5)',
                      color: mutedColor,
                      fontSize: '12px',
                      cursor: 'pointer',
                      minHeight: '44px',
                      textAlign: 'center',
                    }}
                  >
                    {customHeadingFontName ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Check size={12} />
                        {customHeadingFontName}
                      </span>
                    ) : 'Upload heading font'}
                  </button>
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    ref={bodyFontRef}
                    type="file"
                    accept=".ttf,.otf,.woff2"
                    onChange={(e) => handleFontUpload(e, 'body')}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => bodyFontRef.current?.click()}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '2px dashed rgba(0,0,0,0.12)',
                      background: 'rgba(255,255,255,0.5)',
                      color: mutedColor,
                      fontSize: '12px',
                      cursor: 'pointer',
                      minHeight: '44px',
                      textAlign: 'center',
                    }}
                  >
                    {customBodyFontName ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Check size={12} />
                        {customBodyFontName}
                      </span>
                    ) : 'Upload body font'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {currentCard.canSkip && (
                <button
                  onClick={() => void advance(true)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '50px',
                    border: '2px solid rgba(0,0,0,0.10)',
                    background: 'rgba(255,255,255,0.6)',
                    color: mutedColor,
                    fontSize: '15px',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  Skip
                </button>
              )}
              <button
                onClick={() => void advance()}
                style={{ ...continueStyle, flex: 2, marginTop: 0 }}
              >
                Continue
              </button>
            </div>
          </>
        )

      case 'mode_currency':
        return (
          <>
            <h2 style={headingStyle}>
              {pendingShareToken ? 'Your currency' : 'How will you use Fey?'}
            </h2>

            {!pendingShareToken && (
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {APP_MODES_OPTS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppMode(opt.value)}
                      style={pillStyle(appMode === opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>Your currency</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCurrency(c.code)}
                    style={{
                      ...pillStyle(currency === c.code),
                      flex: '1 0 auto',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (canAdvance) void advance()
              }}
              disabled={!canAdvance}
              style={continueStyle}
            >
              Continue
            </button>
          </>
        )

      case 'dashboard':
        return (
          <>
            <h2 style={headingStyle}>Customize your dashboard</h2>
            <p
              style={{
                fontSize: '14px',
                color: mutedColor,
                marginBottom: '16px',
                marginTop: 0,
              }}
            >
              Set a personal greeting for your dashboard.
            </p>

            <label style={labelStyle}>Dashboard heading</label>
            <input
              type="text"
              value={dashboardHeading}
              onChange={(e) => setDashboardHeading(e.target.value)}
              placeholder={
                name ? `Good morning, ${name}!` : 'Good morning!'
              }
              style={inputStyle}
            />

            <label style={labelStyle}>Subtitle</label>
            <input
              type="text"
              value={dashboardSubtitle}
              onChange={(e) => setDashboardSubtitle(e.target.value)}
              placeholder="Here's what's happening today."
              style={inputStyle}
            />

            {/* Live preview */}
            {(dashboardHeading || dashboardSubtitle) && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: mutedColor,
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Preview
                </div>
                {dashboardHeading && (
                  <div
                    style={{
                      fontFamily: 'var(--heading-font)',
                      fontSize: '1.1rem',
                      fontWeight: 400,
                      color: textColor,
                      marginBottom: '4px',
                    }}
                  >
                    {dashboardHeading}
                  </div>
                )}
                {dashboardSubtitle && (
                  <div style={{ fontSize: '14px', color: mutedColor }}>
                    {dashboardSubtitle}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              {currentCard.canSkip && (
                <button
                  onClick={() => void advance(true)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    borderRadius: '50px',
                    border: '2px solid rgba(0,0,0,0.10)',
                    background: 'rgba(255,255,255,0.6)',
                    color: mutedColor,
                    fontSize: '15px',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  Skip
                </button>
              )}
              <button
                onClick={() => void advance()}
                style={{ ...continueStyle, flex: 2, marginTop: 0 }}
              >
                Continue
              </button>
            </div>
          </>
        )

      case 'card_size':
        return (
          <>
            <h2 style={headingStyle}>How big should your cards be?</h2>
            <p
              style={{
                fontSize: '14px',
                color: mutedColor,
                marginBottom: '20px',
                marginTop: 0,
              }}
            >
              Choose how cards appear across your workspace.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '28px',
              }}
            >
              {CARD_SIZES.map((size) => (
                <button
                  key={size.value}
                  onClick={() => setCardSize(size.value)}
                  style={{
                    flex: 1,
                    padding: '16px 8px 12px',
                    borderRadius: '14px',
                    border:
                      cardSize === size.value
                        ? '2px solid var(--accent, #ED64A6)'
                        : '2px solid rgba(0,0,0,0.08)',
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Mini card mockup */}
                  <div
                    style={{
                      width:
                        size.value === 'small'
                          ? '48px'
                          : size.value === 'medium'
                            ? '60px'
                            : '72px',
                      background: 'rgba(0,0,0,0.06)',
                      borderRadius: '6px',
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        height: '6px',
                        background: 'rgba(0,0,0,0.15)',
                        borderRadius: '3px',
                        width: '70%',
                      }}
                    />
                    <div
                      style={{
                        height: '4px',
                        background: 'rgba(0,0,0,0.08)',
                        borderRadius: '2px',
                        width: '90%',
                      }}
                    />
                    <div
                      style={{
                        height: '4px',
                        background: 'rgba(0,0,0,0.08)',
                        borderRadius: '2px',
                        width: '60%',
                      }}
                    />
                    {size.value !== 'small' && (
                      <div
                        style={{
                          height: '4px',
                          background: 'rgba(0,0,0,0.06)',
                          borderRadius: '2px',
                          width: '80%',
                          marginTop: '2px',
                        }}
                      />
                    )}
                    {size.value === 'large' && (
                      <div
                        style={{
                          height: '4px',
                          background: 'rgba(0,0,0,0.06)',
                          borderRadius: '2px',
                          width: '50%',
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: cardSize === size.value ? 600 : 400,
                      color:
                        cardSize === size.value ? textColor : mutedColor,
                    }}
                  >
                    {size.label}
                  </span>
                </button>
              ))}
            </div>

            <button onClick={() => void advance()} style={continueStyle}>
              Continue
            </button>
          </>
        )

      case 'welcome':
        return (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <Sparkles size={48} style={{ color: 'var(--accent, #ED64A6)' }} />
              </div>
              <h2
                style={{
                  ...headingStyle,
                  fontSize: '1.8rem',
                  marginBottom: '12px',
                }}
              >
                Welcome, {name || 'there'}!
              </h2>
              <p
                style={{
                  fontSize: '15px',
                  color: mutedColor,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {company ? `${company} is all set.` : "You're all set."}{' '}
                Let&apos;s build something great.
              </p>
            </div>

            {isNerd && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.5)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {name && (
                  <div style={{ fontSize: '13px', color: textColor }}>
                    <span style={{ color: mutedColor }}>Name: </span>
                    {name}
                  </div>
                )}
                {company && (
                  <div style={{ fontSize: '13px', color: textColor }}>
                    <span style={{ color: mutedColor }}>Company: </span>
                    {company}
                  </div>
                )}
                {appMode && (
                  <div style={{ fontSize: '13px', color: textColor }}>
                    <span style={{ color: mutedColor }}>Mode: </span>
                    {APP_MODES_OPTS.find((m) => m.value === appMode)?.label ??
                      appMode}
                  </div>
                )}
                {currency && (
                  <div style={{ fontSize: '13px', color: textColor }}>
                    <span style={{ color: mutedColor }}>Currency: </span>
                    {CURRENCIES.find((c) => c.code === currency)?.label ??
                      currency}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => void completeOnboarding()}
              style={{
                ...continueStyle,
                fontSize: '16px',
                padding: '16px',
                marginTop: 0,
              }}
            >
              Go to dashboard
            </button>
          </>
        )

      default:
        return null
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: isNerd ? '#000' : '#F7F8FA',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '40px 24px 0',
        position: 'relative',
        transition: 'background-color 0.5s ease',
        boxSizing: 'border-box',
      }}
    >
      {/* Progress dots */}
      <div
        style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '6px',
          zIndex: 10,
        }}
      >
        {cards.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === cardIndex ? '20px' : '6px',
              height: '6px',
              borderRadius: '3px',
              backgroundColor:
                i === cardIndex
                  ? 'var(--accent, #ED64A6)'
                  : isNerd
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(0,0,0,0.12)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* Card area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '440px',
          paddingTop: '40px',
        }}
      >
        <div
          ref={cardRef}
          key={`${isNerd ? 'nerd' : 'reg'}-${cardIndex}`}
          style={{
            backgroundColor: '#fff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '440px',
            padding: '32px',
            boxShadow: isNerd
              ? '0 8px 40px rgba(255,255,255,0.08)'
              : '0 8px 32px rgba(0,0,0,0.10)',
            boxSizing: 'border-box',
          }}
        >
          {renderCardContent()}
        </div>
      </div>

      {/* Bottom-left action buttons */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 10,
        }}
      >
        {!isNerd && (
          <button
            onClick={switchNerd}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12px',
              color: '#9CA3AF',
              cursor: 'pointer',
              textAlign: 'left',
              padding: '4px 0',
            }}
          >
            Nerd mode
          </button>
        )}
        <button
          onClick={skipAll}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '12px',
            color: '#9CA3AF',
            cursor: 'pointer',
            textAlign: 'left',
            padding: '4px 0',
          }}
        >
          Skip onboarding
        </button>
      </div>
    </div>
  )
}
