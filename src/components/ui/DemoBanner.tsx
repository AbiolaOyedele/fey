'use client'

import { Info } from 'lucide-react'

export default function DemoBanner() {
  return (
    <div
      className="w-full flex items-center justify-center gap-2 px-4 text-white text-xs font-medium z-50 flex-shrink-0"
      style={{ backgroundColor: 'var(--accent, #ED64A6)', minHeight: '2rem' }}
    >
      <Info size={13} className="flex-shrink-0" />
      <span>You are using a demo version of Fey. Data resets on refresh.</span>
    </div>
  )
}
