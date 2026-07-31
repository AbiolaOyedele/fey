'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getCreditsSummary, pipelineErrorMessage, requestCredits } from '@/lib/image-pipeline-api'
import type { CreditBalance, IpCreditAllocation, IpCreditLedgerEntry } from '@/types/image-pipeline'

interface CreditsState {
  balance: CreditBalance | null
  ledger: IpCreditLedgerEntry[]
  allocation: IpCreditAllocation | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  submitRequest: (amount: number, note?: string) => Promise<{ ok: boolean; message: string }>
}

/** Balance, ledger history and the request-credits action for the Credits page. */
export function useImageCredits(): CreditsState {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [ledger, setLedger] = useState<IpCreditLedgerEntry[]>([])
  const [allocation, setAllocation] = useState<IpCreditAllocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const instanceId = useId()

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const summary = await getCreditsSummary()
      setBalance(summary.balance)
      setLedger(summary.ledger)
      setAllocation(summary.allocation)
      setError(null)
    } catch (e) {
      setError(pipelineErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refetch() }, [refetch])

  // Live updates: a new ledger row (grant, approval, charge) refreshes the page.
  useEffect(() => {
    if (!uid) return
    const channel = supabase
      .channel(`ip-credits-${uid}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ip_credit_ledger', filter: `user_id=eq.${uid}` },
        () => { void refetch() },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [uid, refetch, instanceId])

  const submitRequest = useCallback(
    async (amount: number, note?: string): Promise<{ ok: boolean; message: string }> => {
      try {
        await requestCredits(amount, note)
        await refetch()
        return { ok: true, message: 'Request sent — an admin will review it.' }
      } catch (e) {
        return { ok: false, message: pipelineErrorMessage(e) }
      }
    },
    [refetch],
  )

  return { balance, ledger, allocation, loading, error, refetch, submitRequest }
}
