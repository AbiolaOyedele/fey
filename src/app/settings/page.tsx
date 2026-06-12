'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useSupabaseData } from '@/hooks/useSupabaseData'
import { supabase } from '@/lib/supabase'
import { IS_DEMO } from '@/lib/constants'
import type { TrashItem } from '@/types'
import {
  Upload, RefreshCw, Trash2, RotateCcw, X, User,
  History, LogOut, ChevronDown, ChevronRight,
  CreditCard, Edit3, Image, Camera, Mail,
  Building2, Phone, Globe, MapPin, FileText, Link2,
  Plus, Bell, DollarSign, MessageSquare, Loader2,
  Zap, CheckCircle2, ArrowRight, AlertTriangle,
} from 'lucide-react'
import WhatsNewPopup from '@/components/ui/WhatsNewPopup'
import ChangelogPopup from '@/components/ui/ChangelogPopup'

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? 'http://localhost:3001'

const THEME_COLORS = [
  '#ED64A6', '#F56565', '#ED8936', '#38B2AC',
  '#9F7AEA', '#667EEA', '#48BB78', '#4299E1',
]

// ── Navigation ────────────────────────────────────────────────────────────────

const NAV = [
  'Profile', 'Brand', 'Business', 'Invoices',
  'App', 'CRM & Portal', 'Notifications', 'Integrations', 'Billing',
] as const

type NavSection = typeof NAV[number]

// Map legacy ?tab= param values to new names
const TAB_ALIASES: Record<string, NavSection> = {
  'Branding':      'Brand',
  'Business Info': 'Business',
  'Payments':      'Invoices',
  'General':       'App',
  'Emails':        'Notifications',
  'CRM':           'CRM & Portal',
  'Portal':        'CRM & Portal',
  'WhatsApp':      'Integrations',
}

function resolveTab(tab: string | null): NavSection {
  if (!tab) return 'Profile'
  if ((NAV as readonly string[]).includes(tab)) return tab as NavSection
  return TAB_ALIASES[tab] ?? 'Profile'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalizeHex = (val: string): string => { const t = val.trim(); return t.startsWith('#') ? t : `#${t}` }
const isValidHex   = (val: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(val))

function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
function todayStr(): string { return new Date().toISOString().split('T')[0] }
function escapeCsvField(val: unknown): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}
function rowToCSV(fields: unknown[]): string { return fields.map(escapeCsvField).join(',') }

// ── Shared UI components ──────────────────────────────────────────────────────

interface ToggleProps { checked: boolean; onChange: (v: boolean) => void }
function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
      style={checked ? { backgroundColor: 'var(--accent)' } : { backgroundColor: '#e5e7eb' }}
    >
      <span
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
        style={{ left: checked ? '18px' : '2px' }}
      />
    </button>
  )
}

