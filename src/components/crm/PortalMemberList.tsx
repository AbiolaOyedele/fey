'use client'

import { useState } from 'react'
import { Users, Check, ShieldCheck, ChevronDown, Trash2, Loader2 } from 'lucide-react'
import {
  PORTAL_ROLES,
  PORTAL_ROLE_LABEL,
  PORTAL_ROLE_DESCRIPTION,
  type PortalRole,
  type PortalUser,
} from '@/types/crm'

/**
 * The people with access to one client's portal, with their roles.
 *
 * Shared by the owner's CRM and the client's own Members page so both sides see
 * the same thing. `canManage` decides whether the controls are live: the owner
 * always can; a client only when they're their own side's admin.
 *
 * One row per person, expanding to the controls. The previous layout gave every
 * member a full card of buttons, so a client with five colleagues scrolled past
 * five identical control panels to find one name.
 */

interface PortalMemberListProps {
  members: PortalUser[]
  /** The viewer's own portal_user id, when they're a client. Marks "You". */
  meId?: string | undefined
  canManage: boolean
  accent: string
  loading?: boolean
  error?: string
  onChange: (portalUserId: string, patch: { role?: PortalRole; can_sign?: boolean; can_pay?: boolean }) => Promise<void>
  /** Omitted where removal isn't offered (the owner's CRM view). */
  onRemove?: (portalUserId: string) => Promise<void>
}

export default function PortalMemberList({
  members, meId, canManage, accent, loading, error, onChange, onRemove,
}: PortalMemberListProps) {
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [openId, setOpenId]     = useState<string | null>(null)
  const [confirmId, setConfirm] = useState<string | null>(null)

  const apply = async (id: string, patch: { role?: PortalRole; can_sign?: boolean; can_pay?: boolean }) => {
    setBusyId(id)
    try {
      await onChange(id, patch)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: string) => {
    if (!onRemove) return
    setBusyId(id)
    try {
      await onRemove(id)
      setConfirm(null)
      setOpenId(null)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`h-16 bg-gray-50 animate-pulse ${i > 0 ? 'border-t border-gray-50' : ''}`} />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
        <div className="w-11 h-11 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-3">
          <Users size={18} />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">No portal members yet</p>
        <p className="text-xs text-gray-400 leading-relaxed">
          Once someone joins this portal they’ll appear here and can be given a role.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#FDECEC', color: '#E53E3E' }}>
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        {members.map((m, i) => {
          const isMe   = m.id === meId
          const busy   = busyId === m.id
          const viewer = m.role === 'viewer'
          const open   = openId === m.id
          return (
            <div key={m.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
              {/* Row */}
              <button
                type="button"
                onClick={() => setOpenId(open ? null : m.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-gray-50/60 transition-colors"
              >
                <span
                  aria-hidden
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: m.pending ? '#CBD5E1' : accent }}
                >
                  {m.name.charAt(0).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 truncate">{m.name}</span>
                    {isMe && <span className="text-2xs font-normal text-gray-400 flex-shrink-0">You</span>}
                    {m.role === 'client_admin' && (
                      <ShieldCheck size={13} className="flex-shrink-0" style={{ color: accent }} aria-label="Portal admin" />
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-2xs text-gray-400">
                    <span className="truncate">{m.email}</span>
                    {m.pending && <span className="flex-shrink-0 text-gray-300">· hasn’t joined yet</span>}
                  </span>
                </span>

                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="hidden sm:inline text-2xs font-medium text-gray-400">
                    {PORTAL_ROLE_LABEL[m.role]}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>

              {/* Controls */}
              {open && (
                <div className="px-4 pb-4 pt-1">
                  <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Role</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PORTAL_ROLES.map((role) => {
                      const active = m.role === role
                      return (
                        <button
                          key={role}
                          type="button"
                          disabled={!canManage || busy}
                          onClick={() => void apply(m.id, { role })}
                          className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-xs font-medium border transition-colors disabled:opacity-60 disabled:cursor-default"
                          style={active
                            ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
                            : { borderColor: '#E5E7EB', color: '#6B7280' }}
                        >
                          {active && <Check size={13} />}
                          {PORTAL_ROLE_LABEL[role]}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-2xs text-gray-400 leading-relaxed mt-2 mb-3">{PORTAL_ROLE_DESCRIPTION[m.role]}</p>

                  {/* Capabilities — deliberately independent of the role ladder. */}
                  <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Can</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Capability
                      label="Sign contracts"
                      on={m.can_sign && !viewer}
                      disabled={!canManage || busy || viewer}
                      accent={accent}
                      onToggle={() => void apply(m.id, { can_sign: !m.can_sign })}
                    />
                    <Capability
                      label="Pay invoices"
                      on={m.can_pay && !viewer}
                      disabled={!canManage || busy || viewer}
                      accent={accent}
                      onToggle={() => void apply(m.id, { can_pay: !m.can_pay })}
                    />
                  </div>
                  {viewer && (
                    <p className="text-2xs text-gray-400 leading-relaxed mt-2">
                      Viewers can’t sign or pay. Change the role first to turn these on.
                    </p>
                  )}

                  {onRemove && canManage && !isMe && (
                    <div className="mt-4 pt-3 border-t border-gray-50">
                      {confirmId === m.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-2xs text-gray-500 flex-1 min-w-[160px]">
                            Remove {m.name}? They’ll lose access straight away.
                          </span>
                          <button
                            onClick={() => setConfirm(null)}
                            className="px-3 py-2 min-h-[40px] rounded-full text-2xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void remove(m.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-2xs font-semibold text-white disabled:opacity-40"
                            style={{ backgroundColor: '#E53E3E' }}
                          >
                            {busy && <Loader2 size={11} className="animate-spin" />}
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirm(m.id)}
                          className="inline-flex items-center gap-1.5 text-2xs text-gray-400 hover:text-red-500 transition-colors min-h-[40px]"
                        >
                          <Trash2 size={12} /> Remove access
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!canManage && (
        <p className="text-2xs text-gray-400 leading-relaxed">
          Only a portal admin can change roles. Ask yours, or message the team.
        </p>
      )}
    </div>
  )
}

function Capability({
  label, on, disabled, accent, onToggle,
}: { label: string; on: boolean; disabled: boolean; accent: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex items-center gap-2 px-3 min-h-[44px] rounded-xl text-xs font-medium border transition-colors disabled:opacity-60 disabled:cursor-default"
      style={on
        ? { borderColor: accent, backgroundColor: `${accent}12`, color: accent }
        : { borderColor: '#E5E7EB', color: '#6B7280' }}
    >
      <span
        aria-hidden
        className="inline-flex items-center w-8 h-[18px] rounded-full p-0.5 transition-colors"
        style={{ backgroundColor: on ? accent : '#E2E8F0' }}
      >
        <span
          className="w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: on ? 'translateX(14px)' : 'translateX(0)' }}
        />
      </span>
      {label}
    </button>
  )
}
