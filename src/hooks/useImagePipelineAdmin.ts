'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  adminCostDashboard,
  adminGetRates,
  adminListRequests,
  adminListUsers,
  adminManualGrant,
  adminResolveRequest,
  adminSetTierOverride,
  adminUpdateRate,
  adminUpsertAllocation,
  pipelineErrorMessage,
} from '@/lib/image-pipeline-api'
import type {
  AdminCostDashboardResponse,
  AdminUserRow,
  AllocationCadence,
  ImageTier,
  IpCreditRequest,
  IpRateConfig,
  RateKey,
} from '@/types/image-pipeline'

interface AdminState {
  users: AdminUserRow[]
  requests: IpCreditRequest[]
  rates: IpRateConfig[]
  dashboard: AdminCostDashboardResponse | null
  period: 'week' | 'month'
  loading: boolean
  error: string | null
  setPeriod: (p: 'week' | 'month') => void
  refetch: () => Promise<void>
  setTier: (userId: string, override: ImageTier | null) => Promise<void>
  upsertAllocation: (userId: string, amount: number, cadence: AllocationCadence) => Promise<void>
  grant: (userId: string, amount: number) => Promise<void>
  resolveRequest: (requestId: string, decision: 'approved' | 'denied') => Promise<void>
  updateRate: (key: RateKey, value: number) => Promise<void>
}

/** Backs the admin panel: users/tiers, allocations, requests, rates + cost dashboard. */
export function useImagePipelineAdmin(): AdminState {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [requests, setRequests] = useState<IpCreditRequest[]>([])
  const [rates, setRates] = useState<IpRateConfig[]>([])
  const [dashboard, setDashboard] = useState<AdminCostDashboardResponse | null>(null)
  const [period, setPeriodState] = useState<'week' | 'month'>('month')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const [u, r, ra, d] = await Promise.all([
        adminListUsers(),
        adminListRequests(),
        adminGetRates(),
        adminCostDashboard(period),
      ])
      setUsers(u)
      setRequests(r)
      setRates(ra)
      setDashboard(d)
      setError(null)
    } catch (e) {
      setError(pipelineErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [period])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refetch() }, [refetch])

  const setPeriod = useCallback((p: 'week' | 'month') => setPeriodState(p), [])

  const setTier = useCallback(async (userId: string, override: ImageTier | null) => {
    await adminSetTierOverride(userId, override)
    await refetch()
  }, [refetch])

  const upsertAllocation = useCallback(async (userId: string, amount: number, cadence: AllocationCadence) => {
    await adminUpsertAllocation(userId, amount, cadence)
    await refetch()
  }, [refetch])

  const grant = useCallback(async (userId: string, amount: number) => {
    await adminManualGrant(userId, amount)
    await refetch()
  }, [refetch])

  const resolveRequest = useCallback(async (requestId: string, decision: 'approved' | 'denied') => {
    await adminResolveRequest(requestId, decision)
    await refetch()
  }, [refetch])

  const updateRate = useCallback(async (key: RateKey, value: number) => {
    await adminUpdateRate(key, value)
    await refetch()
  }, [refetch])

  return {
    users, requests, rates, dashboard, period, loading, error,
    setPeriod, refetch, setTier, upsertAllocation, grant, resolveRequest, updateRate,
  }
}
