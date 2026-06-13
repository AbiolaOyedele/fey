'use client'

import { useState } from 'react'
import { UserPlus, Copy, Check, X, Shield, Trash2, Users } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useTeam } from '@/hooks/useTeam'
import { ROLE_LABELS, canManageTeam, type WorkspaceRole } from '@/types/team'

export default function TeamPage() {
  const { settings } = useSettings()
  const accent = settings.accent_color ?? '#ED64A6'

  const { workspace, role, loading: wsLoading } = useWorkspace()
  const { members, invites, loading, error, invite, changeRole, removeMember, revokeInvite } = useTeam(workspace?.id ?? null)

  const manager = canManageTeam(role)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [busy, setBusy] = useState(false)
  const [inviteErr, setInviteErr] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const handleInvite = async () => {
    if (!email.trim()) return
    setBusy(true); setInviteErr(null)
    try {
      const { invite_url } = await invite(email.trim(), inviteRole)
      setEmail('')
      void navigator.clipboard?.writeText(invite_url).catch(() => {})
      setCopiedLink(invite_url)
      setTimeout(() => setCopiedLink(null), 4000)
    } catch (e) {
      setInviteErr(e instanceof Error ? e.message : 'Could not send invite')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 page-enter max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Users size={18} style={{ color: accent }} />
        <h1 className="font-display text-[20px] font-normal text-gray-800">Team</h1>
      </div>
      <p className="text-xs text-gray-400 mb-6">
        {workspace ? `Members of ${workspace.name}` : 'Your workspace team'}
      </p>

      {/* Invite */}
      {manager && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Invite a teammate</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@email.com"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={() => void handleInvite()}
              disabled={busy || !email.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
              style={{ backgroundColor: accent }}
            >
              <UserPlus size={14} /> Invite
            </button>
          </div>
          {inviteErr && <p className="text-xs text-red-500 mt-2">{inviteErr}</p>}
          {copiedLink && (
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
              <Check size={12} className="text-green-500" /> Invite sent — link copied to clipboard
            </p>
          )}
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">Members{members.length > 0 && ` · ${members.length}`}</p>
        </div>

        {loading || wsLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm text-gray-500">Couldn’t load your team. Please refresh.</p>
          </div>
        ) : (
          <div>
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: m.role === 'owner' ? accent : '#9CA3AF' }}
                >
                  {(m.name ?? m.email ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.name ?? m.email ?? 'Teammate'}</p>
                  {m.email && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
                </div>

                {manager && m.role !== 'owner' ? (
                  <select
                    value={m.role}
                    onChange={(e) => void changeRole(m.id, e.target.value as WorkspaceRole)}
                    className="text-xs rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-600 focus:outline-none focus:border-gray-400"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                    style={m.role === 'owner' ? { backgroundColor: `${accent}15`, color: accent } : { backgroundColor: '#F3F4F6', color: '#6B7280' }}
                  >
                    {m.role === 'owner' && <Shield size={11} />}
                    {ROLE_LABELS[m.role]}
                  </span>
                )}

                {manager && m.role !== 'owner' && (
                  <button
                    onClick={() => void removeMember(m.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                    title="Remove from team"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {manager && invites.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Pending invites · {invites.length}</p>
          </div>
          <div>
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <UserPlus size={14} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{inv.email}</p>
                  <p className="text-xs text-gray-400">Invited as {ROLE_LABELS[inv.role]} · pending</p>
                </div>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/team/accept?token=${inv.token}`
                    void navigator.clipboard?.writeText(url).catch(() => {})
                    setCopiedLink(url); setTimeout(() => setCopiedLink(null), 3000)
                  }}
                  className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0"
                  title="Copy invite link"
                >
                  {copiedLink?.includes(inv.token) ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                </button>
                <button
                  onClick={() => void revokeInvite(inv.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Revoke invite"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
