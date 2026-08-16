'use client'

import { useEffect, useMemo, useState } from 'react'
import { Vault as VaultIcon, Plus, Search, PenLine } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/contexts/SettingsContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useVault } from '@/hooks/useVault'
import { FadeIn } from '@/components/ui/motion'
import VaultList from '@/components/vault/VaultList'
import VaultUpload from '@/components/vault/VaultUpload'
import VaultNoteEditor, { type NoteDraft } from '@/components/vault/VaultNoteEditor'
import VaultNoteReader from '@/components/vault/VaultNoteReader'
import {
  VAULT_CATEGORIES, VAULT_CATEGORY_LABEL,
  type CreateVaultItemPayload, type VaultCategory, type VaultEntry, type VaultEntryKind,
} from '@/types/vault'

/**
 * Agency Vault — every document the agency needs to be able to find.
 *
 * Invoices and contracts arrive on their own, read live from their own tables
 * rather than copied in, so what's shown here is always what those pages show.
 * Everything else is either uploaded or written here, and each one decides for
 * itself whether a client ever sees it.
 *
 * Only one panel is ever open — writing, reading and uploading are mutually
 * exclusive, so the page never stacks three cards above the list on a phone.
 */

const KINDS: { key: VaultEntryKind | 'all'; label: string }[] = [
  { key: 'all',      label: 'Everything' },
  { key: 'note',     label: 'Notes' },
  { key: 'file',     label: 'Uploads' },
  { key: 'invoice',  label: 'Invoices' },
  { key: 'contract', label: 'Contracts' },
]

/** Which panel, if any, sits above the list. */
type Panel =
  | { mode: 'upload' }
  | { mode: 'write' }
  | { mode: 'read';  entry: VaultEntry }
  | { mode: 'edit';  entry: VaultEntry }
  | null

