'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Check, Settings2, Plus, Pencil, Trash2, X, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useImagePipelineContext } from '@/hooks/useImagePipelineContext'
import { useImagePresets } from '@/hooks/useImagePresets'
import { DEFAULT_PROMPT_PRESET_KEY, PRESET_LIMITS, type PromptPresetOption } from '@/types/image-pipeline'

const DANGER = '#E53E3E'

/**
 * Preset selector + manager for the prompt-writing step. Users pick a built-in
 * or a workspace preset; workspace members can create their own, and the creator
 * (or a workspace admin) can edit/delete them. Mobile-first: full-width control,
 * 44px+ tap targets, a sheet-style modal that scrolls on small screens.
 */
export default function PresetPicker({
  value,
  onChange,
  accent,
}: {
  value: string
  onChange: (key: string) => void
  accent: string
}) {
  const { presets, loading, create, update, remove } = useImagePresets()
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)

  const selected = useMemo(
    () => presets.find((p) => p.key === value) ?? presets.find((p) => p.key === DEFAULT_PROMPT_PRESET_KEY) ?? presets[0] ?? null,
    [presets, value],
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300">Prompt preset</span>
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="inline-flex items-center gap-1 text-2xs font-medium text-gray-400 hover:text-gray-700 transition-colors"
        >
          <Settings2 size={13} /> Manage
        </button>
      </div>

      {/* Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={loading}
          aria-expanded={open}
          className="w-full flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 h-12 text-left hover:border-gray-300 transition-colors disabled:opacity-60"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-gray-800 truncate">
              {loading ? 'Loading presets…' : selected?.label ?? 'Default'}
            </span>
            {selected?.description && (
              <span className="block text-2xs text-gray-400 truncate">{selected.description}</span>
            )}
          </span>
          <ChevronDown size={16} className={`text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <>
            <button type="button" className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setOpen(false)} />
            <div className="absolute z-20 mt-1.5 w-full max-h-72 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg p-1">
              {presets.map((p) => {
                const active = p.key === value || (!value && p.key === DEFAULT_PROMPT_PRESET_KEY)
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => { onChange(p.key); setOpen(false) }}
                    className="w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="w-4 flex-shrink-0 pt-0.5" style={{ color: accent }}>
                      {active && <Check size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-800 truncate">{p.label}</span>
                        {p.builtin && <span className="text-3xs font-semibold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 flex-shrink-0">Built-in</span>}
                      </span>
                      {p.description && <span className="block text-2xs text-gray-400 line-clamp-2">{p.description}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
      <p className="text-2xs text-gray-400 mt-1.5">The preset shapes how Claude writes your prompt. Reused presets are cached for faster, cheaper runs.</p>

      {managing && (
        <PresetManager
          presets={presets}
          accent={accent}
          onClose={() => setManaging(false)}
          onCreate={create}
          onUpdate={update}
          onRemove={remove}
          onPicked={(key) => onChange(key)}
        />
      )}
    </div>
  )
}

/* ── Manager modal ──────────────────────────────────────────────────────────── */

type PresetForm = { name: string; description: string; system_prompt: string }
const EMPTY_FORM: PresetForm = { name: '', description: '', system_prompt: '' }

interface ActionResult { ok: boolean; message: string }

function PresetManager({
  presets,
  accent,
  onClose,
  onCreate,
  onUpdate,
  onRemove,
  onPicked,
}: {
  presets: PromptPresetOption[]
  accent: string
  onClose: () => void
  onCreate: (input: PresetForm) => Promise<ActionResult>
  onUpdate: (id: string, input: PresetForm) => Promise<ActionResult>
  onRemove: (id: string) => Promise<ActionResult>
  onPicked: (key: string) => void
}) {
  const { user } = useAuth()
  const { showToast } = useSettings()
  const { context } = useImagePipelineContext()
  const uid = user?.id ?? null
  const isAdmin = !!context && (context.admin.is_super_admin || context.admin.is_workspace_owner)

  const [editing, setEditing] = useState<string | null>(null) // preset id, or 'new', or null
  const [form, setForm] = useState<PresetForm>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)

  const builtins = presets.filter((p) => p.builtin)
  const custom = presets.filter((p) => !p.builtin)
  const canManage = (p: PromptPresetOption) => isAdmin || (!!uid && p.created_by === uid)

  const startNew = () => { setForm(EMPTY_FORM); setEditing('new') }
  const startEdit = (p: PromptPresetOption) => {
    setForm({ name: p.label, description: p.description ?? '', system_prompt: p.system_prompt ?? '' })
    setEditing(p.key)
  }

  const save = async () => {
    if (!form.name.trim() || !form.system_prompt.trim()) {
      showToast('Add a name and the preset instructions.')
      return
    }
    setBusy(true)
    const result = editing === 'new' ? await onCreate(form) : await onUpdate(editing!, form)
    setBusy(false)
    showToast(result.message)
    if (result.ok) { if (editing === 'new') { /* keep list */ } setEditing(null); setForm(EMPTY_FORM) }
  }

  const del = async (p: PromptPresetOption) => {
    setBusy(true)
    const result = await onRemove(p.key)
    setBusy(false)
    showToast(result.message)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[88vh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between gap-2 bg-white/95 backdrop-blur px-4 sm:px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-display text-base text-gray-800">Prompt presets</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  maxLength={PRESET_LIMITS.name}
                  placeholder="e.g. Product packshot"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 h-11 text-sm text-gray-800 outline-none focus:border-gray-300"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">Short description (optional)</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  maxLength={PRESET_LIMITS.description}
                  placeholder="What this preset is good for"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 h-11 text-sm text-gray-800 outline-none focus:border-gray-300"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">Instructions (system prompt)</label>
                <textarea
                  value={form.system_prompt}
                  onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
                  maxLength={PRESET_LIMITS.systemPrompt}
                  rows={8}
                  placeholder="Tell Claude how to write the image prompt for this style…"
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 outline-none resize-y focus:border-gray-300"
                />
                <p className="text-3xs text-gray-400 mt-1 text-right">{form.system_prompt.length} / {PRESET_LIMITS.systemPrompt}</p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => { setEditing(null); setForm(EMPTY_FORM) }}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 h-11 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 h-11 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {busy ? 'Saving…' : editing === 'new' ? 'Create preset' : 'Save changes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={startNew}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 h-11 text-sm font-medium text-white transition-all active:scale-[0.98]"
                style={{ backgroundColor: accent }}
              >
                <Plus size={16} /> New preset
              </button>

              {custom.length > 0 && (
                <div className="space-y-2">
                  <p className="text-2xs font-semibold uppercase tracking-widest text-gray-300">Your workspace</p>
                  {custom.map((p) => (
                    <div key={p.key} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => { onPicked(p.key); onClose() }} className="min-w-0 flex-1 text-left">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.label}</p>
                          {p.description && <p className="text-2xs text-gray-400 line-clamp-2">{p.description}</p>}
                        </button>
                        {canManage(p) && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button type="button" onClick={() => startEdit(p)} aria-label={`Edit ${p.label}`} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                              <Pencil size={15} />
                            </button>
                            <button type="button" onClick={() => del(p)} disabled={busy} aria-label={`Delete ${p.label}`} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-50" style={{ color: DANGER }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-2xs font-semibold uppercase tracking-widest text-gray-300">Built-in</p>
                {builtins.map((p) => (
                  <div key={p.key} className="rounded-xl border border-gray-100 p-3 flex items-start justify-between gap-2">
                    <button type="button" onClick={() => { onPicked(p.key); onClose() }} className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.label}</p>
                      {p.description && <p className="text-2xs text-gray-400 line-clamp-2">{p.description}</p>}
                    </button>
                    <span className="flex-shrink-0 text-gray-300" title="Built-in preset — can't be edited"><Lock size={14} /></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
