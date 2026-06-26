'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  CheckCircle2, FolderKanban, MessageSquare, ClipboardList,
  ArrowUpRight, AlertCircle, Hash, Circle,
} from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useAllProjects } from '@/hooks/useProjects'
import { useContacts } from '@/hooks/useCrm'
import { useTeam } from '@/hooks/useTeam'
import { useTeamChatRecent } from '@/hooks/useTeamChatRecent'
import { Skeleton } from '@/components/ui/skeleton'
import type { Task, TaskPriority } from '@/types/work-tasks'
import type { Project } from '@/types/project'

interface DashboardWorkProps {
  workspaceId: string | null | undefined
  accent: string
  /** CRM-derived counts the parent already computes, surfaced as KPI tiles. */
  unreadMessages: number
  pendingCount: number
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: '#E24B4A',
  medium: '#EF9F27',
  low: '#9CA3AF',
}

const PROJECT_STATUS: Record<Project['status'], { label: string; bg: string; fg: string }> = {
  active:    { label: 'In progress', bg: '#E1F5EE', fg: '#0F6E56' },
  on_hold:   { label: 'On hold',     bg: '#FAEEDA', fg: '#854F0B' },
  completed: { label: 'Completed',   bg: '#E6F1FB', fg: '#185FA5' },
  archived:  { label: 'Archived',    bg: '#F1EFE8', fg: '#5F5E5A' },
}

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Short due-date label: "Overdue", "Today", "Tomorrow", weekday, or date. */
function dueLabel(due: string): { text: string; overdue: boolean } {
  const today = startOfToday()
  const target = new Date(due)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today) / 86400000)
  if (diffDays < 0) return { text: 'Overdue', overdue: true }
  if (diffDays === 0) return { text: 'Today', overdue: false }
  if (diffDays === 1) return { text: 'Tomorrow', overdue: false }
  if (diffDays < 7) return { text: target.toLocaleDateString('en-US', { weekday: 'short' }), overdue: false }
  return { text: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), overdue: false }
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/**
 * The "work" half of the dashboard — surfaces tasks, projects, conversations and
 * team activity above the client stats so a freelancer sees what needs doing
 * first. All data is scoped to the active workspace.
 */
