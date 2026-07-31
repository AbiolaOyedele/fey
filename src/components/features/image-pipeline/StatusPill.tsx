'use client'

import type { CSSProperties } from 'react'
import type { GenerationStatus } from '@/types/image-pipeline'

/** Fey brand palette — accent (pink), soft danger (red), neutral grays only. */
const DANGER = '#E53E3E'
const DANGER_BG = '#FDECEC'

type Tone = 'neutral' | 'progress' | 'success' | 'danger' | 'action'

interface StatusMeta { label: string; tone: Tone }

/** Central mapping of pipeline status → user-facing label + tone. */
export const STATUS_META: Record<GenerationStatus, StatusMeta> = {
  prompting: { label: 'Writing prompt', tone: 'progress' },
  prompt_review: { label: 'Review prompt', tone: 'action' },
  generating_preview: { label: 'Rendering preview', tone: 'progress' },
  preview_ready: { label: 'Preview ready', tone: 'action' },
  generating_final: { label: 'Rendering final', tone: 'progress' },
  complete: { label: 'Complete', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
  expired: { label: 'Expired', tone: 'neutral' },
}

export default function StatusPill({
  status,
  accent = '#ED64A6',
  className = '',
}: {
  status: GenerationStatus
  accent?: string
  className?: string
}) {
  const meta = STATUS_META[status]
  const inProgress = meta.tone === 'progress'

  let style: CSSProperties
  let dotColor = accent
  switch (meta.tone) {
    case 'success': // solid accent pill — distinct from the tinted in-progress states
      style = { backgroundColor: `var(--accent-fill, ${accent})`, color: '#fff' }
      break
    case 'action':
      style = { backgroundColor: `${accent}1F`, color: accent }
      break
    case 'danger':
      style = { backgroundColor: DANGER_BG, color: DANGER }
      break
    case 'progress':
      style = { backgroundColor: '#F3F4F6', color: '#6B7280' }
      dotColor = accent
      break
    default:
      style = { backgroundColor: '#F3F4F6', color: '#9CA3AF' }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold ${className}`}
      style={style}
    >
      {inProgress && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: dotColor }} aria-hidden />}
      {meta.label}
      {inProgress && <span className="sr-only"> — in progress</span>}
    </span>
  )
}
