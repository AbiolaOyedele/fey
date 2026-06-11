'use client'

import type { CrmContact, ContactStatus } from '@/types/crm'

const STATUS_CONFIG: Record<ContactStatus, { dot: string; label: string }> = {
  active:    { dot: 'bg-emerald-400', label: 'Active' },
  idle:      { dot: 'bg-amber-400',   label: 'Idle' },
  completed: { dot: 'bg-gray-300',    label: 'Done' },
}

interface ContactListRowProps {
  contact: CrmContact
  selected: boolean
  onClick: () => void
}

function avatarInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  { bg: '#FDE8E8', text: '#92400E' },
  { bg: '#FEF3C7', text: '#78350F' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#DBEAFE', text: '#1E3A8A' },
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#FCE7F3', text: '#9D174D' },
]

function avatarColor(id: string) {
  const idx = id.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx] ?? AVATAR_COLORS[0]!
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)    return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)    return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function ContactListRow({ contact, selected, onClick }: ContactListRowProps) {
  const status = STATUS_CONFIG[contact.status]
  const color  = avatarColor(contact.id)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 h-16 border-b border-gray-100 last:border-b-0 transition-colors ${
        selected ? 'bg-pink-50' : 'hover:bg-gray-50/70'
      }`}
    >
      {/* Avatar */}
      {contact.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={contact.avatar_url}
          alt={contact.name}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: color.bg, color: color.text }}
        >
          {avatarInitials(contact.name)}
        </div>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-gray-900 truncate leading-snug">{contact.name}</p>
        <p className="text-[12px] text-gray-400 truncate leading-snug">
          {contact.company ?? contact.email ?? 'No details'}
        </p>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status?.dot ?? 'bg-gray-300'}`} />
          <span className="text-[11px] text-gray-400">{status?.label ?? contact.status}</span>
        </div>
        <span className="text-[11px] text-gray-300">{relativeTime(contact.updated_at)}</span>
      </div>
    </button>
  )
}