export default function DashboardWork({ workspaceId, accent, unreadMessages, pendingCount }: DashboardWorkProps) {
  const { tasks, loading: tasksLoading } = useTasks({ scope: 'all', workspaceId, done: false })
  const { projects, loading: projectsLoading } = useAllProjects()
  const { contacts } = useContacts()
  const { members } = useTeam(workspaceId ?? null)
  const { messages: teamMessages, loading: teamLoading } = useTeamChatRecent(workspaceId)

  const today = startOfToday()

  // Open tasks, soonest due first; tasks without a due date sink to the bottom.
  const openTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })
  }, [tasks])

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.due_date && new Date(t.due_date).setHours(0, 0, 0, 0) < today).length,
    [tasks, today],
  )

  const activeProjects = useMemo(() => projects.filter((p) => p.status === 'active'), [projects])

  const contactName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of contacts) m.set(c.id, c.name)
    return m
  }, [contacts])

  const memberName = useMemo(() => {
    const m = new Map<string, string>()
    for (const mem of members) m.set(mem.user_id, mem.name ?? mem.email ?? 'Teammate')
    return m
  }, [members])

  const tiles: { label: string; value: number; badge?: { text: string; color: string }; href: string; icon: typeof CheckCircle2 }[] = [
    {
      label: 'Open tasks', value: tasks.length, href: '/tasks', icon: CheckCircle2,
      ...(overdueCount > 0 ? { badge: { text: `${overdueCount} overdue`, color: '#E24B4A' } } : {}),
    },
    { label: 'Active projects', value: activeProjects.length, href: '/projects', icon: FolderKanban },
    { label: 'Unread messages', value: unreadMessages, href: '/clients', icon: MessageSquare },
    { label: 'Pending review', value: pendingCount, href: '/clients', icon: ClipboardList },
  ]

  return (
    <div className="space-y-4 mb-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <Link
              key={t.label}
              href={t.href}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon size={15} className="text-gray-400" />
                <ArrowUpRight size={14} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-2xs text-gray-400 mb-1">{t.label}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-display text-3xl font-normal text-gray-900 tabular-nums leading-none">{t.value}</span>
                {t.badge && (
                  <span
                    className="text-3xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${t.badge.color}18`, color: t.badge.color }}
                  >
                    {t.badge.text}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Tasks + Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WorkCard title="Your tasks" icon={<CheckCircle2 size={14} className="text-gray-400" />} href="/tasks" accent={accent}>
          {tasksLoading ? (
            <SkeletonRows />
          ) : openTasks.length === 0 ? (
            <Empty icon={<CheckCircle2 size={26} className="text-gray-200" />} text="No open tasks — you're clear" />
          ) : (
            openTasks.slice(0, 5).map((t, i, arr) => <TaskRow key={t.id} task={t} last={i === arr.length - 1} />)
          )}
        </WorkCard>

        <WorkCard title="Active projects" icon={<FolderKanban size={14} className="text-gray-400" />} href="/projects" accent={accent}>
          {projectsLoading ? (
            <SkeletonRows />
          ) : activeProjects.length === 0 ? (
            <Empty icon={<FolderKanban size={26} className="text-gray-200" />} text="No active projects yet" />
          ) : (
            activeProjects.slice(0, 5).map((p, i, arr) => {
              const s = PROJECT_STATUS[p.status] ?? PROJECT_STATUS.active
              const client = p.contact_id ? contactName.get(p.contact_id) : null
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400 truncate">{client ?? 'Personal project'}</p>
                  </div>
                  <span className="text-3xs font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.bg, color: s.fg }}>
                    {s.label}
                  </span>
                </Link>
              )
            })
          )}
        </WorkCard>
      </div>

      {/* Team activity */}
      <WorkCard title="Team activity" icon={<Hash size={14} className="text-gray-400" />} href="/playground" accent={accent}>
        {teamLoading ? (
          <SkeletonRows />
        ) : teamMessages.length === 0 ? (
          <Empty icon={<MessageSquare size={26} className="text-gray-200" />} text="No team messages yet" />
        ) : (
          teamMessages.map((m, i, arr) => (
            <Link
              key={m.id}
              href="/playground"
              className="flex items-start gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-gray-50 transition-colors"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid #F9FAFB' : 'none' }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0" style={{ backgroundColor: accent }}>
                {(memberName.get(m.sender_id) ?? 'T').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {memberName.get(m.sender_id) ?? 'Teammate'}
                    <span className="text-gray-400 font-normal"> · #{m.channel_name}</span>
                  </p>
                  <span className="text-3xs text-gray-400 flex-shrink-0">{timeAgo(m.created_at)}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {m.body.trim() || (m.attachments.length > 0 ? 'Sent an attachment' : '')}
                </p>
              </div>
            </Link>
          ))
        )}
      </WorkCard>
    </div>
  )
}

// ── Internal building blocks ──────────────────────────────────────────────────

function WorkCard({ title, icon, href, accent, children }: { title: string; icon: React.ReactNode; href: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-sm font-semibold text-gray-800">{title}</p>
        </div>
        <Link href={href} className="text-xs font-medium transition-colors hover:opacity-80 flex items-center gap-0.5" style={{ color: accent }}>
          View all <ArrowUpRight size={12} />
        </Link>
      </div>
      <div className="space-y-0">{children}</div>
    </div>
  )
}

function TaskRow({ task, last }: { task: Task; last: boolean }) {
  const due = task.due_date ? dueLabel(task.due_date) : null
  return (
    <Link
      href="/tasks"
      className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-gray-50 transition-colors"
      style={{ borderBottom: last ? 'none' : '1px solid #F9FAFB' }}
    >
      <Circle size={8} strokeWidth={0} fill={PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.low} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
        {(task.project_title || task.contact_name) && (
          <p className="text-xs text-gray-400 truncate">{task.project_title ?? task.contact_name}</p>
        )}
      </div>
      {due && (
        <span className={`text-3xs font-medium flex-shrink-0 flex items-center gap-1 ${due.overdue ? 'text-red-500' : 'text-gray-400'}`}>
          {due.overdue && <AlertCircle size={11} />}
          {due.text}
        </span>
      )}
    </Link>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-40" />
          </div>
        </div>
      ))}
    </>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="mb-3">{icon}</div>
      <p className="text-xs text-gray-400">{text}</p>
    </div>
  )
}
