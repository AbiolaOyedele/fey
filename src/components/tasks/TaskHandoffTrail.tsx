'use client'

import { ArrowRight, ShieldCheck, Undo2, UserRoundCog } from 'lucide-react'
import type { TaskHandoff, HandoffKind } from '@/types/work-tasks'
import { useTaskHandoffs } from '@/hooks/useTaskHandoffs'

interface TaskHandoffTrailProps {
  taskId: string
  /** Changes when the task moves, so the trail refreshes under the drawer. */
  reloadKey?: string
}

const KIND_META: Record<HandoffKind, { icon: typeof ArrowRight; color: string }> = {
  moved:             { icon: ArrowRight,   color: 'text-gray-400' },
  approved:          { icon: ShieldCheck,  color: 'text-green-500' },
  changes_requested: { icon: Undo2,        color: 'text-amber-500' },
  reassigned:        { icon: UserRoundCog, color: 'text-blue-500' },
}

/** "3 days", "4 hours", "22 minutes" — how long someone actually held it. */
function formatHeld(seconds: number | null): string | null {
  if (seconds === null || seconds < 60) return null
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

function describe(h: TaskHandoff): string {
  const to = h.to_user_name ?? 'nobody'
  switch (h.kind) {
    case 'approved':
      return h.to_stage_name ? `Approved — on to ${h.to_stage_name}, with ${to}` : `Approved, with ${to}`
    case 'changes_requested':
      return h.to_stage_name ? `Changes requested — back to ${h.to_stage_name}, with ${to}` : `Changes requested — back to ${to}`
    case 'reassigned':
      return `Handed to ${to}`
    default:
      return h.to_stage_name ? `Moved to ${h.to_stage_name}, with ${to}` : `Handed to ${to}`
  }
}

/**
 * Every pass of the baton on this task, newest first.
 *
 * The point isn't decoration: when a task lands late, this is what turns "who
 * was assigned to it" into "where it actually sat, and for how long" — which is
 * the only version of that question with a fair answer.
 */
export default function TaskHandoffTrail({ taskId, reloadKey }: TaskHandoffTrailProps) {
  const { handoffs, loading, error, refetch } = useTaskHandoffs(taskId, reloadKey)

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1].map((i) => <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-xs2 text-gray-500">
        {error}{' '}
        <button onClick={() => void refetch()} className="font-semibold underline">Try again</button>
      </div>
    )
  }

  if (handoffs.length === 0) {
    return <p className="text-xs2 text-gray-400">Hasn’t changed hands yet.</p>
  }

  return (
    <ol className="space-y-2.5">
      {handoffs.map((h) => {
        const meta = KIND_META[h.kind] ?? KIND_META.moved
        const Icon = meta.icon
        const held = formatHeld(h.held_seconds)
        return (
          <li key={h.id} className="flex items-start gap-2.5">
            <Icon size={13} className={`mt-0.5 flex-shrink-0 ${meta.color}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs2 text-gray-700 break-words">{describe(h)}</p>
              <p className="text-2xs text-gray-400 break-words">
                {h.actor_name ?? 'Someone'}
                {held && h.from_user_name && <> · {h.from_user_name} held it {held}</>}
                {held && !h.from_user_name && <> · sat {held}</>}
                {' · '}
                {new Date(h.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
              {h.note && (
                <p className="mt-1 text-2xs text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 break-words whitespace-pre-wrap">
                  {h.note}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
