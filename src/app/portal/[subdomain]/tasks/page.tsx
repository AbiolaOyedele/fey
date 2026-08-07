'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckSquare2, Plus, Search } from 'lucide-react'
import { portalTokenKey } from '@/hooks/usePortalAuth'
import { usePortalAccent } from '@/hooks/usePortalBranding'
import { usePortalSession } from '@/contexts/PortalSessionContext'
import { usePortalTasks } from '@/hooks/usePortalTasks'
import { FadeIn } from '@/components/ui/motion'
import PortalTaskInsights from '@/components/portal/PortalTaskInsights'
import { TaskRowsSkeleton } from '@/components/ui/skeletons'
import TaskListView from '@/components/tasks/TaskListView'
import TaskDetailDrawer from '@/components/tasks/TaskDetailDrawer'
import NewTaskModal from '@/components/tasks/NewTaskModal'
import type { Task } from '@/types/work-tasks'
import type { ClientTeamMember } from '@/types/crm'

/**
 * The client's tasks — the app's task section, in the portal.
 *
 * Built on the app's own `TaskListView`, `TaskDetailDrawer` and `NewTaskModal`
 * rather than portal-specific copies, so a client gets the same descriptions,
 * subtasks and attachments the team has and the two sides can't drift apart.
 *
 * The only difference is scope: a client may edit tasks they raised themselves
 * and read everything else. That rule is enforced in the API, not here — this
 * only hides controls that would fail.
 */
type Tab = 'open' | 'done' | 'progress'

export default function PortalTasksPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params)
  const accent  = usePortalAccent(subdomain)
  const session = usePortalSession()
  // A notification names one task, so it links to that task — ?taskId=<id>.
  const deepLinkTaskId = useSearchParams().get('taskId')
  // Viewers are read-only by definition, so they never see the compose button.
  const canWrite = session ? session.session.portalUser.role !== 'viewer' : false

  const t = usePortalTasks(subdomain)

  const [team, setTeam]         = useState<ClientTeamMember[]>([])
  const [tab, setTab]           = useState<Tab>('open')
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Task | null>(null)
  const [showNew, setShowNew]   = useState(false)

  // Who this client may assign to — granted per client by the owner, so it's
  // never the whole roster.
  const loadTeam = useCallback(async () => {
    const token = localStorage.getItem(portalTokenKey(subdomain))
    if (!token) return
    try {
      const res = await fetch('/api/v1/portal/team', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const d = await res.json() as { members: ClientTeamMember[] }
      setTeam(d.members)
    } catch { /* assigning is optional — the task still reaches the team */ }
  }, [subdomain])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTeam()
  }, [loadTeam])

  // Opens the linked task once the list has loaded. A ref (not state) records
  // that it's been consumed, so closing the drawer doesn't reopen it on the next
  // refetch. A completed task is found here too — the tab still says "Open", but
  // the task the client was told about is the one that opens.
  const consumedDeepLink = useRef<string | null>(null)
  useEffect(() => {
    if (!deepLinkTaskId || deepLinkTaskId === consumedDeepLink.current || t.loading) return
    const found = t.tasks.find((x) => x.id === deepLinkTaskId)
    if (!found) return
    consumedDeepLink.current = deepLinkTaskId
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(found)
    if (found.done) setTab('done')
  }, [deepLinkTaskId, t.loading, t.tasks])

  const pickableMembers = useMemo(
    () => team.map((m) => ({ user_id: m.user_id, name: m.name, email: null })),
    [team],
  )

  const openCount = t.tasks.filter((x) => !x.done).length
  const doneCount = t.tasks.length - openCount

  const visible = useMemo(() => {
    let list = t.tasks.filter((x) => (tab === 'done' ? x.done : !x.done))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((x) => x.title.toLowerCase().includes(q))
    }
    return list
  }, [t.tasks, tab, search])

  // Keep the open drawer's task in step with the latest data.
  const liveSelected = selected ? (t.tasks.find((x) => x.id === selected.id) ?? selected) : null

  // Progress only appears when the owner has switched it on for this client —
  // resolved with the session, so there's no tab that opens onto a refusal.
  const showProgress = session?.session.insightsEnabled === true
  const tabs = useMemo(() => {
    const list: Array<[Tab, string]> = [
      ['open', `Open${openCount ? ` · ${openCount}` : ''}`],
      ['done', `Done${doneCount ? ` · ${doneCount}` : ''}`],
    ]
    if (showProgress) list.push(['progress', 'Progress'])
    return list
  }, [openCount, doneCount, showProgress])

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter">
      <FadeIn>
        <div className="flex items-center gap-2 mb-1">
          <CheckSquare2 size={18} style={{ color: accent }} />
          <h1 className="font-display text-xl font-normal text-gray-800">Tasks</h1>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          What&apos;s in progress, and anything you&apos;d like the team to pick up.
        </p>
      </FadeIn>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2 min-h-[36px] rounded-md text-xs font-medium transition-colors ${
                tab === key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab !== 'progress' && (
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              className="w-full pl-8 pr-3 py-2 min-h-[40px] rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
            />
          </div>
        )}

        {canWrite && (
          <button
            onClick={() => setShowNew(true)}
            className="press flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] text-white rounded-full text-sm font-semibold hover:opacity-90 ml-auto"
            style={{ backgroundColor: accent }}
          >
            <Plus size={15} /> New task
          </button>
        )}
      </div>

      {tab === 'progress' ? (
        <PortalTaskInsights subdomain={subdomain} />
      ) : t.loading ? (
        <TaskRowsSkeleton />
      ) : t.error ? (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-sm text-gray-500 mb-3">{t.error}</p>
          <button onClick={() => void t.refetch()} className="text-sm font-semibold" style={{ color: accent }}>
            Try again
          </button>
        </div>
      ) : (
        <TaskListView
          tasks={visible}
          grouped={false}
          onToggleDone={(id) => void t.toggleDone(id)}
          onOpen={setSelected}
        />
      )}

      {liveSelected && (
        <TaskDetailDrawer
          task={liveSelected}
          workspaceId={null}
          stages={t.stages}
          members={pickableMembers}
          hideComments
          // A client may withdraw work they raised; agency-created tasks aren't
          // theirs to remove, so the control simply isn't there for those.
          hideDelete={!canWrite || !liveSelected.requested_by_portal_user}
          // Review runs against the portal endpoints, and viewers read it
          // without being able to upload or rule on anything.
          portalSubdomain={subdomain}
          reviewReadOnly={!canWrite}
          onPatch={t.patchTask}
          onSetAssignees={t.setAssignees}
          onAddSubtask={t.addSubtask}
          onToggleSubtask={t.toggleSubtask}
          onRenameSubtask={t.renameSubtask}
          onDeleteSubtask={t.deleteSubtask}
          onAddFile={t.addFile}
          onRemoveFile={t.removeFile}
          onToggleDone={(id) => { void t.toggleDone(id); setSelected(null) }}
          onDelete={async (id) => { await t.deleteTask(id); setSelected(null) }}
          onClose={() => setSelected(null)}
        />
      )}

      {showNew && (
        <NewTaskModal
          workspaceId={null}
          stages={t.stages}
          members={pickableMembers}
          hideLinks
          onCreate={async (payload) => {
            const task = await t.createTask(payload as unknown as Record<string, unknown>)
            // Open it straight away so details, steps and files can be added in
            // one flow — same as the app.
            setSelected(task)
            return task
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  )
}
