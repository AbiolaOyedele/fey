'use client'

import { Clock } from 'lucide-react'
import { timeLeft } from './format'

/** 7-day retention countdown shown on gallery items. */
export default function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const { label, urgent } = timeLeft(expiresAt)
  return (
    <span
      className={`inline-flex items-center gap-1 text-3xs font-medium ${urgent ? 'text-rose-500' : 'text-gray-400'}`}
      title={`Auto-deletes on ${new Date(expiresAt).toLocaleDateString()}`}
    >
      <Clock size={11} />
      {label}
    </span>
  )
}
