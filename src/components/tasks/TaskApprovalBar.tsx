'use client'

import { useState } from 'react'
import { ShieldCheck, Undo2, Lock } from 'lucide-react'
import type { Task, WorkflowStage, RuleOnTaskPayload } from '@/types/work-tasks'
import { needsSignOff, canRule } from '@/types/work-tasks'

interface TaskApprovalBarProps {
  task: Task
  /** The stage the task is sitting in. Null when it has no stage. */
  stage: WorkflowStage | null
  /** The signed-in user, for working out whether they're the one being waited on. */
  currentUserId: string | null
  /** True when the viewer can manage the workspace — the fallback approver. */
  canManage: boolean
  onRule: (payload: RuleOnTaskPayload) => Promise<void>
}

/**
 * The sign-off panel for a task sitting in a gated stage.
 *
 * Shown to everyone, not only the approver: the people waiting need to see
 * *why* the task has stopped and who it's with, otherwise a gated stage just
 * looks like a task nobody is touching. Only the approver gets the buttons.
 */
export default function TaskApprovalBar({ task, stage, currentUserId, canManage, onRule }: TaskApprovalBarProps) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'approved' | 'changes_requested' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // needsSignOff already proves the stage exists and is gated; the explicit
  // null check is what tells the compiler so `stage.name` reads below.
  if (!stage || !needsSignOff(task, stage)) return null

  const mayRule = canRule(stage, currentUserId, canManage)
  const approverName = task.responsible?.name ?? task.responsible?.email ?? null

  const rule = async (decision: 'approved' | 'changes_requested') => {
    setBusy(decision)
    setError(null)
    try {
      await onRule({ decision, note: note.trim() || null })
      setNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t go through. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
      <div className="flex items-start gap-2.5">
        <ShieldCheck size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 break-words">
            Waiting for sign-off in {stage.name}
          </p>
          <p className="text-xs2 text-gray-500 mt-0.5 break-words">
            {mayRule
              ? 'It can’t move on until you approve it or send it back.'
              : approverName
                ? `${approverName} needs to approve it before it moves on.`
                : 'Someone who manages this workspace needs to approve it before it moves on.'}
          </p>
        </div>
      </div>

      {mayRule ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Add a note — what to fix, or what you're happy with…"
            className="w-full text-sm px-3 py-2 rounded-lg border border-amber-200 bg-white outline-none focus:border-amber-400 resize-none"
          />
          {error && <p className="text-xs2 text-red-600">{error}</p>}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => void rule('approved')}
              disabled={busy !== null}
              className="flex-1 min-h-[44px] px-4 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
            >
              <ShieldCheck size={15} />
              {busy === 'approved' ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => void rule('changes_requested')}
              disabled={busy !== null}
              className="flex-1 min-h-[44px] px-4 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
            >
              <Undo2 size={15} />
              {busy === 'changes_requested' ? 'Sending back…' : 'Request changes'}
            </button>
          </div>
          <p className="text-2xs text-gray-400">
            Sending it back returns it to whoever handed it over — the rework lands with the
            person who did the work, not with you.
          </p>
        </div>
      ) : (
        <p className="mt-2.5 flex items-center gap-1.5 text-2xs text-gray-400">
          <Lock size={11} className="flex-shrink-0" /> Locked until it’s reviewed
        </p>
      )}
    </div>
  )
}
