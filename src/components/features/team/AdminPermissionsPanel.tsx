'use client'

import { useState } from 'react'
import { ShieldCheck, Check } from 'lucide-react'
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
 *
 * Admins start fully restricted: financial and sensitive areas are hidden until
 * granted here. Owner and super admin always have everything and are
 * deliberately not listed — there is nothing to configure for them.
 */
export default function AdminPermissionsPanel({
  workspaceId, granted, accent, onSaved,
}: AdminPermissionsPanelProps) {
  const [selected, setSelected] = useState<AdminCapability[]>(granted)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const dirty =
    selected.length !== granted.length || selected.some((c) => !granted.includes(c))

  const toggle = (key: AdminCapability) => {
    setSavedAt(null)
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
      setSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Those permissions could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-2.5 mb-1">
        <ShieldCheck size={17} className="flex-shrink-0 mt-0.5" style={{ color: accent }} />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 m-0">What admins can access</h3>
          <p className="text-xs text-gray-400 leading-relaxed mt-0.5 mb-0">
            Admins get oversight across the workspace. Everything below stays hidden from them
            until you turn it on. Owners and super admins always have full access.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {ADMIN_CAPABILITIES.map(({ key, label, description }) => {
          const on = selected.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={on}
              className="w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer bg-transparent"
              style={{ borderColor: on ? accent : '#f3f4f6' }}
            >
              <span
                className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5 transition-colors"
                style={{
                  backgroundColor: on ? accent : 'transparent',
                  border: on ? 'none' : '1.5px solid #e5e7eb',
                }}
              >
                {on && <Check size={13} className="text-white" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs2 font-semibold text-gray-800">{label}</span>
                <span className="block text-3xs text-gray-400 leading-relaxed mt-0.5">{description}</span>
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-xs mt-3 mb-0" style={{ color: '#E53E3E' }}>{error}</p>}

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="min-h-11 px-4 rounded-xl text-white text-xs2 font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none"
          style={{ backgroundColor: accent }}
        >
          {saving ? 'Saving…' : 'Save permissions'}
        </button>
        {savedAt !== null && !dirty && (
          <span className="text-2xs text-gray-400">Saved</span>
        )}
      </div>
    </div>
  )
}
