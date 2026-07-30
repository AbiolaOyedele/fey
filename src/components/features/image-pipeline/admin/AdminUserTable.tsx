'use client'

import { useState } from 'react'
import { Coins, Gift, ChevronDown } from 'lucide-react'
import type { AdminUserRow, AllocationCadence, ImageTier } from '@/types/image-pipeline'
import { fmtCredits } from '../format'

interface AdminUserTableProps {
  users: AdminUserRow[]
  accent: string
  onSetTier: (userId: string, override: ImageTier | null) => Promise<void>
  onUpsertAllocation: (userId: string, amount: number, cadence: AllocationCadence) => Promise<void>
  onGrant: (userId: string, amount: number) => Promise<void>
}

/**
 * Collapsed user list — each member is an accordion row showing a compact
 * summary, expanding to reveal tier / allocation / grant controls. Keeps the
 * panel manageable with many members.
 */
export default function AdminUserTable({ users, accent, onSetTier, onUpsertAllocation, onGrant }: AdminUserTableProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50 overflow-hidden">
      {users.map((u) => (
        <AdminUserRowItem
          key={u.user_id}
          user={u}
          accent={accent}
          onSetTier={onSetTier}
          onUpsertAllocation={onUpsertAllocation}
          onGrant={onGrant}
        />
      ))}
    </div>
  )
}

const TIER_OPTIONS: { label: string; value: ImageTier | null }[] = [
  { label: 'Auto', value: null },
  { label: 'Standard', value: 'standard' },
  { label: 'Pro', value: 'pro' },
]

function AdminUserRowItem({
  user, accent, onSetTier, onUpsertAllocation, onGrant,
}: {
  user: AdminUserRow
  accent: string
  onSetTier: (userId: string, override: ImageTier | null) => Promise<void>
  onUpsertAllocation: (userId: string, amount: number, cadence: AllocationCadence) => Promise<void>
  onGrant: (userId: string, amount: number) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(user.allocation ? String(user.allocation.amount) : '')
  const [cadence, setCadence] = useState<AllocationCadence>(user.allocation?.cadence ?? 'monthly')
  const [grant, setGrant] = useState('')
  const [busy, setBusy] = useState(false)

  const saveAllocation = async () => {
    const v = Number(amount)
    if (!Number.isFinite(v) || v < 0) return
    setBusy(true); await onUpsertAllocation(user.user_id, v, cadence); setBusy(false)
  }
  const doGrant = async () => {
    const v = Number(grant)
    if (!Number.isFinite(v) || v === 0) return
    setBusy(true); await onGrant(user.user_id, v); setGrant(''); setBusy(false)
  }

  return (
    <div>
      {/* Summary row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/60 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 truncate">{user.display_name}</p>
          <p className="text-2xs text-gray-400 truncate">{user.email}</p>
        </div>
        <span
          className="text-3xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: accent, backgroundColor: `${accent}1F` }}
        >
          {user.resolved_tier}
        </span>
        <div className="text-right flex-shrink-0 w-16">
          <p className="text-sm font-semibold text-gray-800 tabular-nums">{fmtCredits(user.balance)}</p>
          <p className="text-3xs text-gray-400">credits</p>
        </div>
        <ChevronDown size={16} className={`text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded controls */}
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-100 bg-gray-50 p-0.5">
              {TIER_OPTIONS.map((opt) => {
                const active = user.tier_override === opt.value || (opt.value === null && user.tier_override === null)
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => onSetTier(user.user_id, opt.value)}
                    className={`px-2.5 h-9 rounded-md text-2xs font-medium transition-colors ${active ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <span className="text-3xs text-gray-400">
              tier override · using <span className="font-semibold text-gray-600 uppercase">{user.resolved_tier}</span>
            </span>
            <span className="text-3xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {user.skip_prompt_review ? 'Skips prompt review' : 'Reviews prompts'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-3xs font-semibold uppercase tracking-wide text-gray-300 mb-1">Recurring allocation</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                  className="w-16 rounded-lg border border-gray-200 px-2 h-10 text-xs text-gray-700 outline-none focus:border-gray-300"
                />
                <select
                  value={cadence} onChange={(e) => setCadence(e.target.value as AllocationCadence)}
                  className="rounded-lg border border-gray-200 px-2 h-10 text-xs text-gray-700 outline-none focus:border-gray-300"
                >
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                </select>
                <button
                  type="button" onClick={saveAllocation} disabled={busy}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 h-10 text-2xs font-medium text-white transition-all active:scale-95 disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  <Coins size={12} /> Save
                </button>
              </div>
            </div>
            <div>
              <label className="block text-3xs font-semibold uppercase tracking-wide text-gray-300 mb-1">One-off grant</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" value={grant} onChange={(e) => setGrant(e.target.value)} placeholder="e.g. 5"
                  className="w-16 rounded-lg border border-gray-200 px-2 h-10 text-xs text-gray-700 outline-none focus:border-gray-300"
                />
                <button
                  type="button" onClick={doGrant} disabled={busy}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 h-10 text-2xs font-medium text-gray-700 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Gift size={12} /> Grant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
