'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, X, FileText, FileSignature, ClipboardList,
  MessageSquare, File, Image, Film, Music, ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type ResultType = 'file' | 'contract' | 'form' | 'message'

interface SearchResult {
  id:    string
  type:  ResultType
  title: string
  sub:   string
  href:  string
  icon:  React.ReactNode
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileIcon(fileType: string | null) {
  if (!fileType)                                                return <File        size={14} className="text-gray-400" />
  if (fileType.startsWith('image/'))                            return <Image       size={14} className="text-blue-400" />
  if (fileType.startsWith('video/'))                            return <Film        size={14} className="text-purple-400" />
  if (fileType.startsWith('audio/'))                            return <Music       size={14} className="text-yellow-500" />
  if (fileType === 'application/pdf')                           return <FileText    size={14} className="text-red-400" />
  if (fileType.includes('document') || fileType.includes('msword')) return <FileText size={14} className="text-emerald-500" />
  return <File size={14} className="text-gray-400" />
}

function relativeDate(iso: string): string {
  const now  = Date.now()
  const diff = now - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const TYPE_ORDER: ResultType[] = ['file', 'contract', 'form', 'message']

const TYPE_LABEL: Record<ResultType, string> = {
  file:     'Files',
  contract: 'Contracts',
  form:     'Forms',
  message:  'Messages',
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ClientSearchDialogProps {
  contactId:   string
  contactName: string
  onClose:     () => void
}

export default function ClientSearchDialog({ contactId, contactName, onClose }: ClientSearchDialogProps) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(-1)

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // ESC to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) { setResults([]); setLoading(false); return }
    setLoading(true)

    const term = `%${trimmed}%`
    const base = `/clients/${contactId}`

    const [
      { data: files },
      { data: contracts },
      { data: forms },
      { data: messages },
    ] = await Promise.all([
      supabase
        .from('crm_files')
        .select('id, file_name, file_type, file_size, created_at')
        .eq('contact_id', contactId)
        .ilike('file_name', term)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('crm_contracts')
        .select('id, title, status, created_at')
        .eq('contact_id', contactId)
        .ilike('title', term)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('crm_forms')
        .select('id, title, status, created_at')
        .eq('contact_id', contactId)
        .ilike('title', term)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('crm_messages')
        .select('id, body, created_at')
        .eq('contact_id', contactId)
        .ilike('body', term)
        .order('created_at', { ascending: false })
        .limit(6),
    ])

    const out: SearchResult[] = [
      ...(files ?? []).map((f) => ({
        id:    f.id as string,
        type:  'file' as const,
        title: f.file_name as string,
        sub:   relativeDate(f.created_at as string),
        href:  `${base}/files`,
        icon:  fileIcon(f.file_type as string | null),
      })),
      ...(contracts ?? []).map((c) => ({
        id:    c.id as string,
        type:  'contract' as const,
        title: c.title as string,
        sub:   `${String(c.status).charAt(0).toUpperCase()}${String(c.status).slice(1)} · ${relativeDate(c.created_at as string)}`,
        href:  `${base}/contracts/${c.id as string}`,
        icon:  <FileSignature size={14} className="text-gray-400" />,
      })),
      ...(forms ?? []).map((f) => ({
        id:    f.id as string,
        type:  'form' as const,
        title: f.title as string,
        sub:   `${String(f.status).charAt(0).toUpperCase()}${String(f.status).slice(1)} · ${relativeDate(f.created_at as string)}`,
        href:  `${base}/forms/${f.id as string}`,
        icon:  <ClipboardList size={14} className="text-gray-400" />,
      })),
      ...(messages ?? []).map((m) => {
        const body = String(m.body ?? '')
        const snippet = body.length > 80 ? `${body.slice(0, 80)}…` : body
        return {
          id:    m.id as string,
          type:  'message' as const,
          title: snippet || '(empty message)',
          sub:   relativeDate(m.created_at as string),
          href:  `${base}/messages`,
          icon:  <MessageSquare size={14} className="text-gray-400" />,
        }
      }),
    ]

    setResults(out)
    setLoading(false)
    setFocused(-1)
  }, [contactId])

  useEffect(() => {
    const timer = setTimeout(() => void doSearch(query), 220)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const navigate = useCallback((r: SearchResult) => {
    router.push(r.href)
    onClose()
  }, [router, onClose])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocused((f) => Math.min(f + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocused((f) => Math.max(f - 1, -1))
    } else if (e.key === 'Enter' && focused >= 0) {
      const r = results[focused]
      if (r) navigate(r)
    }
  }

  // Group results by type in defined order
  const grouped = TYPE_ORDER.reduce<Record<ResultType, SearchResult[]>>((acc, t) => {
    acc[t] = results.filter((r) => r.type === t)
    return acc
  }, { file: [], contract: [], form: [], message: [] })

  const hasResults = results.length > 0

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4"
      style={{ paddingTop: 'clamp(64px, 15vh, 140px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] bg-white rounded-2xl overflow-hidden shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 140px)' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Search in ${contactName}…`}
            className="flex-1 text-sm text-gray-900 bg-transparent outline-none placeholder-gray-400 min-w-0"
          />
          {loading && (
            <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin flex-shrink-0" />
          )}
          {!loading && query && (
            <button
              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}
              className="p-1 rounded-lg text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
            >
              <X size={13} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>

          {/* Empty / initial state */}
          {!query && (
            <div className="px-4 py-6 text-center">
              <Search size={24} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                Search files, contracts, forms, and messages for this contact.
              </p>
            </div>
          )}

          {/* No results */}
          {query && !loading && !hasResults && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-gray-500">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term.</p>
            </div>
          )}

          {/* Grouped results */}
          {hasResults && TYPE_ORDER.map((type) => {
            const group = grouped[type]
            if (!group.length) return null
            return (
              <div key={type}>
                {/* Section label */}
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{TYPE_LABEL[type]}</p>
                </div>

                {group.map((r) => {
                  const flatIdx = results.indexOf(r)
                  const isFocused = flatIdx === focused
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(r)}
                      onMouseEnter={() => setFocused(flatIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isFocused ? 'bg-gray-50' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                        {r.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                        <p className="text-[11px] text-gray-400 truncate">{r.sub}</p>
                      </div>
                      <ArrowRight size={13} className={`flex-shrink-0 transition-opacity ${isFocused ? 'opacity-50' : 'opacity-0'} text-gray-400`} />
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Footer padding */}
          {hasResults && <div className="h-2" />}
        </div>
      </div>
    </div>
  )
}
