'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronsUpDown, Plus, Check, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useWorkspace } from '@/hooks/useWorkspace'
import { workspaceUrl } from '@/utils/host'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }
}

export default function WorkspaceSwitcher({ accent }: { accent: string }) {
  const { workspace, memberships } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const go = (slug: string | null) => {
    if (!slug || slug === workspace?.slug) { setOpen(false); return }
    window.location.href = workspaceUrl(slug)
  }

  const label = workspace?.name ?? 'Workspace'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: accent }}
        >
          {label.charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{label}</span>
        <ChevronsUpDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-50 py-1 animate-fadeIn">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Workspaces</p>
          <div className="max-h-64 overflow-y-auto">
            {memberships.map((m) => {
              const isActive = m.workspace.slug === workspace?.slug
              return (
                <button
                  key={m.workspace.id}
                  onClick={() => go(m.workspace.slug)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: isActive ? accent : '#9CA3AF' }}
                  >
                    {m.workspace.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.workspace.name}</p>
                    <p className="text-[11px] text-gray-400 capitalize">{m.role}</p>
                  </div>
                  {isActive && <Check size={14} style={{ color: accent }} className="flex-shrink-0" />}
                </button>
              )
            })}
          </div>
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={() => { setShowCreate(true); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left text-sm text-gray-600"
            >
              <span className="w-6 h-6 rounded-md border border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                <Plus size={13} className="text-gray-400" />
              </span>
              Create workspace
            </button>
          </div>
        </div>
      )}

      {showCreate && <CreateWorkspaceModal accent={accent} onClose={() => setShowCreate(false)} />}
    </div>
  )
}

function CreateWorkspaceModal({ accent, onClose }: { accent: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveSlug = slugEdited ? slug : slugify(name)

  // Debounced availability check.
  useEffect(() => {
    if (effectiveSlug.length < 3) { setAvailable(null); setReason(null); return }
    let cancelled = false
    setChecking(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/workspace/check-slug?slug=${encodeURIComponent(effectiveSlug)}`, { headers: await authHeader() })
        const data = await res.json() as { available: boolean; reason?: string }
        if (cancelled) return
        setAvailable(data.available)
        setReason(data.reason ?? null)
      } catch { if (!cancelled) { setAvailable(null) } }
      finally { if (!cancelled) setChecking(false) }
    }, 400)
    return () => { cancelled = true; clearTimeout(t) }
  }, [effectiveSlug])

  const create = async () => {
    if (!name.trim() || available !== true || creating) return
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/v1/workspace/create', {
        method: 'POST',
        headers: await authHeader(),
        body: JSON.stringify({ name: name.trim(), slug: effectiveSlug }),
      })
      const data = await res.json() as { slug?: string; error?: { message?: string } }
      if (!res.ok) throw new Error(data.error?.message ?? 'Could not create workspace')
      window.location.href = workspaceUrl(data.slug ?? effectiveSlug)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Create workspace</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={18} /></button>
        </div>

        <label className="block text-xs font-medium text-gray-500 mb-1">Workspace name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Studio"
          className="w-full mb-3 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
        />

        <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
        <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 focus-within:border-gray-400 focus-within:bg-white transition-colors overflow-hidden">
          <input
            value={effectiveSlug}
            onChange={(e) => { setSlugEdited(true); setSlug(slugify(e.target.value)) }}
            placeholder="acme"
            className="flex-1 min-w-0 px-3.5 py-2.5 bg-transparent text-sm text-gray-800 focus:outline-none"
          />
          <span className="px-3 text-xs text-gray-400 flex-shrink-0">.theruff.agency</span>
        </div>

        <div className="h-5 mt-1.5 text-xs">
          {checking && <span className="text-gray-400 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Checking…</span>}
          {!checking && available === true && <span className="text-green-600 flex items-center gap-1"><Check size={11} /> Available</span>}
          {!checking && available === false && <span className="text-red-500">{reason ?? 'Not available'}</span>}
        </div>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        <button
          onClick={() => void create()}
          disabled={!name.trim() || available !== true || creating}
          className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ backgroundColor: accent }}
        >
          {creating && <Loader2 size={14} className="animate-spin" />}
          Create workspace
        </button>
      </div>
    </div>
  )
}
