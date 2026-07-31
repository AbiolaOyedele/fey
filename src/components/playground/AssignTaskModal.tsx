'use client'

import { useState } from 'react'
import { X, ListTodo, Loader2 } from 'lucide-react'
import AssigneePicker from '@/components/tasks/AssigneePicker'

interface AssignTaskModalProps {
  postTitle: string
  workspaceId: string | null | undefined
  accent: string
  onConfirm: (assigneeIds: string[]) => Promise<void>
  onClose: () => void
}

/**
 * Confirms turning a post into a task and asks who it belongs to. Shown above
 * the post editor, so it gets its own z layer.
 */
export default function AssignTaskModal({ postTitle, workspaceId, accent, onConfirm, onClose }: AssignTaskModalProps) {
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const confirm = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onConfirm(assigneeIds)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/30 p-4 animate-fadeIn" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl p-5 w-full md:max-w-sm shadow-xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg text-gray-800 flex items-center gap-2">
            <ListTodo size={16} style={{ color: accent }} /> Make it a task
          </h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          “{postTitle}” will appear on the Tasks page, due on its scheduled day.
        </p>

        <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Assign to</p>
        <div className="mb-5">
          <AssigneePicker workspaceId={workspaceId} selectedIds={assigneeIds} onChange={setAssigneeIds} />
        </div>

        <button
          onClick={() => void confirm()}
          disabled={submitting}
          className="w-full h-10 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {assigneeIds.length > 0 ? 'Create & assign task' : 'Create task'}
        </button>
      </div>
    </div>
  )
}
