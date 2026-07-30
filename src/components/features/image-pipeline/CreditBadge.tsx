'use client'

import { Coins } from 'lucide-react'
import { fmtCredits } from './format'

/** Compact balance chip. Turns to a soft danger tint when the balance is empty. */
export default function CreditBadge({ balance, accent }: { balance: number; accent: string }) {
  const empty = balance < 0.25
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold"
      style={
        empty
          ? { borderColor: '#F8C4C4', backgroundColor: '#FDECEC', color: '#E53E3E' }
          : { borderColor: '#F1F1F3', backgroundColor: '#fff', color: '#4B5563' }
      }
    >
      <Coins size={12} style={{ color: empty ? '#E53E3E' : accent }} />
      {fmtCredits(balance)} <span className="font-normal text-gray-400">credits</span>
    </span>
  )
}
