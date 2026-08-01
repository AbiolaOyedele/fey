'use client'

import { useState } from 'react'
import { Users, Check, ShieldCheck } from 'lucide-react'
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
}

export default function PortalMemberList({
  members, meId, canManage, accent, loading, error, onChange,
}: PortalMemberListProps) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const apply = async (id: string, patch: { role?: PortalRole; can_sign?: boolean; can_pay?: boolean }) => {
    setBusyId(id)
    try {
      await onChange(id, patch)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center">
        <div className="w-11 h-11 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-4">
          <Users size={18} />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">No portal members yet</p>
        <p className="text-xs text-gray-400 leading-relaxed">
          Once someone signs up for this portal they’ll appear here and can be given a role.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: '#FDECEC', color: '#E53E3E' }}>
          {error}
        </div>
      )}

      {members.map((m) => {
        const isMe   = m.id === meId
        const busy   = busyId === m.id
        const viewer = m.role === 'viewer'
        return (
          <div key={m.id} className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
            {/* Identity */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                style={{ backgroundColor: accent }}
              >
                {m.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {m.name}
                  {isMe && <span className="ml-1.5 text-2xs font-normal text-gray-400">You</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{m.email}</p>
              </div>
              {m.role === 'client_admin' && (
                <ShieldCheck size={15} className="flex-shrink-0" style={{ color: accent }} aria-label="Portal admin" />
              )}
            </div>

            {/* Role */}
            <span className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-2">Role</span>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {PORTAL_ROLES.map((role) => {
                const active = m.role === role
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={!canManage || busy}
                    onClick={() => void apply(m.id, { role })}
                    className="inline-flex items-center gap-1.5 px-3 h-11 rounded-xl text-xs font-medium border transition-colors disabled:opacity-60 disabled:cursor-default"
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
            <p className="text-2xs text-gray-400 leading-relaxed mb-4">{PORTAL_ROLE_DESCRIPTION[m.role]}</p>

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
          </div>
        )
      })}

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
      className="inline-flex items-center gap-2 px-3 h-11 rounded-xl text-xs font-medium border transition-colors disabled:opacity-60 disabled:cursor-default"
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
