'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { IpRateConfig, RateKey } from '@/types/image-pipeline'
import { fmtDateTime } from '../format'

interface RatesPanelProps {
  rates: IpRateConfig[]
  accent: string
  onUpdate: (key: RateKey, value: number) => Promise<void>
}

const LABELS: Record<RateKey, string> = {
  anchor_cost_per_credit_usd: 'Anchor cost / credit',
  std_preview_usd: 'Standard preview',
  pro_preview_usd: 'Pro preview',
  pro_final_2k_usd: 'Pro final (2K)',
  std_final_2k_usd: 'Standard final (2K)',
  prompt_haiku_est_usd: 'Prompt · Haiku',
  prompt_sonnet_est_usd: 'Prompt · Sonnet',
}

/** In-place editable pricing rows. updated_at surfaced so staleness is visible. */
export default function RatesPanel({ rates, accent, onUpdate }: RatesPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50">
      {rates.map((rate) => (
        <RateRow key={rate.key} rate={rate} accent={accent} onUpdate={onUpdate} />
      ))}
    </div>
  )
}

function RateRow({ rate, accent, onUpdate }: { rate: IpRateConfig; accent: string; onUpdate: (key: RateKey, value: number) => Promise<void> }) {
  const [value, setValue] = useState(String(rate.value))
  const [busy, setBusy] = useState(false)
  const changed = Number(value) !== rate.value && value.trim() !== ''

  const save = async () => {
    const v = Number(value)
    if (!Number.isFinite(v) || v < 0) return
    setBusy(true); await onUpdate(rate.key, v); setBusy(false)
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="text-sm text-gray-700 truncate">{LABELS[rate.key]}</p>
        <p className="text-3xs text-gray-300">Updated {fmtDateTime(rate.updated_at)}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-2xs text-gray-400">$</span>
        <input
          type="number" min={0} step="0.001" value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24 rounded-lg border border-gray-200 px-2 h-10 text-xs text-gray-700 outline-none focus:border-gray-300 text-right tabular-nums"
        />
        <button
          type="button" onClick={save} disabled={!changed || busy}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-30"
          style={{ backgroundColor: changed && !busy ? accent : '#D1D5DB' }}
          aria-label="Save rate"
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  )
}
