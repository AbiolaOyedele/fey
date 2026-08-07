'use client'

import { useState } from 'react'
import { Users, Check, ShieldCheck, ChevronDown, Trash2, Loader2, Ban, RotateCcw } from 'lucide-react'
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
 *
 * Taking access away is offered twice over, because the two cases are not the
 * same thing:
 *
 *   Turn off access  — reversible, and the one presented first. They're locked
 *                      out immediately, but everything they wrote stays where
 *                      it is and they can be let back in with one tap.
 *   Delete           — permanent, and deliberately buried behind the revoke
 *                      step so it can't be the accident.
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
  /** Turns access off, or hands it back. */
  onSetAccess?: (portalUserId: string, revoked: boolean) => Promise<void>
  /** Permanent removal. */
  onRemove?: (portalUserId: string) => Promise<void>
}

export default function PortalMemberList({
  members, meId, canManage, accent, loading, error, onChange, onSetAccess, onRemove,
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

  const setAccess = async (id: string, revoked: boolean) => {
    if (!onSetAccess) return
    setBusyId(id)
    try {
      await onSetAccess(id, revoked)
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
          const isMe    = m.id === meId
          const busy    = busyId === m.id
          const viewer  = m.role === 'viewer'
          const open    = openId === m.id
          const revoked = m.revoked_at !== null
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
                  style={{ backgroundColor: revoked ? '#E2E8F0' : m.pending ? '#CBD5E1' : accent }}
                >
                  {m.name.charAt(0).toUpperCase()}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className={`text-sm font-medium truncate ${revoked ? 'text-gray-400' : 'text-gray-800'}`}>
                      {m.name}
                    </span>
                    {isMe && <span className="text-2xs font-normal text-gray-400 flex-shrink-0">You</span>}
                    {m.role === 'client_admin' && !revoked && (
                      <ShieldCheck size={13} className="flex-shrink-0" style={{ color: accent }} aria-label="Portal admin" />
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-2xs text-gray-400">
                    <span className="truncate">{m.email}</span>
                    {m.pending && !revoked && <span className="flex-shrink-0 text-gray-300">· hasn’t joined yet</span>}
                  </span>
                </span>

                <span className="flex items-center gap-2 flex-shrink-0">
                  {revoked ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-2xs font-medium"
                      style={{ backgroundColor: 'var(--neutral-soft)', color: 'var(--neutral)' }}
                    >
                      <Ban size={11} /> No access
                    </span>
                  ) : (
                    <span className="hidden sm:inline text-2xs font-medium text-gray-400">
                      {PORTAL_ROLE_LABEL[m.role]}
                    </span>
                  )}
                  <ChevronDown
                    size={15}
                    className={`text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>

              {/* Controls */}
              {open && revoked && (
                <div className="px-4 pb-4 pt-1">
                  <p className="text-2xs text-gray-500 leading-relaxed mb-3">
                    {m.revoked_by
                      ? `Access was turned off by ${m.revoked_by}.`
                      : 'Access is turned off.'}
                    {' '}They can’t sign in or open anything, but everything they’ve
                    already sent is still here.
                  </p>

                  {canManage && !isMe && (
                    <div className="flex flex-wrap gap-2">
                      {onSetAccess && (
                        <button
                          onClick={() => void setAccess(m.id, false)}
                          disabled={busy}
                          className="press inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-2xs font-semibold text-white disabled:opacity-40"
                          style={{ backgroundColor: accent }}
                        >
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          Give access back
                        </button>
                      )}
                      {onRemove && (
                        confirmId === m.id ? (
                          <div className="w-full flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-2xs text-gray-500 flex-1 min-w-[180px]">
                              Delete {m.name} for good? This can’t be undone, and their
                              messages in your team chat will show as “Removed member”.
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
                              style={{ backgroundColor: 'var(--danger)' }}
                            >
                              {busy && <Loader2 size={11} className="animate-spin" />}
                              Delete for good
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirm(m.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-2xs font-medium text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={12} /> Delete for good
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}

              {open && !revoked && (
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

                  {/*
                    Only revoking is offered while someone is active. Deleting
                    is reachable from the revoked state, so the destructive,
                    irreversible option is never one tap away from a list of
                    names — and revoking first is almost always what was meant.
                  */}
                  {onSetAccess && canManage && !isMe && (
                    <div className="mt-4 pt-3 border-t border-gray-50">
                      {confirmId === m.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-2xs text-gray-500 flex-1 min-w-[180px]">
                            Turn off access for {m.name}? They’ll be signed out
                            straight away. You can give it back at any time.
                          </span>
                          <button
                            onClick={() => setConfirm(null)}
                            className="px-3 py-2 min-h-[40px] rounded-full text-2xs text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => { void setAccess(m.id, true); setConfirm(null) }}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-2xs font-semibold text-white disabled:opacity-40"
                            style={{ backgroundColor: 'var(--danger)' }}
                          >
                            {busy && <Loader2 size={11} className="animate-spin" />}
                            Turn off access
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirm(m.id)}
                          className="inline-flex items-center gap-1.5 text-2xs text-gray-400 hover:text-red-500 transition-colors min-h-[44px]"
                        >
                          <Ban size={12} /> Turn off access
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
