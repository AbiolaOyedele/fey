'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight, Users, MessageSquare, Paperclip,
  ClipboardList, UserPlus, MoreHorizontal, Eye,
  FileText, FileImage, FileSpreadsheet, File as FileIcon,
} from 'lucide-react'
import DashboardWork from '@/components/dashboard/DashboardWork'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useCrmPending } from '@/hooks/useCrmPending'
import { useDashboardFeed } from '@/hooks/useDashboardFeed'
import { useContacts } from '@/hooks/useCrm'
import { resolveWorkspaceName } from '@/utils/workspace'
import { useGreeting } from '@/hooks/useGreeting'
import { useWorkspace } from '@/hooks/useWorkspace'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Progress bar row ─────────────────────────────────────────────────────────

function ProgressBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((count / max) * 100, count > 0 ? 5 : 0) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-mono font-semibold text-gray-700">{count}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(type: string | null, name: string) {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  const t = type ?? ''
  if (t.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return <FileImage size={15} className="text-violet-400" />
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || t.includes('spreadsheet')) {
    return <FileSpreadsheet size={15} className="text-emerald-400" />
  }
  if (ext === 'pdf' || t.includes('pdf') || ['doc', 'docx', 'txt'].includes(ext)) {
    return <FileText size={15} className="text-rose-400" />
  }
  return <FileIcon size={15} className="text-gray-400" />
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const { workspace, canManage } = useWorkspace()
  // Dashboard data is scoped to the active workspace, so switching workspaces
  // shows only that workspace's clients, messages and files.
  const pending = useCrmPending(workspace?.id)
  const feed = useDashboardFeed(workspace?.id)
  const { contacts, loading: contactsLoading } = useContacts()

  const accent = settings.accent_color ?? '#ED64A6'

  // Greeting uses the signed-in person's first name. For the owner this is the
  // name they set during onboarding (settings.username); for everyone else it
  // falls back to their auth profile name, then their email handle.
  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const firstName = (
    (settings.username as string | undefined)
    || (meta?.full_name as string | undefined)
    || (meta?.name as string | undefined)
    || (user?.email ?? '').split('@')[0]
    || 'there'
  ).trim().split(/\s+/)[0]
  // Workspace name comes from the active workspace; falls back to legacy settings.
  const workspaceName = workspace?.name ?? resolveWorkspaceName(settings.company_name, settings.workspace_slug)
  const greeting = useGreeting(firstName)
  const rawHeading = (settings.dashboard_heading ?? '').replace(/\\n/g, '\n')
  const isCustomHeading = !!rawHeading.trim() && rawHeading !== 'Track your\nwork & earnings'
  const heading = isCustomHeading ? rawHeading : greeting

  const statusCounts = useMemo(() => ({
    active:    contacts.filter((c) => c.status === 'active').length,
    idle:      contacts.filter((c) => c.status === 'idle').length,
    completed: contacts.filter((c) => c.status === 'completed').length,
  }), [contacts])

  const dominantStatus = statusCounts.active >= statusCounts.idle && statusCounts.active >= statusCounts.completed
    ? 'active'
    : statusCounts.idle >= statusCounts.completed
      ? 'idle'
      : 'completed'

  const totalPending = pending.unreadMessages + pending.pendingContracts + pending.pendingForms
  const recentClients = contacts.slice(0, 4)
  const portalUrl = settings.workspace_slug ? `${settings.workspace_slug}.theruff.agency` : null

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 page-enter">

      <Stagger>
      <StaggerItem>
      {/* ── Header ── */}
      <div className="mb-6 lg:mb-8">
        {workspaceName && (
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: accent }}>
            {workspaceName}
          </p>
        )}
        <h1 className="font-display text-xl leading-snug font-normal text-gray-700" style={{ whiteSpace: 'pre-wrap' }}>
          {heading}
        </h1>
      </div>

      </StaggerItem>
      <StaggerItem>
      {/* ── Work: tasks, projects, conversations (the headline) ── */}
      <DashboardWork
        workspaceId={workspace?.id}
        accent={accent}
        unreadMessages={feed.loaded ? feed.unread.length : pending.unreadMessages}
        pendingCount={totalPending}
      />
      </StaggerItem>
      <StaggerItem>
      {/* ── Workspace overview ── */}
      <div className="mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between min-h-[220px]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(['All', 'Active', 'Idle', 'Completed'] as const).map((s) => (
                <span
                  key={s}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500"
                >
                  {s}
                </span>
              ))}
            </div>
            {portalUrl && (
              <span className="text-2xs text-gray-400 font-mono flex-shrink-0 truncate max-w-[160px]">
                {portalUrl}
              </span>
            )}
          </div>

          <div className="my-5">
            <p className="text-xs text-gray-400 mb-1">Total Clients</p>
            <div className="flex items-center gap-3">
              {pending.loaded ? (
                <p className="font-display text-5xl font-normal text-gray-900 tabular-nums leading-none">
                  {pending.contactCount}
                </p>
              ) : (
                <Skeleton className="h-12 w-16" />
              )}
              <Eye size={16} className="text-gray-300 mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {canManage && (
              <Link
                href="/clients?new=1"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity flex-shrink-0"
                style={{ backgroundColor: accent }}
              >
                <UserPlus size={14} /> Add Client
              </Link>
            )}
            <Link
              href="/clients"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              View all clients
            </Link>
            <div className="flex-1" />
            <Link
              href="/clients"
              className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md hover:opacity-90 transition-opacity flex-shrink-0"
              style={{ backgroundColor: accent }}
            >
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </div>

      </StaggerItem>
      <StaggerItem>
      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Client status donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-800">Client Status</p>
            </div>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
              {new Date().toLocaleString('en-US', { month: 'long' })}
            </span>
          </div>

          <div className="py-1">
            {contactsLoading ? (
              <Skeleton className="h-10 w-16" />
            ) : (
              <>
                <p className="font-display text-4xl font-normal text-gray-900 tabular-nums leading-none">{contacts.length}</p>
                <p className="text-xs text-gray-400 mt-1.5">total clients</p>
              </>
            )}
          </div>

          {/* Stacked proportion bar */}
          {contacts.length > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden my-4 bg-gray-100">
              {[
                { count: statusCounts.active,    color: accent },
                { count: statusCounts.idle,      color: '#9CA3AF' },
                { count: statusCounts.completed, color: '#48BB78' },
              ].filter((s) => s.count > 0).map((s, i) => (
                <div key={i} style={{ width: `${(s.count / contacts.length) * 100}%`, backgroundColor: s.color }} />
              ))}
            </div>
          )}

          {contacts.length > 0 && (
            <p className="text-2xs text-gray-400 my-3">
              ✦ Most clients are{' '}
              <span className="font-medium" style={{ color: dominantStatus === 'active' ? accent : dominantStatus === 'completed' ? '#48BB78' : '#9CA3AF' }}>
                {dominantStatus}
              </span>
            </p>
          )}

          <div className="space-y-2 mt-2">
            {[
              { label: 'Active',    count: statusCounts.active,    color: accent },
              { label: 'Idle',      count: statusCounts.idle,      color: '#9CA3AF' },
              { label: 'Completed', count: statusCounts.completed, color: '#48BB78' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                  {s.label}
                </span>
                <span className="text-xs font-semibold text-gray-700 tabular-nums">
                  {contactsLoading ? '…' : s.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending work */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ClipboardList size={14} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-800">Pending</p>
            </div>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              {totalPending} items
            </span>
          </div>

          <div className="my-5">
            {pending.loaded ? (
              <p className="font-display text-4xl font-normal text-gray-900 tabular-nums leading-none">{totalPending}</p>
            ) : (
              <Skeleton className="h-10 w-12" />
            )}
            <p className="text-xs text-gray-400 mt-1.5">items needing your review</p>
          </div>

          <div className="space-y-4">
            <ProgressBar
              label="Unread messages"
              count={pending.unreadMessages}
              max={Math.max(totalPending, 1)}
              color={accent}
            />
            <ProgressBar
              label="Pending contracts"
              count={pending.pendingContracts}
              max={Math.max(totalPending, 1)}
              color="#F6AD55"
            />
            <ProgressBar
              label="Pending forms"
              count={pending.pendingForms}
              max={Math.max(totalPending, 1)}
              color="#48BB78"
            />
            <ProgressBar
              label="Active clients"
              count={statusCounts.active}
              max={Math.max(pending.contactCount, 1)}
              color="#9CA3AF"
            />
          </div>
        </div>

        {/* Recent clients */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-800">Recent Clients</p>
            </div>
            <MoreHorizontal size={16} className="text-gray-300" />
          </div>

          <div className="space-y-0">
            {contactsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                  <Skeleton className="h-3 w-10" />
                </div>
              ))
            ) : recentClients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Users size={28} className="text-gray-200 mb-3" />
                <p className="text-xs text-gray-400 mb-4">No clients yet</p>
                {canManage && (
                  <Link
                    href="/clients?new=1"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: accent }}
                  >
                    <UserPlus size={12} /> Add first client
                  </Link>
                )}
              </div>
            ) : (
              recentClients.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}/messages`}
                  className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: i < recentClients.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                >
                  {c.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.avatar_url} alt={c.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                      style={{ backgroundColor: accent }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.email ?? c.company ?? 'No contact info'}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-3xs text-gray-400">{relativeTime(c.created_at)}</span>
                    <span
                      className="text-3xs font-medium px-1.5 py-0.5 rounded-full"
                      style={
                        c.status === 'active'
                          ? { backgroundColor: `${accent}18`, color: accent }
                          : c.status === 'completed'
                            ? { backgroundColor: '#ECFDF5', color: '#059669' }
                            : { backgroundColor: '#F3F4F6', color: '#9CA3AF' }
                      }
                    >
                      {c.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          {contacts.length > 4 && (
            <Link
              href="/clients"
              className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-gray-50 text-xs font-medium transition-colors hover:opacity-80"
              style={{ color: accent }}
            >
              View all clients <ArrowUpRight size={12} />
            </Link>
          )}
        </div>
      </div>

      {/* ── Messages + Files row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">

        {/* Unread messages */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-800">Unread Messages</p>
              {feed.loaded && feed.unread.length > 0 && (
                <span
                  className="text-3xs font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: accent }}
                >
                  {feed.unread.length}
                </span>
              )}
            </div>
            <Link href="/clients" className="text-gray-300 hover:text-gray-500 transition-colors">
              <MoreHorizontal size={16} />
            </Link>
          </div>

          <div className="space-y-0">
            {!feed.loaded ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-44" />
                  </div>
                </div>
              ))
            ) : feed.unread.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <MessageSquare size={28} className="text-gray-200 mb-3" />
                <p className="text-xs text-gray-400">You&apos;re all caught up — no unread messages</p>
              </div>
            ) : (
              feed.unread.map((m, i) => (
                <Link
                  key={m.id}
                  href={`/clients/${m.contactId}/messages`}
                  className="flex items-start gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: i < feed.unread.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 relative"
                    style={{ backgroundColor: accent }}
                  >
                    {m.contactName.charAt(0).toUpperCase()}
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800 truncate">{m.contactName}</p>
                      <span className="text-3xs text-gray-400 flex-shrink-0">{relativeTime(m.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                      {m.hasAttachment && <Paperclip size={11} className="text-gray-400 flex-shrink-0" />}
                      {m.body.trim() || (m.hasAttachment ? 'Sent an attachment' : '')}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent files */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Paperclip size={14} className="text-gray-400" />
              <p className="text-sm font-semibold text-gray-800">Recent Files</p>
            </div>
            <Link href="/clients" className="text-gray-300 hover:text-gray-500 transition-colors">
              <MoreHorizontal size={16} />
            </Link>
          </div>

          <div className="space-y-0">
            {!feed.loaded ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
              ))
            ) : feed.files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <FileIcon size={28} className="text-gray-200 mb-3" />
                <p className="text-xs text-gray-400">No files shared yet</p>
              </div>
            ) : (
              feed.files.map((f, i) => (
                <Link
                  key={f.id}
                  href={`/clients/${f.contactId}/files`}
                  className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: i < feed.files.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    {fileIcon(f.fileType, f.fileName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{f.fileName}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {f.contactName}
                      {f.uploaderType === 'client' ? ' · uploaded' : ' · sent'}
                      {formatFileSize(f.fileSize) && ` · ${formatFileSize(f.fileSize)}`}
                    </p>
                  </div>

                  <span className="text-3xs text-gray-400 flex-shrink-0">{relativeTime(f.createdAt)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
      </StaggerItem>
      </Stagger>
    </div>
  )
}
