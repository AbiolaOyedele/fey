'use client'

import { Trash2, ArchiveRestore, Loader2, FolderKanban, CheckSquare, Users } from 'lucide-react'
import { useTrash, type TrashKind } from '@/hooks/useTrash'
import { useConfirm } from '@/contexts/ConfirmContext'

const KIND_META: Record<TrashKind, { label: string; icon: typeof FolderKanban }> = {
  project: { label: 'Brand', icon: FolderKanban },
  task:    { label: 'Task',    icon: CheckSquare },
  client:  { label: 'Client',  icon: Users },
}

function deletedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Deleted today'
  if (days === 1) return 'Deleted yesterday'
  return `Deleted ${days}d ago`
}

export default function TrashPage() {
  const { entries, loading, error, restore, purge } = useTrash()
  const confirm = useConfirm()

  const onPurge = async (kind: TrashKind, id: string, title: string) => {
    const ok = await confirm({
      title: 'Delete forever?',
      message: `“${title}” will be permanently removed. This can’t be undone.`,
      confirmLabel: 'Delete forever',
    })
    if (ok) await purge(kind, id)
  }

  return (
    <div className="p-4 lg:p-8 page-enter max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Trash2 size={18} className="text-gray-400" />
        <h1 className="font-display text-2xl font-semibold text-gray-900">Recycle bin</h1>
      </div>
      <p className="text-xs2 text-gray-400 mb-6">Deleted projects, tasks and clients. Restore them, or remove them for good.</p>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : error ? (
        <p className="text-sm text-gray-500 py-10 text-center">{error}</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Trash2 size={30} strokeWidth={1.5} className="text-gray-200 mb-3" />
          <p className="text-sm2 font-medium text-gray-500">The recycle bin is empty</p>
          <p className="text-xs2 text-gray-400 mt-0.5">Deleted items show up here so you can recover them.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const Icon = KIND_META[e.kind].icon
            return (
              <div key={`${e.kind}-${e.id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{e.title}</p>
                  <p className="text-2xs text-gray-400">{KIND_META[e.kind].label} · {deletedAgo(e.deletedAt)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => void restore(e.kind, e.id)}
                    className="inline-flex items-center gap-1.5 text-2xs font-semibold px-3 py-2 rounded-full text-white hover:opacity-90"
                    style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                  >
                    <ArchiveRestore size={13} /> Restore
                  </button>
                  <button
                    onClick={() => void onPurge(e.kind, e.id, e.title)}
                    title="Delete forever"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