interface SettingRowProps {
  icon?: React.ComponentType<{ size?: number; className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  border?: boolean
  badge?: React.ReactNode
  children?: React.ReactNode
}
function SettingRow({ icon: Icon, title, description, action, border = true, badge, children }: SettingRowProps) {
  return (
    <div className={`flex items-center gap-4 py-4 ${border ? 'border-b border-gray-100' : ''}`}>
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800">{title}</p>
          {badge}
        </div>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        {children}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

interface SectionGroupProps { title: string; children: React.ReactNode; className?: string }
function SectionGroup({ title, children, className = '' }: SectionGroupProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{title}</p>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5">
        {children}
      </div>
    </div>
  )
}

interface NavItemProps { label: string; active: boolean; onClick: () => void }
function NavItem({ label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
        active ? 'text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
      }`}
      style={active ? { backgroundColor: 'var(--accent)' } : {}}
    >
      {label}
    </button>
  )
}

const SoonBadge = () => (
  <span className="px-1.5 py-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full uppercase tracking-wide">
    Soon
  </span>
)

const inputClass = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:bg-white transition-all'

// ── Payment template types ────────────────────────────────────────────────────

interface TemplateField { label: string; value: string }
interface PaymentTemplate { name: string; method: string; fields: TemplateField[] }

const PAYMENT_METHODS = ['Bank Transfer', 'Mobile Money', 'Cash', 'Cheque', 'Crypto', 'Other'] as const

const METHOD_DEFAULT_FIELDS: Record<string, string[]> = {
  'Bank Transfer':  ['Account Name', 'Account Number', 'Bank Name', 'Sort Code'],
  'Mobile Money':   ['Phone Number', 'Provider'],
  'Cash':           [],
  'Cheque':         ['Payable To'],
  'Crypto':         ['Wallet Address', 'Network'],
  'Other':          [],
}

const ALL_TEMPLATE_FIELDS = ['Account Name', 'Account Number', 'Bank Name', 'Sort Code', 'IBAN', 'BIC/SWIFT', 'Routing Number', 'Phone Number', 'Provider', 'Wallet Address', 'Network', 'Payable To', 'Reference']

// ── WhatsApp connection type ──────────────────────────────────────────────────

interface WaConnection { phone_number: string; verified: boolean; connected_at: string | null }

// ── Main component ────────────────────────────────────────────────────────────

function SettingsPageInner() {
  const {
    settings, saveSetting, refreshExchangeRate,
    trash, restoreFromTrash, deleteForever, showToast, dismissToast,
  } = useSettings()
  const { user, signOut } = useAuth()
  const { clients, refetch } = useSupabaseData(user?.id)

  const searchParams   = useSearchParams()
  const [activeSection, setActiveSection] = useState<NavSection>(() => resolveTab(searchParams?.get('tab')))

  useEffect(() => {
    const tab = searchParams?.get('tab')
    setActiveSection(resolveTab(tab))
  }, [searchParams])

  // ── Refs ───────────────────────────────────────────────────────────────────
  const avatarRef      = useRef<HTMLInputElement>(null)
  const logoRef        = useRef<HTMLInputElement>(null)
  const coverRef       = useRef<HTMLInputElement>(null)
  const bodyFontRef    = useRef<HTMLInputElement>(null)
  const headingFontRef = useRef<HTMLInputElement>(null)
  const importFileRef  = useRef<HTMLInputElement>(null)

  // ── Shared state ───────────────────────────────────────────────────────────
  const [accentHexInput, setAccentHexInput] = useState('')
  const [refreshing, setRefreshing]         = useState(false)
  const [whatsNewOpen, setWhatsNewOpen]     = useState(false)
  const [changelogOpen, setChangelogOpen]   = useState(false)
  const [importing, setImporting]           = useState(false)

  // ── Profile state ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState(settings.username || (user?.user_metadata?.full_name as string | undefined) || '')
  const [pwForm, setPwForm]     = useState({ new: '', confirm: '' })
  const [pwError, setPwError]   = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleteText, setDeleteText] = useState('')

  // ── Invoices state ─────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<PaymentTemplate[]>(() => {
    try { return JSON.parse(settings.payment_templates || '[]') as PaymentTemplate[] } catch { return [] }
  })
  const [showTplForm, setShowTplForm]   = useState(false)
  const [editingTpl, setEditingTpl]     = useState<number | null>(null)
  const [tplForm, setTplForm]           = useState<PaymentTemplate>({ name: '', method: 'Bank Transfer', fields: [] })
  const [addFieldOpen, setAddFieldOpen] = useState(false)

  // ── App state ──────────────────────────────────────────────────────────────
  const [clientsLabelInput, setClientsLabelInput] = useState(settings.clients_label || 'Clients')

  // ── CRM & Portal state ────────────────────────────────────────────────────
  // The workspace slug (= subdomain) is set at onboarding and shown read-only
  // from settings.workspace_slug. Only portal_active is editable here.
  const [portalActive,         setPortalActive]         = useState(false)
  const [portalSaving,         setPortalSaving]         = useState(false)
  const [portalLoaded,         setPortalLoaded]         = useState(false)

  // ── WhatsApp state ─────────────────────────────────────────────────────────
  const [waConnection,   setWaConnection]   = useState<WaConnection | null>(null)
  const [waLoading,      setWaLoading]      = useState(true)
  const [waPhone,        setWaPhone]        = useState('')
  const [waCodeSent,     setWaCodeSent]     = useState(false)
  const [waCode,         setWaCode]         = useState('')
  const [waSending,      setWaSending]      = useState(false)
  const [waVerifying,    setWaVerifying]    = useState(false)
  const [waError,        setWaError]        = useState('')
  const [waDisconnecting, setWaDisconnecting] = useState(false)

  // Fetch WhatsApp on mount
  useEffect(() => {
    if (!user?.id) return
    void supabase
      .from('whatsapp_connections')
      .select('phone_number, verified, connected_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setWaConnection((data as WaConnection | null) ?? null)
        if ((data as WaConnection | null)?.phone_number) setWaPhone((data as WaConnection).phone_number)
        setWaLoading(false)
      })
  }, [user?.id])

  // ── File upload handlers ───────────────────────────────────────────────────

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { showToast('Avatar must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onloadend = () => void saveSetting('avatar_url', reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) { showToast('Logo must be under 500 KB'); return }
    const reader = new FileReader()
    reader.onloadend = () => void saveSetting('logo', reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1 * 1024 * 1024) { showToast('Cover must be under 1 MB'); return }
    const reader = new FileReader()
    reader.onloadend = () => void saveSetting('cover_image', reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleBodyFontUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { showToast('Font must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onloadend = () => {
      const name = file.name.replace(/\.[^.]+$/, '')
      void saveSetting('custom_font', reader.result as string)
      void saveSetting('custom_font_name', name)
      void saveSetting('font_family', 'custom')
    }
    reader.readAsDataURL(file)
  }

  const handleHeadingFontUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { showToast('Font must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onloadend = () => {
      const name = file.name.replace(/\.[^.]+$/, '')
      void saveSetting('custom_heading_font', reader.result as string)
      void saveSetting('custom_heading_font_name', name)
      void saveSetting('heading_font', 'custom')
    }
    reader.readAsDataURL(file)
  }

  // ── Misc handlers ──────────────────────────────────────────────────────────

  const handleRefreshRate = async (): Promise<void> => {
    setRefreshing(true)
    await refreshExchangeRate()
    setRefreshing(false)
    showToast('Exchange rate updated')
  }

  const handleAccentHex = (val: string): void => {
    setAccentHexInput(val)
    if (isValidHex(val)) void saveSetting('accent_color', normalizeHex(val))
  }

  const handleChangePassword = async (): Promise<void> => {
    setPwError('')
    if (pwForm.new !== pwForm.confirm) { setPwError('Passwords do not match'); return }
    if (pwForm.new.length < 6) { setPwError('Minimum 6 characters'); return }
    const { error } = await supabase.auth.updateUser({ password: pwForm.new })
    if (error) { setPwError(error.message) }
    else { setPwSuccess(true); setPwForm({ new: '', confirm: '' }) }
  }

  const handleDeleteAccount = async (): Promise<void> => {
    if (deleteText !== 'DELETE') return
    try {
      const uid = user?.id
      if (!uid) return
      await supabase.from('tasks').delete().eq('user_id', uid)
      await supabase.from('retainer_payments').delete().eq('user_id', uid)
      await supabase.from('clients').delete().eq('user_id', uid)
      await supabase.from('standalone_tasks').delete().eq('user_id', uid)
      await supabase.from('task_groups').delete().eq('user_id', uid)
      await supabase.from('shared_clients').delete().eq('user_id', uid)
      await supabase.from('trash').delete().eq('user_id', uid)
      await supabase.from('fey_settings').delete().eq('user_id', uid)
      await signOut()
    } catch (err) {
      showToast(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // ── Template handlers ──────────────────────────────────────────────────────

  const saveTemplates = useCallback((tpls: PaymentTemplate[]): void => {
    setTemplates(tpls)
    void saveSetting('payment_templates', JSON.stringify(tpls))
  }, [saveSetting])

  const openNewTemplate = (): void => {
    setEditingTpl(null)
    const defaultFields = (METHOD_DEFAULT_FIELDS['Bank Transfer'] ?? []).map((label) => ({ label, value: '' }))
    setTplForm({ name: '', method: 'Bank Transfer', fields: defaultFields })
    setShowTplForm(true)
    setAddFieldOpen(false)
  }

  const handleMethodChange = (method: string): void => {
    const defaultFields = (METHOD_DEFAULT_FIELDS[method] ?? []).map((label) => ({ label, value: '' }))
    setTplForm((f) => ({ ...f, method, fields: defaultFields }))
  }

  const openEditTemplate = (tpl: PaymentTemplate, idx: number): void => {
    setEditingTpl(idx)
    const fields = (tpl.fields ?? []).map((f) =>
      typeof f === 'string' ? { label: f as string, value: '' } : f
    )
    setTplForm({ name: tpl.name, method: tpl.method, fields })
    setShowTplForm(true)
    setAddFieldOpen(false)
  }

  const saveTplForm = (): void => {
    if (!tplForm.name.trim()) { showToast('Template needs a name'); return }
    if (editingTpl !== null) {
      saveTemplates(templates.map((t, i) => i === editingTpl ? { ...tplForm } : t))
    } else {
      saveTemplates([...templates, { ...tplForm }])
    }
    setShowTplForm(false)
  }

  const deleteTemplate = (idx: number): void => saveTemplates(templates.filter((_, i) => i !== idx))

  const addFieldToTpl = (field: string): void => {
    if (tplForm.fields.find((f) => f.label === field)) return
    setTplForm((f) => ({ ...f, fields: [...f.fields, { label: field, value: '' }] }))
    setAddFieldOpen(false)
  }

  const removeFieldFromTpl = (label: string): void => {
    setTplForm((f) => ({ ...f, fields: f.fields.filter((x) => x.label !== label) }))
  }

  const updateFieldValue = (label: string, value: string): void => {
    setTplForm((f) => ({ ...f, fields: f.fields.map((x) => x.label === label ? { ...x, value } : x) }))
  }

  // ── Trash handlers ─────────────────────────────────────────────────────────

  const handleRestore = async (item: TrashItem): Promise<void> => {
    const result = await restoreFromTrash(item, clients)
    if (result?.error) { showToast(`Restore failed: ${result.error}`); return }
    let toastId: number | null = null
    const timer = setTimeout(() => { toastId = showToast('Restored successfully, refreshing...') }, 1000)
    if (refetch) await refetch()
    clearTimeout(timer)
    if (toastId !== null) dismissToast(toastId)
    showToast(result?.autoRestoredClient ? 'Client and task restored' : `"${item.item_name}" restored`)
  }

  const handleDeleteForever = async (item: TrashItem): Promise<void> => {
    await deleteForever(item.id)
    showToast(`"${item.item_name}" permanently deleted`)
  }

  // ── Data export / import ───────────────────────────────────────────────────

  const handleExportData = (): void => {
    const headers = 'client_name,client_color,retainer_amount,task_title,task_done,task_paid,task_amount,task_currency,task_deadline,task_created_at'
    const rows: string[] = []
    ;(clients ?? []).forEach((c) => {
      if (!c.tasks || c.tasks.length === 0) {
        rows.push(rowToCSV([c.name, c.color ?? '', c.retainer ?? 0, '', '', '', '', '', '', '']))
      } else {
        c.tasks.forEach((t) => rows.push(rowToCSV([c.name, c.color ?? '', c.retainer ?? 0, t.title ?? '', t.done ? 'true' : 'false', t.paid ? 'true' : 'false', t.amount ?? 0, t.currency ?? 'NGN', t.deadline ?? '', t.createdAt ?? ''])))
      }
    })
    downloadCSV(`fey-export-${todayStr()}.csv`, [headers, ...rows].join('\n'))
  }

  const handleExportPayments = (): void => {
    const headers = 'client_name,task_title,amount,currency,type,month,paid_at'
    const rows: string[] = []
    ;(clients ?? []).forEach((c) => {
      ;(c.tasks ?? []).forEach((t) => {
        if (t.paid) rows.push(rowToCSV([c.name, t.title ?? '', t.amount ?? 0, t.currency ?? 'NGN', 'task', '', '']))
      })
      if (c.retainerPaid && typeof c.retainerPaid === 'object') {
        Object.entries(c.retainerPaid).forEach(([month, paid]) => {
          if (paid) rows.push(rowToCSV([c.name, '', c.retainer ?? 0, 'NGN', 'retainer', month, '']))
        })
      }
    })
    downloadCSV(`fey-payments-${todayStr()}.csv`, [headers, ...rows].join('\n'))
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (IS_DEMO) { showToast('Import is disabled in demo mode'); return }
    setImporting(true)
    try {
      const text  = await file.text()
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) throw new Error('CSV appears to be empty or has no data rows')
      const expected = 'client_name,client_color,retainer_amount,task_title,task_done,task_paid,task_amount,task_currency,task_deadline,task_created_at'
      if (lines[0].trim() !== expected) throw new Error('CSV headers do not match Fey export format')
      const dataRows = lines.slice(1).map((line) => {
        const fields: string[] = []; let current = ''; let inQ = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"') { if (inQ && line[i + 1] === '"') { current += '"'; i++ } else inQ = !inQ }
          else if (ch === ',' && !inQ) { fields.push(current); current = '' }
          else current += ch
        }
        fields.push(current)
        return {
          client_name: fields[0] ?? '', client_color: fields[1] ?? '#ED64A6',
          retainer_amount: fields[2] ?? '0', task_title: fields[3] ?? '',
          task_done: fields[4] ?? 'false', task_paid: fields[5] ?? 'false',
          task_amount: fields[6] ?? '0', task_currency: fields[7] ?? 'NGN',
          task_deadline: fields[8] ?? '', task_created_at: fields[9] ?? '',
        }
      })
      const grouped: Record<string, typeof dataRows> = {}
      dataRows.forEach((row) => { if (!row.client_name) return; if (!grouped[row.client_name]) grouped[row.client_name] = []; grouped[row.client_name].push(row) })
      let ci = 0; let ti = 0
      for (const [name, rows] of Object.entries(grouped)) {
        const existing = (clients ?? []).find((c) => c.name.toLowerCase() === name.toLowerCase())
        let clientId: string
        if (existing) {
          clientId = existing.id
        } else {
          const { data: nc, error: cErr } = await supabase
            .from('clients')
            .insert({ name, color: rows[0].client_color ?? '#ED64A6', retainer: parseFloat(rows[0].retainer_amount) || 0, user_id: user?.id, app: 'fey' })
            .select().single()
          if (cErr) throw cErr
          clientId = (nc as { id: string }).id
          ci++
        }
        for (const row of rows) {
          if (!row.task_title) continue
          const { error: tErr } = await supabase.from('tasks').insert({
            client_id: clientId, title: row.task_title, done: row.task_done === 'true',
            paid: row.task_paid === 'true', amount: parseFloat(row.task_amount) || 0,
            currency: row.task_currency || 'NGN', deadline: row.task_deadline || null,
            user_id: user?.id, app: 'fey',
          })
          if (tErr) throw tErr
          ti++
        }
      }
      showToast(`Imported ${ci} client${ci !== 1 ? 's' : ''} and ${ti} task${ti !== 1 ? 's' : ''}`)
      if (refetch) await refetch()
    } catch (err) {
      showToast(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally { setImporting(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Section renderers
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Profile ────────────────────────────────────────────────────────────────

  const renderProfile = (): React.ReactNode => {
    const googleUser =
      user?.app_metadata?.provider === 'google' ||
      (user?.app_metadata?.providers as string[] | undefined)?.includes('google')

    return (
      <>
        <SectionGroup title="Your details">
          {/* Avatar */}
          <div className="py-4 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="relative">
                {settings.avatar_url ? (
                  <img src={settings.avatar_url} alt="Avatar" className="w-16 h-16 rounded-2xl object-cover border border-gray-200" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                    <User size={24} className="text-gray-300" />
                  </div>
                )}
                <button
                  onClick={() => avatarRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center"
                >
                  <Camera size={12} className="text-gray-500" />
                </button>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Profile photo</p>
                <p className="text-xs text-gray-400 mt-0.5">Max 2 MB</p>
                {settings.avatar_url && (
                  <button onClick={() => void saveSetting('avatar_url', '')} className="text-xs text-red-400 hover:text-red-600 mt-1 underline underline-offset-2">Remove</button>
                )}
              </div>
            </div>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {/* Display name */}
          <div className="py-4 border-b border-gray-100">
            <label className="block text-xs font-medium text-gray-500 mb-2">Display name</label>
            <div className="flex gap-2">
              <input
                type="text" value={fullName} placeholder="Your name"
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
              <button
                onClick={() => void saveSetting('username', fullName.trim())}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Save
              </button>
            </div>
          </div>

          {/* Email (read-only) */}
          <SettingRow icon={Mail} title="Email" description={user?.email ?? ''} border={false} />
        </SectionGroup>

        {/* Hourly rate */}
        <SectionGroup title="Billing defaults">
          <div className="py-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Default hourly rate</label>
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <input
                  type="number" min="0" placeholder="e.g. 150"
                  value={settings.hourly_rate}
                  onChange={(e) => void saveSetting('hourly_rate', e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-gray-400 mt-1.5">Saved for reference — use it when creating invoices</p>
              </div>
            </div>
          </div>
        </SectionGroup>

        {/* Password */}
        {!googleUser && (
          <SectionGroup title="Password">
            <div className="py-4 space-y-3">
              <input
                type="password" placeholder="New password (min 6 characters)"
                value={pwForm.new}
                onChange={(e) => { setPwForm((f) => ({ ...f, new: e.target.value })); setPwError(''); setPwSuccess(false) }}
                className={inputClass}
              />
              <input
                type="password" placeholder="Confirm new password"
                value={pwForm.confirm}
                onChange={(e) => { setPwForm((f) => ({ ...f, confirm: e.target.value })); setPwError(''); setPwSuccess(false) }}
                className={inputClass}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleChangePassword() }}
              />
              {pwError   && <p className="text-xs text-red-500">{pwError}</p>}
              {pwSuccess  && <p className="text-xs text-green-600">Password updated</p>}
              <button
                onClick={() => void handleChangePassword()}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Update password
              </button>
            </div>
          </SectionGroup>
        )}

        {/* Account actions */}
        <SectionGroup title="Account">
          <SettingRow
            icon={LogOut}
            title="Sign out"
            description="Sign out of your account on this device"
            border={deleteStep === 0}
            action={
              <button
                onClick={() => void signOut()}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Sign out
              </button>
            }
          />
          {deleteStep === 0 ? (
            <SettingRow
              icon={AlertTriangle}
              title="Delete account"
              description="Permanently delete your account and all data"
              border={false}
              action={
                <button
                  onClick={() => setDeleteStep(1)}
                  className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              }
            />
          ) : (
            <div className="py-4">
              <p className="text-sm font-medium text-red-600 mb-1">This cannot be undone</p>
              <p className="text-xs text-gray-400 mb-3">Type <span className="font-mono font-bold text-gray-700">DELETE</span> to confirm</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text" placeholder="DELETE" value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  className="flex-1 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm outline-none focus:border-red-400 transition-all"
                />
                <button
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleteText !== 'DELETE'}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
              <button onClick={() => { setDeleteStep(0); setDeleteText('') }} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">Cancel</button>
            </div>
          )}
        </SectionGroup>
      </>
    )
  }

  // ── Brand ──────────────────────────────────────────────────────────────────

  const renderBrand = (): React.ReactNode => {
    const fontOptions = [
      { label: 'System default (NoirPro)', value: '' },
      { label: 'Inter',        value: 'Inter' },
      { label: 'DM Sans',      value: 'DM Sans' },
      { label: 'Sora',         value: 'Sora' },
      { label: 'Nunito',       value: 'Nunito' },
      { label: 'Raleway',      value: 'Raleway' },
      { label: 'Space Grotesk', value: 'Space Grotesk' },
      { label: 'Playfair Display', value: 'Playfair Display' },
      { label: 'Custom font…', value: 'custom' },
    ]

    return (
      <>
        {/* Accent Color */}
        <SectionGroup title="Accent color">
          <div className="py-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {THEME_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => void saveSetting('accent_color', c)}
                  className="w-9 h-9 rounded-xl transition-transform hover:scale-110 flex-shrink-0"
                  style={{ backgroundColor: c, outline: settings.accent_color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl border border-gray-200 flex-shrink-0" style={{ backgroundColor: settings.accent_color }} />
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Custom hex</label>
                <input
                  type="text" placeholder={settings.accent_color}
                  value={accentHexInput}
                  onChange={(e) => handleAccentHex(e.target.value)}
                  onFocus={() => setAccentHexInput(settings.accent_color)}
                  onBlur={() => setAccentHexInput('')}
                  className="w-full max-w-[160px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono outline-none focus:border-gray-400 transition-all"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-2">Color mode</label>
              <div className="flex gap-2">
                {([['custom', 'Each client color'], ['accent', 'Accent everywhere']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => void saveSetting('color_mode', val)}
                    className="px-3 py-2 rounded-xl text-xs font-medium border transition-colors"
                    style={settings.color_mode === val ? { borderColor: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 8%, white)', color: 'var(--accent)' } : { borderColor: '#e5e7eb', color: '#6b7280' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionGroup>

        {/* Logo & Cover */}
        <SectionGroup title="Logo & cover">
          {/* Logo */}
          <div className="py-4 border-b border-gray-100">
            <div className="flex items-center gap-4">
              {settings.logo ? (
                <img src={settings.logo} alt="Logo" className="w-12 h-12 rounded-xl object-contain border border-gray-100 bg-gray-50" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <Image size={18} className="text-gray-300" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Logo</p>
                <p className="text-xs text-gray-400 mt-0.5">Used on invoices and the client portal. Max 500 KB</p>
                <div className="flex gap-3 mt-1.5">
                  <button onClick={() => logoRef.current?.click()} className="text-xs font-medium underline underline-offset-2 text-gray-500 hover:text-gray-700">Upload</button>
                  {settings.logo && <button onClick={() => void saveSetting('logo', '')} className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2">Remove</button>}
                </div>
              </div>
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>

          {/* Cover */}
          <div className="py-4">
            {settings.cover_image ? (
              <div className="relative">
                <img src={settings.cover_image} alt="Cover" className="w-full h-24 object-cover rounded-xl border border-gray-200" />
                <button
                  onClick={() => void saveSetting('cover_image', '')}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center"
                >
                  <X size={12} className="text-gray-500" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => coverRef.current?.click()}
                className="w-full h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:border-gray-300 transition-colors"
              >
                <Upload size={18} className="text-gray-300" />
                <p className="text-xs text-gray-400">Upload cover image (max 1 MB)</p>
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </div>
        </SectionGroup>

        {/* Card size */}
        <SectionGroup title="Client cards">
          <div className="py-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Card size</label>
            <div className="flex gap-2">
              {(['compact', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => void saveSetting('card_size', size)}
                  className="flex-1 py-2 rounded-xl text-xs font-medium border capitalize transition-colors"
                  style={settings.card_size === size ? { borderColor: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 8%, white)', color: 'var(--accent)' } : { borderColor: '#e5e7eb', color: '#6b7280' }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </SectionGroup>

        {/* Fonts */}
        <SectionGroup title="Fonts">
          {/* Body font */}
          <div className="py-4 border-b border-gray-100">
            <label className="block text-xs font-medium text-gray-500 mb-2">Body font</label>
            <select
              value={settings.font_family}
              onChange={(e) => void saveSetting('font_family', e.target.value)}
              className={inputClass}
            >
              {fontOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {settings.font_family === 'custom' && (
              <div className="mt-2">
                {settings.custom_font_name && <p className="text-xs text-gray-500 mb-1.5">Current: {settings.custom_font_name}</p>}
                <button onClick={() => bodyFontRef.current?.click()} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors">
                  <Upload size={12} className="text-gray-400" />Upload .ttf or .woff2 (max 2 MB)
                </button>
                <input ref={bodyFontRef} type="file" accept=".ttf,.woff,.woff2,.otf" className="hidden" onChange={handleBodyFontUpload} />
              </div>
            )}
          </div>

          {/* Heading font */}
          <div className="py-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Heading font</label>
            <select
              value={settings.heading_font}
              onChange={(e) => void saveSetting('heading_font', e.target.value)}
              className={inputClass}
            >
              {fontOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {settings.heading_font === 'custom' && (
              <div className="mt-2">
                {settings.custom_heading_font_name && <p className="text-xs text-gray-500 mb-1.5">Current: {settings.custom_heading_font_name}</p>}
                <button onClick={() => headingFontRef.current?.click()} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors">
                  <Upload size={12} className="text-gray-400" />Upload .ttf or .woff2 (max 2 MB)
                </button>
                <input ref={headingFontRef} type="file" accept=".ttf,.woff,.woff2,.otf" className="hidden" onChange={handleHeadingFontUpload} />
              </div>
            )}
          </div>
        </SectionGroup>

        {/* Invoice visual */}
        <SectionGroup title="Invoice appearance">
          <div className="py-4 border-b border-gray-100">
            <label className="block text-xs font-medium text-gray-500 mb-2">Layout</label>
            <select value={settings.invoice_layout} onChange={(e) => void saveSetting('invoice_layout', e.target.value)} className={inputClass}>
              <option value="left_aligned">Left aligned</option>
              <option value="centered">Centered</option>
              <option value="split">Split</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div className="py-4 border-b border-gray-100">
            <label className="block text-xs font-medium text-gray-500 mb-2">Font color</label>
            <input type="color" value={settings.invoice_font_color} onChange={(e) => void saveSetting('invoice_font_color', e.target.value)} className="h-10 w-24 rounded-xl border border-gray-200 cursor-pointer" />
          </div>
          <div className="py-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">Background color</label>
            <input type="color" value={settings.invoice_bg_color} onChange={(e) => void saveSetting('invoice_bg_color', e.target.value)} className="h-10 w-24 rounded-xl border border-gray-200 cursor-pointer" />
          </div>
        </SectionGroup>
      </>
    )
  }

  // ── Business ───────────────────────────────────────────────────────────────

  const renderBusiness = (): React.ReactNode => (
    <>
      <SectionGroup title="Company identity">
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2">Company / Business name</label>
          <input
            type="text" value={settings.company_name} placeholder="Your company name"
            onChange={(e) => void saveSetting('company_name', e.target.value)}
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1.5">Shown on invoices, portal, and shared docs</p>
        </div>
        <div className="py-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">Tax / Registration number</label>
          <input
            type="text" value={settings.tax_id} placeholder="VAT number, reg number…"
            onChange={(e) => void saveSetting('tax_id', e.target.value)}
            className={inputClass}
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Contact details">
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5"><Mail size={12} />Business email</label>
          <input type="email" value={settings.business_email} placeholder="contact@yourcompany.com" onChange={(e) => void saveSetting('business_email', e.target.value)} className={inputClass} />
        </div>
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5"><Phone size={12} />Phone</label>
          <input type="tel" value={settings.business_phone} placeholder="+234 800 000 0000" onChange={(e) => void saveSetting('business_phone', e.target.value)} className={inputClass} />
        </div>
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5"><Globe size={12} />Website</label>
          <input type="url" value={settings.business_website} placeholder="https://yoursite.com" onChange={(e) => void saveSetting('business_website', e.target.value)} className={inputClass} />
        </div>
        <div className="py-4">
          <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5"><MapPin size={12} />Business address</label>
          <textarea value={settings.business_address} placeholder="123 Main St, City, Country" onChange={(e) => void saveSetting('business_address', e.target.value)} rows={2} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 focus:bg-white transition-all resize-none" />
        </div>
      </SectionGroup>
    </>
  )

  // ── Invoices ───────────────────────────────────────────────────────────────

  const renderInvoices = (): React.ReactNode => (
    <>
      <SectionGroup title="Invoice numbering">
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2">Invoice prefix &amp; next number</label>
          <div className="flex gap-2">
            <input type="text" value={settings.invoice_prefix} onChange={(e) => void saveSetting('invoice_prefix', e.target.value)} className="w-28 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all" />
            <input type="text" value={settings.invoice_next} onChange={(e) => void saveSetting('invoice_next', e.target.value)} className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all" placeholder="001" />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">e.g. {settings.invoice_prefix || 'INV-'}{settings.invoice_next || '001'}</p>
        </div>

        <div className="py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-xs font-medium text-gray-500">Quote prefix &amp; next number</label>
            <SoonBadge />
          </div>
          <div className="flex gap-2 opacity-50 pointer-events-none">
            <input type="text" value={settings.quote_prefix} readOnly className="w-28 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
            <input type="text" value={settings.quote_next} readOnly className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" placeholder="001" />
          </div>
          <p className="text-xs text-amber-600 mt-1.5 font-medium">Quote generation coming soon</p>
        </div>

        <div className="py-4">
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-xs font-medium text-gray-500">Receipt prefix &amp; next number</label>
            <SoonBadge />
          </div>
          <div className="flex gap-2 opacity-50 pointer-events-none">
            <input type="text" value={settings.receipt_prefix} readOnly className="w-28 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
            <input type="text" value={settings.receipt_next} readOnly className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" placeholder="001" />
          </div>
          <p className="text-xs text-amber-600 mt-1.5 font-medium">Auto-receipt generation coming soon</p>
        </div>
      </SectionGroup>

      <SectionGroup title="Defaults">
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2">Payment terms (days)</label>
          <input
            type="number" min="0" value={settings.payment_terms_days}
            onChange={(e) => void saveSetting('payment_terms_days', e.target.value)}
            className="w-32 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all"
            placeholder="14"
          />
        </div>
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2">Default tax rate (%)</label>
          <input
            type="number" min="0" max="100" step="0.1" value={settings.default_tax_rate}
            onChange={(e) => void saveSetting('default_tax_rate', e.target.value)}
            className="w-32 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all"
            placeholder="7.5"
          />
        </div>
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2">Default notes / footer</label>
          <textarea
            value={settings.default_invoice_notes}
            onChange={(e) => void saveSetting('default_invoice_notes', e.target.value)}
            rows={3} placeholder="Thank you for your business…"
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all resize-none"
          />
        </div>
        <SettingRow
          icon={CreditCard}
          title="Show payment details on invoices"
          description="Display your payment templates on sent invoices"
          border={false}
          action={<Toggle checked={settings.show_payment_on_docs === 'true'} onChange={(v) => void saveSetting('show_payment_on_docs', v ? 'true' : 'false')} />}
        />
      </SectionGroup>

      {/* Automation — soon */}
      <SectionGroup title="Automation">
        <SettingRow
          icon={Zap}
          title="Auto-generate receipts"
          description="Automatically create a receipt when a payment is marked paid"
          badge={<SoonBadge />}
          action={<Toggle checked={settings.auto_generate_receipt === 'true'} onChange={() => showToast('Auto-receipt coming soon')} />}
        />
        <SettingRow
          icon={Link2}
          title="Revoke payment link on paid"
          description="Automatically expire the payment link once paid"
          badge={<SoonBadge />}
          border={false}
          action={<Toggle checked={settings.revoke_link_on_payment === 'true'} onChange={() => showToast('Link revocation coming soon')} />}
        />
      </SectionGroup>

      {/* Payment templates */}
      <SectionGroup title="Payment templates">
        {!showTplForm ? (
          <>
            {templates.length === 0 ? (
              <div className="py-8 text-center">
                <CreditCard size={28} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-500 font-medium">No payment templates yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-4">Add bank details or mobile money info to include on invoices</p>
                <button onClick={openNewTemplate} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--accent)' }}>Add template</button>
              </div>
            ) : (
              <div>
                {templates.map((tpl, idx) => (
                  <div key={idx} className="py-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                      <CreditCard size={14} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{tpl.name}</p>
                      <p className="text-xs text-gray-400">{tpl.method} · {tpl.fields.length} field{tpl.fields.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => openEditTemplate(tpl, idx)} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"><Edit3 size={13} /></button>
                      <button onClick={() => deleteTemplate(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
                <div className="pt-3 pb-1">
                  <button onClick={openNewTemplate} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors" style={{ color: 'var(--accent)' }}>
                    <Plus size={14} />Add template
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Template name</label>
              <input
                type="text" placeholder="e.g. GTBank Account" value={tplForm.name}
                onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment method</label>
              <select value={tplForm.method} onChange={(e) => handleMethodChange(e.target.value)} className={inputClass}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {tplForm.fields.map((field) => (
              <div key={field.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-500">{field.label}</label>
                  <button onClick={() => removeFieldFromTpl(field.label)} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                </div>
                <input
                  type="text" placeholder={`Enter ${field.label.toLowerCase()}…`} value={field.value}
                  onChange={(e) => updateFieldValue(field.label, e.target.value)}
                  className={inputClass}
                />
              </div>
            ))}
            <div className="relative">
              <button
                onClick={() => setAddFieldOpen(!addFieldOpen)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <Plus size={12} />Add field
                <ChevronDown size={12} className={addFieldOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {addFieldOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-10 min-w-[180px]">
                  {ALL_TEMPLATE_FIELDS.filter((f) => !tplForm.fields.find((x) => x.label === f)).map((f) => (
                    <button key={f} onClick={() => addFieldToTpl(f)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">{f}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveTplForm}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {editingTpl !== null ? 'Update template' : 'Save template'}
              </button>
              <button onClick={() => setShowTplForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </SectionGroup>
    </>
  )

  // ── App ────────────────────────────────────────────────────────────────────

  const renderApp = (): React.ReactNode => (
    <>
      <SectionGroup title="Display">
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2">App mode</label>
          <div className="flex gap-2 flex-wrap">
            {([['dual', 'Clients + Tasks'], ['clients', 'Clients only'], ['tasks', 'Tasks only']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => void saveSetting('app_mode', val)}
                className="px-3 py-2 rounded-xl text-xs font-medium border transition-colors"
                style={settings.app_mode === val ? { borderColor: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 8%, white)', color: 'var(--accent)' } : { borderColor: '#e5e7eb', color: '#6b7280' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2">Dashboard heading</label>
          <input
            type="text" value={settings.dashboard_heading.replace('\n', ' ')}
            onChange={(e) => void saveSetting('dashboard_heading', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2">Dashboard subtitle</label>
          <input
            type="text" value={settings.dashboard_subtitle} placeholder="Optional tagline"
            onChange={(e) => void saveSetting('dashboard_subtitle', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="py-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">Clients label</label>
          <div className="flex gap-2">
            <input
              type="text" value={clientsLabelInput} placeholder="Clients"
              onChange={(e) => setClientsLabelInput(e.target.value)}
              className={inputClass}
            />
            <button
              onClick={() => void saveSetting('clients_label', clientsLabelInput.trim() || 'Clients')}
              className="flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-80"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Save
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Rename &quot;Clients&quot; to match your workflow (e.g. Projects, Brands)</p>
        </div>
      </SectionGroup>

      <SectionGroup title="Currency &amp; exchange rates">
        <div className="py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2">Display currency</label>
          <select value={settings.currency} onChange={(e) => void saveSetting('currency', e.target.value)} className={inputClass}>
            <option value="NGN">NGN — Nigerian Naira (₦)</option>
            <option value="USD">USD — US Dollar ($)</option>
            <option value="GBP">GBP — British Pound (£)</option>
            <option value="EUR">EUR — Euro (€)</option>
            <option value="ZAR">ZAR — South African Rand (R)</option>
            <option value="KES">KES — Kenyan Shilling (KSh)</option>
            <option value="GHS">GHS — Ghanaian Cedi (₵)</option>
          </select>
        </div>
        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Exchange rates</p>
              {settings.exchange_rate_updated_at && (
                <p className="text-xs text-gray-400 mt-0.5">Updated {settings.exchange_rate_updated_at}</p>
              )}
            </div>
            <button
              onClick={() => void handleRefreshRate()}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {(() => {
            let rates: Record<string, number> = {}
            try { rates = JSON.parse(settings.exchange_rates) as Record<string, number> } catch { /* ignore */ }
            return (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(rates).map(([cur, rate]) => (
                  <div key={cur} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
                    <span className="text-xs font-medium text-gray-500">{cur}</span>
                    <span className="text-xs font-mono text-gray-700">{typeof rate === 'number' ? rate.toFixed(4) : rate}</span>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </SectionGroup>

      <SectionGroup title="Changelog">
        <div className="py-4 flex gap-3">
          <button
            onClick={() => setWhatsNewOpen(true)}
            className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">What&apos;s new</span>
            </div>
            <ArrowRight size={14} className="text-gray-400" />
          </button>
          <button
            onClick={() => setChangelogOpen(true)}
            className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History size={15} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Full history</span>
            </div>
            <ArrowRight size={14} className="text-gray-400" />
          </button>
        </div>
      </SectionGroup>

      <SectionGroup title="Data">
        <SettingRow
          icon={FileText}
          title="Export data (CSV)"
          description="Download all clients and tasks"
          action={
            <button
              onClick={handleExportData}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Export
            </button>
          }
        />
        <SettingRow
          icon={DollarSign}
          title="Export payments (CSV)"
          description="Download all paid tasks and retainers"
          action={
            <button
              onClick={handleExportPayments}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Export
            </button>
          }
        />
        <SettingRow
          icon={Upload}
          title="Import data (CSV)"
          description="Import from a Fey export file"
          border={false}
          action={
            <>
              <button
                onClick={() => importFileRef.current?.click()}
                disabled={importing}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {importing && <Loader2 size={11} className="animate-spin" />}
                {importing ? 'Importing…' : 'Import'}
              </button>
              <input ref={importFileRef} type="file" accept=".csv" className="hidden" onChange={(e) => void handleImportFile(e)} />
            </>
          }
        />
      </SectionGroup>

      {/* Trash */}
      <SectionGroup title="Trash">
        {trash.length === 0 ? (
          <div className="py-6 text-center">
            <Trash2 size={24} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Trash is empty</p>
            <p className="text-xs text-gray-300 mt-0.5">Items are kept for 45 days before permanent deletion</p>
          </div>
        ) : (
          <div>
            {trash.map((item) => {
              const daysLeft = Math.ceil((new Date(item.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              return (
                <div key={item.id} className="py-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={13} className="text-gray-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.item_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{item.item_type.replace('_', ' ')} · {daysLeft}d left</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => void handleRestore(item)} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-500 transition-colors" title="Restore">
                      <RotateCcw size={13} />
                    </button>
                    <button onClick={() => void handleDeleteForever(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete forever">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionGroup>
    </>
  )

  // ── CRM & Portal ───────────────────────────────────────────────────────────

  const renderCrmAndPortal = (): React.ReactNode => {
    // Lazy-load the portal_active flag (the slug comes from settings.workspace_slug)
    if (!portalLoaded && user?.id) {
      void supabase
        .from('fey_settings')
        .select('portal_active')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const row = data as { portal_active: boolean | null } | null
          setPortalActive(row?.portal_active ?? false)
          setPortalLoaded(true)
        })
    }

    const savePortal = async (): Promise<void> => {
      if (!user?.id) return
      setPortalSaving(true)
      await supabase
        .from('fey_settings')
        .upsert({ user_id: user.id, portal_active: portalActive }, { onConflict: 'user_id' })
      setPortalSaving(false)
      showToast('Portal settings saved')
    }

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourdomain.com'

    return (
      <>
        {/* CRM Features overview */}
        <SectionGroup title="CRM features">
          <div className="py-3 space-y-3">
            {[
              { label: 'Contacts',           desc: 'Manage clients, contacts, and their details', live: true },
              { label: 'Messaging',          desc: 'Send and receive messages with contacts', live: true },
              { label: 'Files',              desc: 'Share files with contacts via portal', live: true },
              { label: 'Contracts',          desc: 'Build, send, and collect signatures', live: true },
              { label: 'Forms',              desc: 'Intake forms and questionnaires', live: true },
              { label: 'Payment requests',   desc: 'Direct Paystack payment links for contacts', live: true },
              { label: 'Invoice (CRM)',      desc: 'Invoices linked to CRM contacts', live: true },
              { label: 'Email alerts',       desc: 'Notify you when clients act on docs or forms', live: false },
              { label: 'CRM automations',    desc: 'Auto follow-ups, reminders, sequences', live: false },
            ].map(({ label, desc, live }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${live ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                {!live && <SoonBadge />}
              </div>
            ))}
          </div>
        </SectionGroup>

        {/* Client portal */}
        <SectionGroup title="Client portal">
          <div className="py-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Portal active</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {portalActive
                    ? 'Clients can log in and access their portal'
                    : 'Enable to give contacts a branded client portal'}
                </p>
              </div>
              <Toggle checked={portalActive} onChange={(v) => setPortalActive(v)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Your workspace URL</label>
              {settings.workspace_slug ? (
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-gray-400 flex-shrink-0" />
                  <a
                    href={`https://${settings.workspace_slug}.${rootDomain}`}
                    target="_blank" rel="noreferrer"
                    className="text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
                  >
                    {settings.workspace_slug}.{rootDomain}
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Not set yet — <a href="/setup" className="underline">finish workspace setup</a> to get your address.
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1.5">
                Your workspace and client portal both live here. Chosen during onboarding.
              </p>
            </div>
          </div>

          <div className="py-4">
            <button
              onClick={() => void savePortal()}
              disabled={portalSaving}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {portalSaving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : <><CheckCircle2 size={14} />Save portal settings</>}
            </button>
          </div>
        </SectionGroup>

        {/* Messages */}
        <SectionGroup title="Messages">
          <SettingRow
            icon={CheckCircle2}
            title="Read receipts"
            description="Let clients see when you've read their messages. You'll always see when clients have read yours."
            action={<Toggle checked={settings.portal_read_receipts !== 'false'} onChange={(v) => void saveSetting('portal_read_receipts', v ? 'true' : 'false')} />}
          />
          <SettingRow
            icon={Trash2}
            title="Message retention"
            description="Messages older than this are automatically deleted. Longer retention comes with Pro."
            border={false}
            action={
              <select
                value={settings.message_retention_days || '60'}
                onChange={(e) => void saveSetting('message_retention_days', e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-gray-400"
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180" disabled>180 days (Pro)</option>
              </select>
            }
          />
        </SectionGroup>

        {/* CRM notification toggles (soon) */}
        <SectionGroup title="CRM notifications">
          <SettingRow icon={Bell} title="Form submitted" description="Notify you when a client submits a form" badge={<SoonBadge />}
            action={<Toggle checked={false} onChange={() => showToast('CRM notifications coming soon')} />}
          />
          <SettingRow icon={Bell} title="Contract signed" description="Notify you when a client signs a contract" badge={<SoonBadge />}
            action={<Toggle checked={false} onChange={() => showToast('CRM notifications coming soon')} />}
          />
          <SettingRow icon={Bell} title="New portal message" description="Notify you when a client sends a message" badge={<SoonBadge />} border={false}
            action={<Toggle checked={false} onChange={() => showToast('CRM notifications coming soon')} />}
          />
        </SectionGroup>
      </>
    )
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  const renderNotifications = (): React.ReactNode => (
    <>
      <div className="mb-5 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
        <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Email delivery in progress</p>
          <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
            Transactional email is being set up. Your preferences are saved and will take effect when the feature goes live.
          </p>
        </div>
      </div>

      <SectionGroup title="Account emails">
        <SettingRow icon={Mail} title="Project accepted" description="When a client accepts a proposal" badge={<SoonBadge />}
          action={<Toggle checked={settings.email_acceptance === 'true'} onChange={(v) => void saveSetting('email_acceptance', v ? 'true' : 'false')} />}
        />
        <SettingRow icon={Mail} title="Payment received" description="When a task or invoice is marked paid" badge={<SoonBadge />}
          action={<Toggle checked={settings.email_payment_received === 'true'} onChange={(v) => void saveSetting('email_payment_received', v ? 'true' : 'false')} />}
        />
        <SettingRow icon={Mail} title="Stripe activity" description="Payments processed through Stripe" badge={<SoonBadge />} border={false}
          action={<Toggle checked={settings.email_stripe === 'true'} onChange={(v) => void saveSetting('email_stripe', v ? 'true' : 'false')} />}
        />
      </SectionGroup>

      <SectionGroup title="Activity emails">
        <SettingRow icon={Bell} title="Project activity" description="Updates on shared workspaces and tasks" badge={<SoonBadge />}
          action={<Toggle checked={settings.email_project_activity === 'true'} onChange={(v) => void saveSetting('email_project_activity', v ? 'true' : 'false')} />}
        />
        <SettingRow icon={Bell} title="Chat — messages to you" description="Someone sends you a message" badge={<SoonBadge />}
          action={<Toggle checked={settings.email_chat_to === 'true'} onChange={(v) => void saveSetting('email_chat_to', v ? 'true' : 'false')} />}
        />
        <SettingRow icon={Bell} title="Chat — messages from you" description="Copy of messages you send" badge={<SoonBadge />}
          action={<Toggle checked={settings.email_chat_from === 'true'} onChange={(v) => void saveSetting('email_chat_from', v ? 'true' : 'false')} />}
        />
        <SettingRow icon={Bell} title="Auto reminders" description="Invoice follow-ups and payment reminders" badge={<SoonBadge />} border={false}
          action={<Toggle checked={settings.email_auto_reminders === 'true'} onChange={(v) => void saveSetting('email_auto_reminders', v ? 'true' : 'false')} />}
        />
      </SectionGroup>
    </>
  )

  // ── Integrations ───────────────────────────────────────────────────────────

  const renderIntegrations = (): React.ReactNode => {
    const isConnected = !!waConnection?.phone_number
    const isPending   = waCodeSent && !isConnected

    const handleSendCode = async (): Promise<void> => {
      if (!waPhone.trim()) { setWaError('Enter your WhatsApp number.'); return }
      setWaSending(true); setWaError('')
      try {
        const res  = await fetch(`${BOT_URL}/verify/start`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: waPhone.trim(), user_id: user?.id }),
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) { setWaError(json.error ?? 'Failed to send code.'); return }
        setWaCodeSent(true); setWaCode('')
      } catch {
        setWaError('Could not reach the bot server. Is it running?')
      } finally { setWaSending(false) }
    }

    const handleVerify = async (): Promise<void> => {
      if (!waCode.trim()) { setWaError('Enter the 6-digit code.'); return }
      setWaVerifying(true); setWaError('')
      try {
        const res  = await fetch(`${BOT_URL}/verify/confirm`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_number: waPhone.trim(), code: waCode.trim() }),
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) { setWaError(json.error ?? 'Verification failed.'); return }
        const { data } = await supabase.from('whatsapp_connections').select('phone_number, verified, connected_at').eq('user_id', user?.id).maybeSingle()
        setWaConnection((data as WaConnection | null) ?? null)
        setWaCodeSent(false); setWaCode('')
      } catch {
        setWaError('Could not reach the bot server. Is it running?')
      } finally { setWaVerifying(false) }
    }

