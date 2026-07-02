'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { CURRENCY_SYMBOLS } from '@/lib/constants'
import { fontFaceSrc } from '@/utils/fontHelpers'
import type { Settings, Toast, TrashItem, Client, RestoreResult } from '@/types'

interface SettingsContextValue {
  settings: Settings
  settingsLoading: boolean
  /**
   * True when a fey_settings row exists in the DB for this user.
   * False when the user is brand new to Fey (no row at all).
   * Used by AppShell to decide whether to show onboarding — we must NOT
   * redirect users from other projects that share this Supabase DB but
   * happen to have onboarding_complete = 'false'.
   */
  hasFeySettings: boolean
  saveSetting: (key: string, value: string | number) => Promise<void>
  refreshExchangeRate: () => Promise<void>
  convertAmount: (amount: number, storedCurrency: string) => number
  formatMoney: (amount: number) => string
  resolveColor: (color: string) => string
  trash: TrashItem[]
  trashClient: (client: Client) => Promise<TrashItem | null>
  trashTask: (task: { id: string; title: string; [key: string]: unknown }, clientId: string, clientName: string) => Promise<TrashItem | null>
  trashGroup: (group: { id: string; name: string; [key: string]: unknown }) => Promise<TrashItem | null>
  trashStandaloneTask: (task: { id: string; title: string; [key: string]: unknown }) => Promise<TrashItem | null>
  restoreFromTrash: (trashItem: TrashItem, clients: Client[]) => Promise<RestoreResult>
  deleteForever: (trashId: string) => Promise<void>
  toasts: Toast[]
  showToast: (message: string, action?: { label: string; onClick: () => void }) => number
  dismissToast: (id: number) => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

const DEFAULT_CHANGELOG = [
  {
    version: '1.11.0', date: '2 Jul, 2026',
    features: [
      'Attach files to tasks — upload, preview, and download directly from the task row, detail drawer, or client portal',
      'Links in task descriptions and notes, contract signature blocks and notes, invoice notes, and feedback messages now render as clickable links',
    ],
    improvements: [],
    fixes: [
      'Raw (non-image/video) file attachments now delete correctly from storage — the public ID was previously stripped of its extension, so cleanup silently failed',
      'Welcome emails now send reliably — sending is awaited instead of fire-and-forget, since a serverless function can freeze pending work right after it responds',
      'Daily task digest no longer lists completed tasks under "recently assigned," and no longer double-lists a task under both "due" and "recently assigned"',
    ],
  },
  {
    version: '1.10.0', date: '1 Jul, 2026',
    features: [
      'Daily task digest email — due/overdue, recently assigned, and completed-yesterday tasks, sent every morning. Toggle it off in Settings → App.',
      'Welcome email — sent the moment your workspace is created, with a quick tour of clients, projects, tasks, and team.',
    ],
    improvements: [
      'Every workspace-related email now names the workspace it\'s from, since you can belong to more than one (chat alerts, task digest)',
      'Push notification failures now get logged instead of failing silently, and notification icons render correctly across browsers (previously broken on Safari/WebKit)',
    ],
    fixes: [
      'Several account emails (portal signup, contract/form send, invoice footer, payment redirect) were pointing at the wrong domain and have been corrected',
    ],
  },
  {
    version: '1.9.2', date: '1 Jul, 2026',
    features: [],
    improvements: [
      'Hover and press transitions in the sidebar, task list, and shared buttons/badges are more precise — no more brief flashes on unrelated properties',
      'Progress percentages and stat values use tabular numbers so digits stay aligned as they update',
    ],
    fixes: [
      'Task and sidebar checkboxes had a smaller tap target than their visible size — now easier to tap accurately, especially on mobile',
    ],
  },
  {
    version: '1.9.1', date: '18 May, 2026',
    features: [
      'Fey — AI-powered task assistant connected to WhatsApp. Send a message and Fey extracts tasks, notes, and deadlines automatically.',
      'WhatsApp integration via Twilio — connect your number in Settings → WhatsApp',
      'Fey workspace — tap any message thread to see full task detail with notes and deadline panel',
    ],
    improvements: ['Date picker now works reliably across all browsers'],
    fixes: [],
  },
  {
    version: '1.8.1', date: '26 Apr, 2026',
    features: ['Client contact details — store email, phone, website, tax ID, and address per client from the Edit modal'],
    improvements: [
      'Invoice Bill To section now auto-populates from saved client contact details when selecting a client',
      'Shared invoice now displays website and Tax ID fields in the From and Bill To sections',
    ],
    fixes: ['Invoice From/Bill To text misalignment in shared and downloaded invoices fixed'],
  },
  {
    version: '1.8.0', date: '25 April 2026',
    features: [
      'Full invoicing system — create, send, and track invoices',
      'Invoice builder with 4 layouts and inline editing',
      'Three creation paths: from tasks, from client, or blank',
      'Shareable invoice links — clients can view without an account',
      'PDF export via browser print dialog',
      'Settings expanded to 8 tabs: Profile, Branding, Business Info, Payments, General, Emails, Integrations, Billing',
    ],
    improvements: [], fixes: [],
  },
  {
    version: '1.7.0', date: '18 April 2026',
    features: [
      'Client workspace sharing with one-click shareable links',
      'Public shared workspace for recipients (no account needed)',
      'Per-member view/edit permission controls',
      'Task-only dashboard with completion rings and group cards',
    ],
    improvements: [], fixes: [],
  },
  { version: '1.6.0', date: 'April 2026', features: ['Tasks page with standalone task list and task groups', 'App mode switch (Clients Only, Tasks Only, Dual)', 'Changelog popup'], improvements: [], fixes: [] },
  { version: '1.5.0', date: 'April 2026', features: ['Task drag and drop with sort order persistence', 'Task filter dropdown'], improvements: [], fixes: [] },
  { version: '1.4.0', date: 'April 2026', features: ['Deadline tracking', 'Currency conversion system'], improvements: [], fixes: [] },
  { version: '1.3.0', date: 'April 2026', features: ['Font system', 'Client logos', 'Drag and drop client reordering'], improvements: [], fixes: [] },
  { version: '1.2.0', date: 'April 2026', features: ['Settings page', 'Trash with 45-day retention', 'Accent color theming'], improvements: [], fixes: [] },
  { version: '1.1.0', date: 'April 2026', features: ['Migrated to Supabase'], improvements: [], fixes: [] },
  { version: '1.0.0', date: 'April 2026', features: ['Initial build with React, Vite, Tailwind CSS'], improvements: [], fixes: [] },
]

const DEFAULTS: Settings = {
  username: '', company_name: '', logo: '',
  dashboard_heading: 'Track your\nwork & earnings', dashboard_subtitle: '',
  accent_color: '#ED64A6', card_size: 'medium', currency: 'NGN',
  exchange_rate: 1500, exchange_rates: '{"USD":1,"NGN":1500,"GBP":0.78,"EUR":0.92}', exchange_rate_updated_at: '',
  font_family: '', custom_font: '', custom_font_name: '',
  heading_font: '', custom_heading_font: '', custom_heading_font_name: '',
  client_order: '', clients_label: 'Clients', app_mode: 'dual',
  changelog: JSON.stringify(DEFAULT_CHANGELOG), whats_new_active: 'false', whats_new_version: '',
  onboarding_complete: 'false',
  avatar_url: '', hourly_rate: '',
  cover_image: '', invoice_layout: 'left_aligned', invoice_font_color: '#1a1a1a',
  invoice_bg_color: '#ffffff', invoice_bg_image: '',
  page_bg_type: 'color', page_bg_color: '#f9fafb', page_bg_image: '',
  color_mode: 'custom',
  business_email: '', business_phone: '', business_website: '', business_address: '', tax_id: '',
  payment_templates: '[]', show_payment_on_docs: 'true',
  invoice_language: 'English', default_tax_rate: '', invoice_prefix: 'INV-', invoice_next: '001',
  quote_prefix: 'QT-', quote_next: '001', receipt_prefix: 'REC-', receipt_next: '001',
  include_date_in_number: 'false', payment_terms_days: '14', quote_valid_days: '30',
  date_format: 'MM/DD/YYYY', default_invoice_notes: '', auto_generate_receipt: 'false',
  revoke_link_on_payment: 'false',
  email_acceptance: 'true', email_payment_received: 'true', email_stripe: 'true',
  email_project_activity: 'false', email_chat_from: 'true', email_chat_to: 'true', email_auto_reminders: 'false',
  portal_read_receipts: 'true',
  message_retention_days: '60',
  task_digest_enabled: 'true',
  checklist_dismissed: 'false', checklist_steps: '{}',
  guide_seen: 'false', fey_thread_order: '', fey_sort_mode: 'newest',
  // Fey-specific onboarding flag — never clashes with Workboard's onboarding_complete
  fey_onboarding_complete: 'false',
  // Set during /setup — the most reliable completion signal (non-null = setup done)
  workspace_slug: '',
}

/**
 * Promotes localStorage-cached onboarding flags onto a settings object.
 * Used as a write-through cache fallback when the DB row is absent or fails.
 */
function mergeLocalFlags(base: Settings, userId: string): Settings {
  const wbFlag  = localStorage.getItem(`wb:onboarding_complete:${userId}`)
  const feyFlag = localStorage.getItem(`fey:onboarding_complete:${userId}`)
  return {
    ...base,
    onboarding_complete:     wbFlag  === 'true' ? 'true' : base.onboarding_complete,
    fey_onboarding_complete: feyFlag === 'true' ? 'true' : base.fey_onboarding_complete,
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [hasFeySettings, setHasFeySettings] = useState(false)
  const [trash, setTrash] = useState<TrashItem[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])

  // Single source of truth for auth. SettingsProvider sits inside AuthProvider,
  // so we consume the already-resolved session instead of calling getSession()
  // a second time. The old duplicate resolution was strictly slower (extra
  // getSession + DB roundtrip), so it reported settingsLoading=false with DEFAULT
  // settings while AppShell's redirect check ran — bouncing the user to /setup on
  // every reload. Deriving userId from useAuth() closes that race.
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null

  useEffect(() => {
    // Hold the loading state until auth has actually resolved. Without this gate
    // the effect would run on the first render (userId still null) and prematurely
    // mark loading complete before we know who — or whether — the user is.
    if (authLoading) return
    if (userId === null) {
      setSettings(DEFAULTS)
      setSettingsLoading(false)
      return
    }
    ;(async () => {
      setSettingsLoading(true)
      try {
        const { data, error } = await supabase.from('fey_settings').select('*').eq('user_id', userId).maybeSingle()
        if (error) throw error
        if (data) {
          setHasFeySettings(true)
          const merged = { ...DEFAULTS }
          const knownKeys = new Set(Object.keys(DEFAULTS))
          for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
            if (knownKeys.has(k) && v !== null && v !== undefined) {
              (merged as Record<string, unknown>)[k] = v
            }
          }
          merged.exchange_rate = Number(merged.exchange_rate) || 1

          // Guard against boolean type drift from the DB schema
          if (typeof merged.fey_onboarding_complete === 'boolean')
            merged.fey_onboarding_complete = merged.fey_onboarding_complete ? 'true' : 'false'
          if (typeof merged.onboarding_complete === 'boolean')
            merged.onboarding_complete = merged.onboarding_complete ? 'true' : 'false'

          setSettings(mergeLocalFlags(merged, userId))
        } else {
          // No fey_settings row → brand new Fey user
          setHasFeySettings(false)
          setSettings(mergeLocalFlags({ ...DEFAULTS }, userId))
        }
      } catch {
        // Transient DB failure — localStorage cache keeps the user out of the setup loop
        setHasFeySettings(true)
        setSettings(mergeLocalFlags({ ...DEFAULTS }, userId))
      }

      try {
        const { data } = await supabase.from('trash').select('*').eq('user_id', userId).eq('app', 'fey').order('deleted_at', { ascending: false })
        if (data) {
          const now = new Date()
          const expired = data.filter((t: TrashItem) => new Date(t.expires_at) <= now)
          const valid   = data.filter((t: TrashItem) => new Date(t.expires_at) > now)
          if (expired.length > 0) {
            await supabase.from('trash').delete().in('id', expired.map((t: TrashItem) => t.id))
          }
          setTrash(valid)
        }
      } catch { /* ignore */ }

      setSettingsLoading(false)
    })()
  }, [userId, authLoading])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.accent_color)
  }, [settings.accent_color])

  useEffect(() => {
    if (!settings.font_family) {
      document.documentElement.style.setProperty('--body-font', "'NoirPro', sans-serif")
      return
    }
    if (settings.font_family === 'custom') {
      if (!settings.custom_font) return
      const fontName = settings.custom_font_name || 'CustomBodyFont'
      let style = document.getElementById('custom-body-font-face') as HTMLStyleElement | null
      if (!style) { style = document.createElement('style'); style.id = 'custom-body-font-face'; document.head.appendChild(style) }
      style.textContent = `@font-face { font-family: '${fontName}'; src: ${fontFaceSrc(settings.custom_font)}; }`
      document.documentElement.style.setProperty('--body-font', `'${fontName}', 'Noto Sans', sans-serif`)
    } else {
      const existing = document.getElementById('google-body-font-link')
      if (existing) existing.remove()
      const link = document.createElement('link')
      link.id = 'google-body-font-link'; link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${settings.font_family.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`
      document.head.appendChild(link)
      document.documentElement.style.setProperty('--body-font', `'${settings.font_family}', 'Noto Sans', sans-serif`)
    }
  }, [settings.font_family, settings.custom_font, settings.custom_font_name])

  useEffect(() => {
    if (!settings.heading_font) {
      document.documentElement.style.setProperty('--heading-font', "'NoirPro', sans-serif")
      return
    }
    if (settings.heading_font === 'custom') {
      if (!settings.custom_heading_font) return
      const fontName = settings.custom_heading_font_name || 'CustomHeadingFont'
      let style = document.getElementById('custom-heading-font-face') as HTMLStyleElement | null
      if (!style) { style = document.createElement('style'); style.id = 'custom-heading-font-face'; document.head.appendChild(style) }
      style.textContent = `@font-face { font-family: '${fontName}'; src: ${fontFaceSrc(settings.custom_heading_font)}; }`
      document.documentElement.style.setProperty('--heading-font', `'${fontName}', 'Noto Sans', sans-serif`)
    } else {
      const existing = document.getElementById('google-heading-font-link')
      if (existing) existing.remove()
      const link = document.createElement('link')
      link.id = 'google-heading-font-link'; link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${settings.heading_font.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`
      document.head.appendChild(link)
      document.documentElement.style.setProperty('--heading-font', `'${settings.heading_font}', 'Noto Sans', sans-serif`)
    }
  }, [settings.heading_font, settings.custom_heading_font, settings.custom_heading_font_name])

  const saveSetting = useCallback(async (key: string, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    if (key === 'onboarding_complete' && userId) {
      try { localStorage.setItem(`wb:onboarding_complete:${userId}`, String(value)) } catch { /* storage unavailable */ }
    }
    if (key === 'fey_onboarding_complete' && userId) {
      try { localStorage.setItem(`fey:onboarding_complete:${userId}`, String(value)) } catch { /* storage unavailable */ }
    }
    if (!userId) return
    const { error } = await supabase.from('fey_settings').upsert({ user_id: userId, [key]: String(value) }, { onConflict: 'user_id' })
    if (error) console.warn('[settings] save failed', key, error)
  }, [userId])

  const refreshExchangeRate = useCallback(async () => {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      const data = await res.json() as { rates?: Record<string, number> }
      if (data?.rates) {
        const rates = { USD: 1, NGN: data.rates.NGN || 1500, GBP: data.rates.GBP || 0.78, EUR: data.rates.EUR || 0.92 }
        const now = new Date().toISOString().split('T')[0]
        const ratesJson = JSON.stringify(rates)
        await saveSetting('exchange_rates', ratesJson)
        await saveSetting('exchange_rate', rates.NGN)
        await saveSetting('exchange_rate_updated_at', now)
        setSettings((prev) => ({ ...prev, exchange_rates: ratesJson, exchange_rate: rates.NGN, exchange_rate_updated_at: now }))
      }
    } catch { /* fail silently */ }
  }, [saveSetting])

  const convertAmount = useCallback((amount: number, storedCurrency: string): number => {
    const n = Number(amount) || 0
    const sc = storedCurrency || 'NGN'
    const dc = settings.currency || 'NGN'
    if (sc === dc) return n
    let rates: Record<string, number> | null = null
    try { rates = JSON.parse(settings.exchange_rates) as Record<string, number> } catch { rates = null }
    if (rates && rates[sc] && rates[dc]) return n * (rates[dc] / rates[sc])
    const rate = Number(settings.exchange_rate) || 1500
    if (sc === 'NGN' && dc === 'USD') return n / rate
    if (sc === 'USD' && dc === 'NGN') return n * rate
    return n
  }, [settings.currency, settings.exchange_rates, settings.exchange_rate])

  const formatMoney = useCallback((amount: number): string => {
    const n = Number(amount) || 0
    const symbol = CURRENCY_SYMBOLS[settings.currency] || '₦'
    return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }, [settings.currency])

  const showToast = useCallback((message: string, action?: { label: string; onClick: () => void }): number => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, action }])
    setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)) }, 5000)
    return id
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const TRASH_TTL = 45 * 24 * 60 * 60 * 1000

  const trashClient = useCallback(async (client: Client): Promise<TrashItem | null> => {
    if (!userId) return null
    const payload = { item_type: 'client', item_name: client.name, item_data: JSON.stringify({ ...client }), deleted_at: new Date().toISOString(), expires_at: new Date(Date.now() + TRASH_TTL).toISOString(), user_id: userId, app: 'fey' }
    await supabase.from('tasks').delete().eq('client_id', client.id)
    await supabase.from('retainer_payments').delete().eq('client_id', client.id)
    await supabase.from('clients').delete().eq('id', client.id)
    const { data } = await supabase.from('trash').insert(payload).select().single()
    if (data) setTrash((prev) => [data as TrashItem, ...prev])
    return data as TrashItem | null
  }, [userId, TRASH_TTL])

  const trashTask = useCallback(async (task: { id: string; title: string; [key: string]: unknown }, clientId: string, clientName: string): Promise<TrashItem | null> => {
    if (!userId) return null
    const payload = { item_type: 'task', item_name: task.title, item_data: JSON.stringify({ ...task, client_id: clientId, client_name: clientName }), deleted_at: new Date().toISOString(), expires_at: new Date(Date.now() + TRASH_TTL).toISOString(), user_id: userId, app: 'fey' }
    await supabase.from('tasks').delete().eq('id', task.id)
    const { data } = await supabase.from('trash').insert(payload).select().single()
    if (data) setTrash((prev) => [data as TrashItem, ...prev])
    return data as TrashItem | null
  }, [userId, TRASH_TTL])

  const trashGroup = useCallback(async (group: { id: string; name: string; [key: string]: unknown }): Promise<TrashItem | null> => {
    if (!userId) return null
    const payload = { item_type: 'task_group', item_name: group.name, item_data: JSON.stringify({ ...group }), deleted_at: new Date().toISOString(), expires_at: new Date(Date.now() + TRASH_TTL).toISOString(), user_id: userId, app: 'fey' }
    await supabase.from('standalone_tasks').delete().eq('task_group_id', group.id)
    await supabase.from('task_groups').delete().eq('id', group.id)
    const { data } = await supabase.from('trash').insert(payload).select().single()
    if (data) setTrash((prev) => [data as TrashItem, ...prev])
    return data as TrashItem | null
  }, [userId, TRASH_TTL])

  const trashStandaloneTask = useCallback(async (task: { id: string; title: string; [key: string]: unknown }): Promise<TrashItem | null> => {
    if (!userId) return null
    const payload = { item_type: 'standalone_task', item_name: task.title, item_data: JSON.stringify({ ...task }), deleted_at: new Date().toISOString(), expires_at: new Date(Date.now() + TRASH_TTL).toISOString(), user_id: userId, app: 'fey' }
    await supabase.from('standalone_tasks').delete().eq('id', task.id)
    const { data } = await supabase.from('trash').insert(payload).select().single()
    if (data) setTrash((prev) => [data as TrashItem, ...prev])
    return data as TrashItem | null
  }, [userId, TRASH_TTL])

  const restoreFromTrash = useCallback(async (trashItem: TrashItem, clients: Client[]): Promise<RestoreResult> => {
    if (!userId) return { error: 'Not authenticated' }
    const itemData = JSON.parse(trashItem.item_data) as Record<string, unknown>

    if (trashItem.item_type === 'client') {
      const { data: newClient, error: cErr } = await supabase.from('clients').insert({ name: itemData.name, color: itemData.color, retainer: itemData.retainer || 0, user_id: userId, app: 'fey' }).select().single()
      if (cErr) return { error: cErr.message }
      const tasks = itemData.tasks as Array<Record<string, unknown>> | undefined
      if (tasks && tasks.length > 0) {
        await supabase.from('tasks').insert(tasks.map((t) => ({ client_id: (newClient as { id: string }).id, title: t.title, done: t.done, paid: t.paid, amount: t.amount, created_at: t.createdAt || new Date().toISOString(), user_id: userId, app: 'fey' })))
      }
      const retainerPaid = itemData.retainerPaid as Record<string, boolean> | undefined
      if (retainerPaid) {
        const rpRows = Object.entries(retainerPaid).filter(([, paid]) => paid).map(([month]) => ({ client_id: (newClient as { id: string }).id, month, paid: true, user_id: userId, app: 'fey' }))
        if (rpRows.length > 0) await supabase.from('retainer_payments').insert(rpRows)
      }
      await supabase.from('trash').delete().eq('id', trashItem.id)
      setTrash((prev) => prev.filter((t) => t.id !== trashItem.id))
      return { success: true }

    } else if (trashItem.item_type === 'task') {
      const parentId = itemData.client_id as string
      const parentExists = clients?.some((c) => c.id === parentId)
      if (!parentExists) {
        const clientName = itemData.client_name as string || 'Restored Client'
        const { data: newClient, error: cErr } = await supabase.from('clients').insert({ name: clientName, color: '#F0FDF4', retainer: 0, user_id: userId, app: 'fey' }).select().single()
        if (cErr) return { error: cErr.message }
        await supabase.from('tasks').insert({ client_id: (newClient as { id: string }).id, title: itemData.title, done: itemData.done, paid: itemData.paid, amount: itemData.amount, created_at: itemData.createdAt || new Date().toISOString(), user_id: userId, app: 'fey' })
        await supabase.from('trash').delete().eq('id', trashItem.id)
        setTrash((prev) => prev.filter((t) => t.id !== trashItem.id))
        return { success: true, autoRestoredClient: true, createdPlaceholder: true, clientName }
      }
      await supabase.from('tasks').insert({ client_id: parentId, title: itemData.title, done: itemData.done, paid: itemData.paid, amount: itemData.amount, created_at: itemData.createdAt || new Date().toISOString(), user_id: userId, app: 'fey' })
      await supabase.from('trash').delete().eq('id', trashItem.id)
      setTrash((prev) => prev.filter((t) => t.id !== trashItem.id))
      return { success: true }

    } else if (trashItem.item_type === 'task_group') {
      const { data: newGroup, error: gErr } = await supabase.from('task_groups').insert({ name: itemData.name, color: itemData.color, icon: itemData.icon || '', sort_order: itemData.sort_order || 0, user_id: userId, app: 'fey' }).select().single()
      if (gErr) return { error: gErr.message }
      const tasks = itemData.tasks as Array<Record<string, unknown>> | undefined
      if (tasks && tasks.length > 0) {
        await supabase.from('standalone_tasks').insert(tasks.map((t) => ({ task_group_id: (newGroup as { id: string }).id, title: t.title, done: t.done, deadline: t.deadline || null, sort_order: t.sort_order || 0, user_id: userId, app: 'fey' })))
      }
      await supabase.from('trash').delete().eq('id', trashItem.id)
      setTrash((prev) => prev.filter((t) => t.id !== trashItem.id))
      return { success: true }

    } else if (trashItem.item_type === 'standalone_task') {
      await supabase.from('standalone_tasks').insert({ title: itemData.title, done: itemData.done, deadline: itemData.deadline || null, task_group_id: null, sort_order: itemData.sort_order || 0, user_id: userId, app: 'fey' })
      await supabase.from('trash').delete().eq('id', trashItem.id)
      setTrash((prev) => prev.filter((t) => t.id !== trashItem.id))
      return { success: true }
    }

    await supabase.from('trash').delete().eq('id', trashItem.id)
    setTrash((prev) => prev.filter((t) => t.id !== trashItem.id))
    return { success: true }
  }, [userId])

  const deleteForever = useCallback(async (trashId: string) => {
    await supabase.from('trash').delete().eq('id', trashId)
    setTrash((prev) => prev.filter((t) => t.id !== trashId))
  }, [])

  return (
    <SettingsContext.Provider
      value={{
        settings, settingsLoading, hasFeySettings, saveSetting, refreshExchangeRate,
        convertAmount, formatMoney,
        resolveColor: (color: string) =>
          settings.color_mode === 'accent' ? settings.accent_color : (color || settings.accent_color),
        trash, trashClient, trashTask, trashGroup, trashStandaloneTask, restoreFromTrash, deleteForever,
        toasts, showToast, dismissToast,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