export default function VaultPage() {
  const { settings } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const { workspace } = useWorkspace()

  const {
    visible, entries, loading, error, filter, setFilter,
    addItem, updateItem, deleteItem, addNote, updateNote, deleteNote,
  } = useVault({ workspaceId: workspace?.id ?? null })

  const [panel, setPanel] = useState<Panel>(null)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [resharing, setResharing] = useState<VaultEntry | null>(null)

  // The client list is only needed for the share controls, so it loads
  // alongside rather than blocking the documents themselves.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('crm_contacts')
        .select('id, name')
        .order('name', { ascending: true })
      setClients((data ?? []) as { id: string; name: string }[])
    })()
  }, [])

  const counts = useMemo(() => ({
    all:      entries.length,
    note:     entries.filter((e) => e.kind === 'note').length,
    file:     entries.filter((e) => e.kind === 'file').length,
    invoice:  entries.filter((e) => e.kind === 'invoice').length,
    contract: entries.filter((e) => e.kind === 'contract').length,
  }), [entries])

  // An open note is re-read from the list each render, so a save made in the
  // editor is reflected the moment the refetch lands.
  const openNote = panel && (panel.mode === 'read' || panel.mode === 'edit')
    ? entries.find((e) => e.kind === 'note' && e.id === panel.entry.id) ?? panel.entry
    : null

  const saveUpload = async (payload: CreateVaultItemPayload) => {
    await addItem(payload)
    setPanel(null)
  }

  const saveNote = async (draft: NoteDraft) => {
    if (panel?.mode === 'edit') {
      await updateNote(panel.entry.id, draft)
      // Straight back to reading it, rather than closing what they were in.
      setPanel({ mode: 'read', entry: panel.entry })
      return
    }
    await addNote(draft)
    setPanel(null)
  }

  /** Deleting dispatches on kind — a note has no stored file to clean up. */
  const remove = async (entry: VaultEntry) => {
    if (entry.kind === 'note') {
      await deleteNote(entry.id)
      if (openNote?.id === entry.id) setPanel(null)
      return
    }
    await deleteItem(entry.id)
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <VaultIcon size={18} style={{ color: accent }} />
            <h1 className="font-display text-xl font-normal text-gray-800">Vault</h1>
          </div>
          {!panel && (
            // Two actions, both full tap targets. Writing sits first because
            // it's the one with nothing to prepare — the thought is already
            // there, and the note should be one tap from it.
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPanel({ mode: 'write' })}
                className="press inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full text-white text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                <PenLine size={15} /> Write a note
              </button>
              <button
                onClick={() => setPanel({ mode: 'upload' })}
                className="press inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-full border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-300 hover:text-gray-800 transition-colors"
              >
                <Plus size={15} /> Upload
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Every important document in one place. Write notes and checklists, upload files, and
          invoices and contracts show up on their own.
        </p>
      </FadeIn>

      <div className="max-w-3xl space-y-3">
        {panel?.mode === 'upload' && (
          <VaultUpload
            accent={accent}
            clients={clients}
            onSave={saveUpload}
            onCancel={() => setPanel(null)}
          />
        )}

        {panel?.mode === 'write' && (
          <VaultNoteEditor
            accent={accent}
            clients={clients}
            onSave={saveNote}
            onCancel={() => setPanel(null)}
          />
        )}

        {panel?.mode === 'edit' && openNote && (
          <VaultNoteEditor
            accent={accent}
            clients={clients}
            initial={{
              title:      openNote.title,
              body:       openNote.body ?? '',
              category:   openNote.category,
              visibility: openNote.visibility ?? 'private',
              contact_id: openNote.contact_id,
            }}
            onSave={saveNote}
            onCancel={() => setPanel({ mode: 'read', entry: openNote })}
          />
        )}

        {panel?.mode === 'read' && openNote && (
          <VaultNoteReader
            key={openNote.id}
            entry={openNote}
            accent={accent}
            canManage
            onSaveBody={(body) => updateNote(openNote.id, { body })}
            onEdit={() => setPanel({ mode: 'edit', entry: openNote })}
            onClose={() => setPanel(null)}
          />
        )}

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <input
            value={filter.search ?? ''}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            placeholder="Search documents"
            aria-label="Search documents"
            className="w-full pl-9 pr-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
          />
        </div>

        {/* Kind — horizontally scrollable so four filters never wrap awkwardly
            on a narrow phone. */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
          {KINDS.map((k) => {
            const active = (filter.kind ?? 'all') === k.key
            return (
              <button
                key={k.key}
                onClick={() => setFilter({ ...filter, kind: k.key })}
                className="flex-shrink-0 px-3 min-h-[40px] rounded-xl text-xs font-medium border transition-colors"
                style={active
                  ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
                  : { borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                {k.label}
                <span className="ml-1.5 text-gray-300">{counts[k.key]}</span>
              </button>
            )
          })}
        </div>

        {/* Category */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
          <button
            onClick={() => setFilter({ ...filter, category: 'all' })}
            className="flex-shrink-0 px-3 min-h-[40px] rounded-xl text-2xs font-medium border transition-colors"
            style={(filter.category ?? 'all') === 'all'
              ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
              : { borderColor: '#E5E7EB', color: '#6B7280' }}
          >
            All categories
          </button>
          {VAULT_CATEGORIES.map((c: VaultCategory) => {
            const active = filter.category === c
            return (
              <button
                key={c}
                onClick={() => setFilter({ ...filter, category: c })}
                className="flex-shrink-0 px-3 min-h-[40px] rounded-xl text-2xs font-medium border transition-colors"
                style={active
                  ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
                  : { borderColor: '#E5E7EB', color: '#6B7280' }}
              >
                {VAULT_CATEGORY_LABEL[c]}
              </button>
            )
          })}
        </div>

        {resharing && (
          <ReshareRow
            entry={resharing}
            accent={accent}
            clients={clients}
            onDone={() => setResharing(null)}
            onSave={async (patch) => {
              // Same decision, two tables — a note reshares through its own
              // endpoint because that's where its row lives.
              if (resharing.kind === 'note') await updateNote(resharing.id, patch)
              else await updateItem(resharing.id, patch)
              setResharing(null)
            }}
          />
        )}

        <VaultList
          entries={visible}
          loading={loading}
          error={error}
          accent={accent}
          canManage
          onDelete={remove}
          onReshare={setResharing}
          onOpen={(entry) => setPanel({ mode: 'read', entry })}
          emptyMessage={
            entries.length > 0
              ? 'Nothing matches that. Try a different search or filter.'
              : undefined
          }
        />
      </div>
    </div>
  )
}

/**
 * Changing who can see one document, inline above the list.
 *
 * A separate small component rather than a modal: resharing is a one-decision
 * change, and a dialog for it would be heavier than the thing it does.
 */
function ReshareRow({
  entry, accent, clients, onSave, onDone,
}: {
  entry: VaultEntry
  accent: string
  clients: { id: string; name: string }[]
  onSave: (patch: { visibility: 'private' | 'client' | 'all_clients'; contact_id: string | null }) => Promise<void>
  onDone: () => void
}) {
  const [visibility, setVisibility] = useState(entry.visibility ?? 'private')
  const [contactId, setContactId]   = useState(entry.contact_id ?? '')
  const [saving, setSaving]         = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onSave({
        visibility,
        contact_id: visibility === 'client' ? contactId : null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-xs font-medium text-gray-700 mb-1">Who can see “{entry.title}”?</p>
      <p className="text-2xs text-gray-400 mb-3">
        Changing this takes effect straight away, in every client portal.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {(['private', 'client', 'all_clients'] as const).map((v) => {
          const active = visibility === v
          return (
            <button
              key={v}
              onClick={() => setVisibility(v)}
              className="px-3 min-h-[44px] rounded-xl text-xs font-medium border transition-colors"
              style={active
                ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
                : { borderColor: '#E5E7EB', color: '#6B7280' }}
            >
              {v === 'private' ? 'Only your team' : v === 'client' ? 'One client' : 'All clients'}
            </button>
          )
        })}
      </div>

      {visibility === 'client' && (
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          aria-label="Which client"
          className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-gray-400 focus:bg-white transition-colors"
        >
          <option value="">Choose a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={onDone}
          className="px-3 py-2.5 min-h-[44px] rounded-full text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={() => void save()}
          disabled={saving || (visibility === 'client' && !contactId)}
          className="press px-4 py-2.5 min-h-[44px] rounded-full text-white text-xs font-semibold disabled:opacity-40"
          style={{ backgroundColor: accent }}
        >
          Save
        </button>
      </div>
    </div>
  )
}