    const handleDisconnect = async (): Promise<void> => {
      setWaDisconnecting(true)
      const { error } = await supabase.from('whatsapp_connections').delete().eq('user_id', user?.id)
      if (!error) { setWaConnection(null); setWaPhone(''); setWaCodeSent(false); setWaCode('') }
      setWaDisconnecting(false)
    }

    return (
      <>
        {/* WhatsApp */}
        <SectionGroup title="WhatsApp">
          {waLoading ? (
            <div className="py-8 flex justify-center"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : isConnected ? (
            <div className="py-4">
              <SettingRow
                icon={MessageSquare}
                title="Connected"
                description={waConnection?.phone_number ?? ''}
                border={false}
                action={
                  <button
                    onClick={() => void handleDisconnect()}
                    disabled={waDisconnecting}
                    className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {waDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                }
              >
                <span className="inline-flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-xs text-green-600 font-medium">Active</span>
                </span>
              </SettingRow>
            </div>
          ) : isPending ? (
            <div className="py-4 space-y-4">
              <p className="text-sm text-gray-500">
                A 6-digit code was sent to{' '}
                <span className="font-medium text-gray-800">{waPhone}</span> on WhatsApp. Enter it below.
              </p>
              <div className="flex gap-2">
                <input
                  type="text" inputMode="numeric" maxLength={6} placeholder="000000" value={waCode}
                  onChange={(e) => { setWaCode(e.target.value.replace(/\D/g, '')); setWaError('') }}
                  className="px-3 py-2.5 w-36 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 tracking-widest text-center font-mono transition-all"
                />
                <button
                  onClick={() => void handleVerify()} disabled={waVerifying}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {waVerifying ? 'Verifying…' : 'Verify'}
                </button>
              </div>
              {waError && <p className="text-xs text-red-500">{waError}</p>}
              <button
                onClick={() => { setWaError(''); void handleSendCode() }} disabled={waSending}
                className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                {waSending ? 'Sending…' : 'Resend code'}
              </button>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <p className="text-sm text-gray-500">Connect your WhatsApp number to add tasks by messaging your Twilio number.</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="tel" placeholder="+1 555 000 0000" value={waPhone}
                  onChange={(e) => { setWaPhone(e.target.value); setWaError('') }}
                  className="max-w-[220px] px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 transition-all"
                />
                <button
                  onClick={() => void handleSendCode()} disabled={waSending}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {waSending ? 'Sending…' : 'Connect WhatsApp'}
                </button>
              </div>
              {waError && <p className="text-xs text-red-500">{waError}</p>}
              <p className="text-xs text-gray-400">Enter in international format — e.g. +2348012345678</p>
            </div>
          )}

          {isConnected && (
            <div className="pb-4 pt-1 space-y-2">
              {[
                { label: 'Add tasks for today',   example: 'Write blog intro, update invoice, email client' },
                { label: 'Add to yesterday',      example: 'add to yesterday, write blog intro, update invoice' },
                { label: 'Add to a past date',    example: 'add to May 16, write blog intro' },
                { label: 'Add to a past weekday', example: 'add to last Monday, review Q2 report' },
              ].map(({ label, example }) => (
                <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                  <p className="text-xs text-gray-700 font-mono">{example}</p>
                </div>
              ))}
            </div>
          )}
        </SectionGroup>

        {/* Paystack */}
        <SectionGroup title="Paystack">
          <div className="py-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                <CreditCard size={14} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Paystack payment processing</p>
                <span className="inline-flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-600 font-medium">Configured via environment key</span>
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Paystack is used for direct payment links in CRM. The secret key is configured server-side — no action needed here.
            </p>
          </div>
        </SectionGroup>

        {/* Coming soon integrations */}
        <SectionGroup title="Coming soon">
          <div className="py-3 space-y-3">
            {[
              { label: 'Stripe', desc: 'International card payments' },
              { label: 'Google Calendar', desc: 'Sync deadlines to your calendar' },
              { label: 'Zapier / Make', desc: 'Automate with other tools' },
              { label: 'Notion', desc: 'Sync clients and tasks' },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                  <Zap size={13} className="text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <SoonBadge />
              </div>
            ))}
          </div>
        </SectionGroup>
      </>
    )
  }

