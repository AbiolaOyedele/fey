'use client'

import { useCallback, useState } from 'react'
import { Users, Inbox, SlidersHorizontal, BarChart3, Lock, ChevronDown } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useImagePipelineContext } from '@/hooks/useImagePipelineContext'
import { useImagePipelineAdmin } from '@/hooks/useImagePipelineAdmin'
import type { AllocationCadence, ImageTier, RateKey } from '@/types/image-pipeline'
import AdminUserTable from '@/components/features/image-pipeline/admin/AdminUserTable'
import CreditRequestQueue from '@/components/features/image-pipeline/admin/CreditRequestQueue'
import RatesPanel from '@/components/features/image-pipeline/admin/RatesPanel'
import CostDashboard from '@/components/features/image-pipeline/admin/CostDashboard'

/**
 * Admin panel — tiers, allocations, credit requests, rates and the cost
 * dashboard. Gated for a super admin OR the workspace owner (the server
 * re-verifies every admin route in Batch 2; this is UX gating only).
 */
export default function ImagePipelineAdminPage() {
  const { settings, showToast } = useSettings()
  const accent = settings.accent_color || '#ED64A6'
  const { context, loading: ctxLoading, refresh: refreshContext } = useImagePipelineContext()
  const admin = useImagePipelineAdmin()

  const nameOf = useCallback(
    (userId: string) => admin.users.find((u) => u.user_id === userId)?.display_name ?? 'Unknown',
    [admin.users],
  )

  // Toasting wrappers so every admin action confirms success/failure.
  const toastOk = useCallback(async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); showToast(ok) } catch { showToast('Something went wrong. Please try again.') }
  }, [showToast])

  const setTier = useCallback((userId: string, override: ImageTier | null) =>
    toastOk(() => admin.setTier(userId, override), 'Tier updated'), [admin, toastOk])
  const upsertAllocation = useCallback((userId: string, amount: number, cadence: AllocationCadence) =>
    toastOk(() => admin.upsertAllocation(userId, amount, cadence), 'Allocation saved'), [admin, toastOk])
  const grant = useCallback((userId: string, amount: number) =>
    toastOk(async () => { await admin.grant(userId, amount); await refreshContext() }, 'Credits granted'), [admin, toastOk, refreshContext])
  const resolveRequest = useCallback((requestId: string, decision: 'approved' | 'denied') =>
    toastOk(async () => { await admin.resolveRequest(requestId, decision); await refreshContext() }, decision === 'approved' ? 'Request approved' : 'Request denied'), [admin, toastOk, refreshContext])
  const updateRate = useCallback((key: RateKey, value: number) =>
    toastOk(() => admin.updateRate(key, value), 'Rate updated'), [admin, toastOk])

  const isAdmin = !!context && (context.admin.is_super_admin || context.admin.is_workspace_owner)

  if (ctxLoading) {
    return <div className="h-40 rounded-2xl bg-white border border-gray-100 animate-pulse" />
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-10 flex flex-col items-center text-center">
        <span className="w-12 h-12 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center mb-3"><Lock size={22} /></span>
        <p className="text-sm font-medium text-gray-600">Owner &amp; super admins only</p>
        <p className="text-xs text-gray-400 mt-1">You don’t have access to the Image Pipeline admin panel.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Section icon={<BarChart3 size={15} />} title="Cost & usage" accent={accent}>
        {admin.dashboard && (
          <CostDashboard dashboard={admin.dashboard} period={admin.period} onPeriod={admin.setPeriod} accent={accent} />
        )}
      </Section>

      <Section icon={<Inbox size={15} />} title="Credit requests" accent={accent} count={admin.requests.filter((r) => r.status === 'pending').length}>
        <CreditRequestQueue requests={admin.requests} accent={accent} onResolve={resolveRequest} nameOf={nameOf} />
      </Section>

      <Section icon={<Users size={15} />} title="Users, tiers & allocations" accent={accent} count={admin.users.length}>
        <AdminUserTable users={admin.users} accent={accent} onSetTier={setTier} onUpsertAllocation={upsertAllocation} onGrant={grant} />
      </Section>

      <Section icon={<SlidersHorizontal size={15} />} title="Rates" accent={accent} count={admin.rates.length} collapsible defaultOpen={false}>
        <RatesPanel rates={admin.rates} accent={accent} onUpdate={updateRate} />
      </Section>
    </div>
  )
}

function Section({
  icon, title, accent, count, collapsible = false, defaultOpen = true, children,
}: {
  icon: React.ReactNode
  title: string
  accent: string
  count?: number
  collapsible?: boolean
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const header = (
    <div className="flex items-center gap-2">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}1F`, color: accent }}>{icon}</span>
      <h2 className="font-display text-base text-gray-800">{title}</h2>
      {typeof count === 'number' && count > 0 && (
        <span className="text-3xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{count}</span>
      )}
      {collapsible && <ChevronDown size={16} className={`ml-auto text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} />}
    </div>
  )

  return (
    <section>
      {collapsible ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left mb-3" aria-expanded={open}>
          {header}
        </button>
      ) : (
        <div className="mb-3">{header}</div>
      )}
      {(!collapsible || open) && children}
    </section>
  )
}
