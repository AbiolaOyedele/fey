'use client'

import { useState, useRef, useEffect } from 'react'
import { ShieldCheck, Check, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ADMIN_CAPABILITIES, type AdminCapability } from '@/types/team'

interface AdminPermissionsPanelProps {
  workspaceId: string
  /** Capabilities currently granted to the admin role. */
  granted: AdminCapability[]
  accent: string
  onSaved: (capabilities: AdminCapability[]) => void
}

/**
 * Owner-only control for what the `admin` role can reach in this workspace.
 * Collapsed to a trigger button — it's set-once configuration, not something
 * worth a permanent card on the page.
 *
 * Admins start fully restricted: financial and sensitive areas are hidden until
 * granted here. Owner and super admin always have everything and are
 * deliberately not listed — there is nothing to configure for them.
 */
export default function AdminPermissionsPanel({
  workspaceId, granted, accent, onSaved,
}: AdminPermissionsPanelProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<AdminCapability[]>(granted)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const dirty =
    selected.length !== granted.length || selected.some((c) => !granted.includes(c))

  // Discard unsaved toggles on close, so reopening never shows a stale state
  // that looks saved but isn't.
  const close = () => { setOpen(false); setSelected(granted); setError(null) }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  })

  const toggle = (key: AdminCapability) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/v1/workspace/permissions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ workspace_id: workspaceId, capabilities: selected }),
      })
      const json = (await res.json()) as { capabilities?: AdminCapability[]; error?: { message: string } }
      if (!res.ok) throw new Error(json.error?.message ?? 'Those permissions could not be saved.')
      onSaved(json.capabilities ?? selected)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Those permissions could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 min-h-11 text-xs2 font-medium text-gray-600 hover:border-gray-300 transition-colors cursor-pointer"
      >
        <ShieldCheck size={14} style={{ color: accent }} />
        <span className="whitespace-nowrap">Admin access</span>
        <span className="font-semibold" style={{ color: accent }}>
          {granted.length}/{ADMIN_CAPABILITIES.length}
        </span>
        <ChevronDown size={13} className={`text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Dim only on small screens — on desktop the popover reads as anchored
              to the button and a scrim would be heavy-handed. */}
          <div className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent sm:pointer-events-none" aria-hidden />

          {/* Centred sheet on mobile, anchored dropdown from sm up. */}
          <div
            className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 max-h-[80vh] overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl p-3
                       sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:translate-y-0 sm:max-h-none"
          >
            <p className="text-3xs text-gray-400 leading-relaxed px-1 pt-1 pb-2 m-0">
              Everything here stays hidden from admins until you turn it on.
              Owners and super admins always have full access.
            </p>

            <div className="space-y-1">
              {ADMIN_CAPABILITIES.map(({ key, label, description }) => {
                const on = selected.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    aria-pressed={on}
                    className="w-full flex items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors hover:bg-gray-50 cursor-pointer border-none bg-transparent"
                  >
                    <span
                      className="flex-shrink-0 w-[18px] h-[18px] rounded-md flex items-center justify-center mt-0.5 transition-colors"
                      style={{
                        backgroundColor: on ? accent : 'transparent',
                        border: on ? 'none' : '1.5px solid #e5e7eb',
                      }}
                    >
                      {on && <Check size={12} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs2 font-semibold text-gray-800">{label}</span>
                      <span className="block text-3xs text-gray-400 leading-relaxed mt-0.5">{description}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {error && <p className="text-3xs px-1 mt-2 mb-0" style={{ color: '#E53E3E' }}>{error}</p>}

            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="flex-1 min-h-11 rounded-xl text-white text-xs2 font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none"
                style={{ backgroundColor: accent }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={close}
                className="min-h-11 px-4 rounded-xl text-xs2 font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer border-none bg-transparent"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
