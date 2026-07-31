'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'

interface RequestCreditsFormProps {
  accent: string
  onSubmit: (amount: number, note?: string) => Promise<{ ok: boolean; message: string }>
}

/**
 * Request-only top-up form (no payments in v1). Submits an amount + optional
 * note for an admin to approve or deny.
 */
export default function RequestCreditsForm({ accent, onSubmit }: RequestCreditsFormProps) {
  const { showToast } = useSettings()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)

  const value = Number(amount)
  const valid = Number.isFinite(value) && value > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setFeedback(null)
    const result = await onSubmit(value, note.trim() || undefined)
    setFeedback(result)
    setBusy(false)
    showToast(result.message)
    if (result.ok) { setAmount(''); setNote('') }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5">
      <h3 className="font-display text-sm text-gray-800 mb-1">Request more credits</h3>
      <p className="text-2xs text-gray-400 mb-4">An admin reviews every request. No payment is taken.</p>

      <label className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">Amount (credits)</label>
      <input
        type="number"
        inputMode="decimal"
        min={1}
        step={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g. 10"
        className="w-full rounded-xl border border-gray-200 bg-white px-3 h-11 text-sm text-gray-700 outline-none focus:border-gray-300 mb-3"
      />

      <label className="block text-2xs font-semibold uppercase tracking-widest text-gray-300 mb-1.5">Note (optional)</label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="What do you need them for?"
        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700 outline-none resize-y focus:border-gray-300 mb-4"
      />

      <button
        type="submit"
        disabled={!valid || busy}
        className="inline-flex items-center gap-1.5 rounded-xl px-4 h-12 text-sm font-medium text-white transition-all active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: accent }}
      >
        <Send size={15} /> {busy ? 'Sending…' : 'Send request'}
      </button>

      {feedback && (
        <p className="text-xs mt-3" style={{ color: feedback.ok ? accent : '#E53E3E' }}>{feedback.message}</p>
      )}
    </form>
  )
}
