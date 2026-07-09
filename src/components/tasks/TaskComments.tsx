'use client'

import { useState, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTeam } from '@/hooks/useTeam'
import { useTaskComments } from '@/hooks/useTaskComments'
import { useConfirm } from '@/contexts/ConfirmContext'
import { renderMentions } from '@/utils/mentions'
import MentionAwareEditor from '@/components/mentions/MentionAwareEditor'
import type { MentionAwareEditorHandle } from '@/components/mentions/MentionAwareEditor'

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return sameDay ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`
}

interface TaskCommentsProps {
  taskId: string
  workspaceId: string | null | undefined
  taskLink: string
  taskTitle: string
}

export default function TaskComments({ taskId, workspaceId, taskLink, taskTitle }: TaskCommentsProps) {
  const { user } = useAuth()
  const { members } = useTeam(workspaceId ?? null)
  const { comments, loading, sending, addComment, editComment, deleteComment } = useTaskComments(taskId, workspaceId, taskLink, taskTitle)
  const confirm = useConfirm()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [composerKey, setComposerKey] = useState(0)

  const nameById = new Map(members.map((m) => [m.user_id, m.name || m.email || 'Teammate']))

  const submit = useCallback(async (handle: MentionAwareEditorHandle | null) => {
    if (!handle) return
    const value = handle.getValue()
    if (!value.trim()) return
    handle.clear()
    setComposerKey((k) => k + 1)
    await addComment(value)
  }, [addComment])

  return (
    <div>
      <p className="text-xs2 font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
        Comments {comments.length > 0 && <span className="text-gray-300">· {comments.length}</span>}
      </p>

      <div className="space-y-3 mb-3">
        {loading ? (
          <p className="text-sm text-gray-400">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-400">No comments yet. @mention a teammate to loop them in.</p>
        ) : (
          comments.map((c) => {
            const isMine = c.author_id === user?.id
            const authorName = isMine ? 'You' : (nameById.get(c.author_id) ?? 'Teammate')
            return (
              <div key={c.id} className="group animate-slideUp">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs2 font-semibold text-gray-700">{authorName}</span>
                  <span className="text-xs2 text-gray-300">{timeLabel(c.created_at)}{c.edited_at && ' · edited'}</span>
                  {isMine && (
                    <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100">
                      <button onClick={() => setEditingId(c.id)} className="text-xs2 text-gray-400 hover:text-gray-600">Edit</button>
                      <button
                        onClick={async () => {
                          const ok = await confirm({ title: 'Delete this comment?', confirmLabel: 'Delete' })
                          if (ok) void deleteComment(c.id)
                        }}
                        className="text-gray-300 hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
                {editingId === c.id ? (
                  <MentionAwareEditor
                    initialValue={c.body}
                    workspaceId={workspaceId}
                    multiline
                    autoFocus
                    className="w-full text-sm px-2.5 py-2 rounded-lg border border-gray-200 focus:border-gray-400"
                    onCommit={(value) => {
                      setEditingId(null)
                      const trimmed = value.trim()
                      if (trimmed && trimmed !== c.body) void editComment(c.id, trimmed)
                    }}
                    onEscape={() => setEditingId(null)}
                  />
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{renderMentions(c.body)}</p>
                )}
              </div>
            )
          })
        )}
      </div>

      <Composer key={composerKey} workspaceId={workspaceId} sending={sending} onSubmit={submit} />
    </div>
  )
}

function Composer({
  workspaceId, sending, onSubmit,
}: {
  workspaceId: string | null | undefined
  sending: boolean
  onSubmit: (handle: MentionAwareEditorHandle | null) => void
}) {
  const [handle, setHandle] = useState<MentionAwareEditorHandle | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <MentionAwareEditor
          ref={setHandle}
          initialValue=""
          workspaceId={workspaceId}
          multiline
          placeholder="Add a comment… use @ to mention someone"
          className="w-full min-h-[2.5rem] text-sm px-2.5 py-2 rounded-lg border border-gray-200 focus:border-gray-400"
          onEmptyChange={setIsEmpty}
          onCommit={() => {}}
        />
      </div>
      <button
        type="button"
        disabled={isEmpty || sending}
        onClick={() => onSubmit(handle)}
        className="press px-3 py-2 rounded-lg text-xs2 font-semibold text-white disabled:opacity-40"
        style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
      >
        Post
      </button>
    </div>
  )
}