  // ── Billing ────────────────────────────────────────────────────────────────

  const renderBilling = (): React.ReactNode => (
    <SectionGroup title="Plan">
      <div className="py-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
          <Building2 size={20} className="text-gray-300" />
        </div>
        <p className="text-sm font-semibold text-gray-800 mb-1">Free plan</p>
        <p className="text-xs text-gray-400">Billing and plan management coming soon</p>
      </div>
    </SectionGroup>
  )

  // ── Render dispatcher ──────────────────────────────────────────────────────

  const renderSection = (): React.ReactNode => {
    switch (activeSection) {
      case 'Profile':      return renderProfile()
      case 'Brand':        return renderBrand()
      case 'Business':     return renderBusiness()
      case 'Invoices':     return renderInvoices()
      case 'App':          return renderApp()
      case 'CRM & Portal': return renderCrmAndPortal()
      case 'Notifications': return renderNotifications()
      case 'Integrations': return renderIntegrations()
      case 'Billing':      return renderBilling()
      default:             return null
    }
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex min-h-screen page-enter">
        {/* Left nav (desktop) */}
        <div className="hidden md:flex flex-col w-52 flex-shrink-0 p-6 pt-8 border-r border-gray-100 bg-white/50">
          <h1 className="font-display text-2xl font-semibold text-gray-900 mb-6">Settings</h1>
          <div className="space-y-0.5">
            {NAV.map((item) => (
              <NavItem key={item} label={item} active={activeSection === item} onClick={() => setActiveSection(item)} />
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto max-w-2xl">
          {/* Mobile header */}
          <div className="md:hidden mb-4">
            <h1 className="font-display text-2xl font-semibold text-gray-900">Settings</h1>
          </div>

          {/* Desktop breadcrumb */}
          <div className="hidden md:flex items-center gap-1 text-sm text-gray-400 mb-8">
            <span>Settings</span>
            <ChevronRight size={14} />
            <span className="text-gray-700 font-medium">{activeSection}</span>
          </div>

          {/* Mobile nav pills */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
            {NAV.map((item) => (
              <button
                key={item}
                onClick={() => setActiveSection(item)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeSection === item ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                style={activeSection === item ? { backgroundColor: 'var(--accent)' } : {}}
              >
                {item}
              </button>
            ))}
          </div>

          {renderSection()}
        </div>
      </div>

      {whatsNewOpen  && <WhatsNewPopup  open={whatsNewOpen}  onClose={() => setWhatsNewOpen(false)}  />}
      {changelogOpen && <ChangelogPopup open={changelogOpen} onClose={() => setChangelogOpen(false)} />}
    </>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  )
}
