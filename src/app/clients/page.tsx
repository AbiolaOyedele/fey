'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Users } from 'lucide-react'
import { useContacts } from '@/hooks/useCrm'
import ContactListRow from '@/components/crm/ContactListRow'
import AddContactModal from '@/components/crm/AddContactModal'
import { isActiveWithin } from '@/utils/relativeTime'
import type { ContactStatus, CreateContactPayload } from '@/types/crm'

const STATUS_FILTERS: { label: string; value: ContactStatus | 'all' }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Active',    value: 'active' },
  { label: 'Idle',      value: 'idle' },
  { label: 'Completed', value: 'completed' },
]

export default function CrmContactsPage() {
  const router = useRouter()
  const { contacts, loading, createContact } = useContacts()

  const [search,      setSearch]      = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>('all')
  const [selected,    setSelected]    = useState<string | null>(null)
  const [showModal,   setShowModal]   = useState(false)

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const matchSearch = !search
        || c.name.toLowerCase().includes(search.toLowerCase())
        || (c.company?.toLowerCase().includes(search.toLowerCase()) ?? false)
        || (c.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
      // "Active" now means recently active on the portal (not the manual status).
      const matchStatus =
        statusFilter === 'all'    ? true
        : statusFilter === 'active' ? isActiveWithin(c.last_seen_at)
        : c.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [contacts, search, statusFilter])

  const handleSelectContact = (id: string) => {
    setSelected(id)
    router.push(`/clients/${id}/messages`)
  }

  const handleCreate = async (payload: CreateContactPayload) => {
    const contact = await createContact(payload)
    setSelected(contact.id)
    router.push(`/clients/${contact.id}/messages`)
    return contact
  }

  return (
    <div className="flex h-screen overflow-hidden page-enter">
      {/* Left panel — contact list */}
      <div className="w-[320px] flex-shrink-0 flex flex-col border-r border-gray-100 bg-white h-full">
        {/* Header */}
        <div className="px-4 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                style={statusFilter === f.value ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-px px-4 py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Users size={28} className="text-gray-200 mb-3" />
              <p className="text-[14px] font-medium text-gray-500 mb-1">
                {search || statusFilter !== 'all' ? 'No clients found' : 'No clients yet'}
              </p>
              <p className="text-[12px] text-gray-400">
                {search || statusFilter !== 'all'
                  ? 'Try a different search or filter'
                  : 'Add your first client to get started'}
              </p>
              {!search && statusFilter === 'all' && (
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 px-4 py-2 rounded-full text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                >
                  Add Client
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white">
              {filtered.map((contact) => (
                <ContactListRow
                  key={contact.id}
                  contact={contact}
                  selected={selected === contact.id}
                  onClick={() => handleSelectContact(contact.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — detail placeholder (replaced by /clients/[id] routes) */}
      <div className="flex-1 flex flex-col items-center justify-center bg-appbg">
        <div className="text-center">
          <Users size={40} className="text-gray-200 mx-auto mb-4" />
          <p className="text-[15px] font-medium text-gray-500">Select a client</p>
          <p className="text-[13px] text-gray-400 mt-1">Choose from the list to view their workspace</p>
        </div>
      </div>

      {showModal && (
        <AddContactModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
