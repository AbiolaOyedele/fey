'use client'

/**
 * DemoContext — provides the same SettingsContext interface as SettingsContext.tsx
 * but backed entirely by in-memory state. No Supabase reads or writes occur.
 *
 * Also exposes DemoDataContext so pages can read client / task-group data
 * from the same useDemoData instance that powers the SettingsContext trash helpers.
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useDemoData, type UseDemoDataReturn } from '@/hooks/useDemoData'
import { SettingsContext } from '@/contexts/SettingsContext'
import { DEMO_SETTINGS } from '@/data/demoData'
import type { Settings, Toast, ToastOptions } from '@/types'

// ── DemoDataContext ────────────────────────────────────────────────────────────

export const DemoDataContext = createContext<UseDemoDataReturn | null>(null)

export function useDemoDataCtx(): UseDemoDataReturn | null {
  return useContext(DemoDataContext)
}

// ── DemoProvider ──────────────────────────────────────────────────────────────

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ ...DEMO_SETTINGS })
  const [toasts,   setToasts]   = useState<Toast[]>([])
  const toastSeq = useRef(0)

  const demoData = useDemoData()

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.accent_color)
  }, [settings.accent_color])

  useEffect(() => {
    if (!settings.font_family) {
      document.documentElement.style.setProperty('--body-font', "'DM Sans', 'Noto Sans', sans-serif")
      return
    }
    if (settings.font_family === 'custom') {
      if (!settings.custom_font) return
      const fontName = settings.custom_font_name || 'CustomBodyFont'
      let style = document.getElementById('custom-body-font-face') as HTMLStyleElement | null
      if (!style) {
        style = document.createElement('style')
        style.id = 'custom-body-font-face'
        document.head.appendChild(style)
      }
      style.textContent = `@font-face { font-family: '${fontName}'; src: url('${settings.custom_font}'); }`
      document.documentElement.style.setProperty('--body-font', `'${fontName}', 'Noto Sans', sans-serif`)
    }
  }, [settings.font_family, settings.custom_font, settings.custom_font_name])

  useEffect(() => {
    if (!settings.heading_font) {
      document.documentElement.style.setProperty('--heading-font', "'Fraunces', 'Noto Sans', serif")
      return
    }
    if (settings.heading_font === 'custom') {
      if (!settings.custom_heading_font) return
      const fontName = settings.custom_heading_font_name || 'CustomHeadingFont'
      let style = document.getElementById('custom-heading-font-face') as HTMLStyleElement | null
      if (!style) {
        style = document.createElement('style')
        style.id = 'custom-heading-font-face'
        document.head.appendChild(style)
      }
      style.textContent = `@font-face { font-family: '${fontName}'; src: url('${settings.custom_heading_font}'); }`
      document.documentElement.style.setProperty('--heading-font', `'${fontName}', 'Noto Sans', sans-serif`)
    }
  }, [settings.heading_font, settings.custom_heading_font, settings.custom_heading_font_name])

  // ── Settings mutations ────────────────────────────────────────────────────

  const saveSetting = useCallback(async (key: string, value: string | number): Promise<void> => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  const refreshExchangeRate = useCallback(async () => {
    try {
      const res  = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      const data = await res.json() as { rates?: { NGN?: number } }
      if (data?.rates?.NGN) {
        const rate = data.rates.NGN
        const now  = new Date().toISOString().split('T')[0]
        setSettings((prev) => ({ ...prev, exchange_rate: rate, exchange_rate_updated_at: now }))
      }
    } catch {
      // fail silently — demo still works with default rate
    }
  }, [])

  useEffect(() => { void refreshExchangeRate() }, [refreshExchangeRate])

  // ── Currency helpers ──────────────────────────────────────────────────────

  const convertAmount = useCallback((amount: number, storedCurrency: string) => {
    const n  = Number(amount) || 0
    const sc = storedCurrency || 'NGN'
    if (sc === settings.currency) return n
    const rate = Number(settings.exchange_rate) || 1
    if (sc === 'NGN' && settings.currency === 'USD') return n / rate
    if (sc === 'USD' && settings.currency === 'NGN') return n * rate
    return n
  }, [settings.currency, settings.exchange_rate])

  const formatMoney = useCallback((amount: number) => {
    const n = Number(amount) || 0
    if (settings.currency === 'USD') {
      return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }, [settings.currency])

  // ── Resolve palette color ─────────────────────────────────────────────────

  const resolveColor = useCallback((color: string): string => {
    if (!color || color === 'accent') return settings.accent_color
    return color
  }, [settings.accent_color])

  // ── Toast system ──────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, options?: ToastOptions): number => {
    toastSeq.current += 1
    const id = Date.now() * 1000 + (toastSeq.current % 1000)
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        description: options?.description,
        position: options?.position ?? 'bottom-right',
        action: options?.action,
      },
    ])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
    return id
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ── SettingsContext value ─────────────────────────────────────────────────

  const settingsValue = {
    settings,
    settingsLoading: false,
    hasFeySettings: true,
    saveSetting,
    refreshExchangeRate,
    convertAmount,
    formatMoney,
    resolveColor,
    trash: [],
    trashClient:         async (client: Parameters<typeof demoData.trashClient>[0]) =>
                           demoData.trashClient(client) as unknown as import('@/types').TrashItem | null,
    trashTask:           async (task: Parameters<typeof demoData.trashTask>[0], clientId: string) => {
                           demoData.trashTask(task, clientId); return null
                         },
    trashGroup:          async (group: Parameters<typeof demoData.taskGroupData.trashGroup>[0]) =>
                           demoData.taskGroupData.trashGroup(group) as unknown as import('@/types').TrashItem | null,
    trashStandaloneTask: async (task: Parameters<typeof demoData.taskGroupData.trashStandaloneTask>[0]) =>
                           demoData.taskGroupData.trashStandaloneTask(task) as unknown as import('@/types').TrashItem | null,
    restoreFromTrash:     async () => ({ success: true as const }),
    deleteForever:        async () => {},
    toasts,
    showToast,
    dismissToast,
  }

  return (
    <SettingsContext.Provider value={settingsValue}>
      <DemoDataContext.Provider value={demoData}>
        {children}
      </DemoDataContext.Provider>
    </SettingsContext.Provider>
  )
}
