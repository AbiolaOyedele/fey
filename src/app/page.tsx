'use client'

import Link from 'next/link'
import {
  MessageSquare, Paperclip, MoreHorizontal,
  FileText, FileImage, FileSpreadsheet, File as FileIcon,
} from 'lucide-react'
import DashboardWork from '@/components/dashboard/DashboardWork'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import WorkspaceSwitcher from '@/components/layout/WorkspaceSwitcher'
import { Stagger, StaggerItem } from '@/components/ui/motion'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useCrmPending } from '@/hooks/useCrmPending'
import { useDashboardFeed } from '@/hooks/useDashboardFeed'
import { resolveWorkspaceName } from '@/utils/workspace'
import { useGreeting } from '@/hooks/useGreeting'
import { useWorkspace } from '@/hooks/useWorkspace'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const { workspace } = useWorkspace()
  // Dashboard data is scoped to the active workspace.
  const pending = useCrmPending(workspace?.id)
  const feed = useDashboardFeed(workspace?.id)

  const accent = settings.accent_color ?? '#ED64A6'

  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const firstName = (
    (settings.username as string | undefined)
    || (meta?.full_name as string | undefined)
    || (meta?.name as string | undefined)
    || (user?.email ?? '').split('@')[0]
    || 'there'
  ).trim().split(/\s+/)[0]
  const workspaceName = workspace?.name ?? resolveWorkspaceName(settings.company_name, settings.workspace_slug)
  const greeting = useGreeting(firstName)
  const rawHeading = (settings.dashboard_heading ?? '').replace(/\\n/g, '\n')
  const isCustomHeading = !!rawHeading.trim() && rawHeading !== 'Track your\nwork & earnings'
  const heading = isCustomHeading ? rawHeading : greeting

  const totalPending = pending.unreadMessages + pending.pendingContracts + pending.pendingForms
  const unreadMessages = feed.loaded ? feed.unread.length : pending.unreadMessages

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 page-enter">
      <Stagger>
        {/* ── Header ── */}
        <StaggerItem>
          <div className="mb-6 lg:mb-8 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {workspaceName && (
                <p className="text-xs font-medium uppercase tracking-wide mb-1 truncate" style={{ color: accent }}>
                  {workspaceName}
                </p>
              )}
              <h1 className="font-display text-xl leading-snug font-normal text-gray-700" style={{ whiteSpace: 'pre-wrap' }}>
                {heading}
              </h1>
            </div>
            <div className="flex-shrink-0 pt-0.5">
              <WorkspaceSwitcher accent={accent} variant="compact" placement="bottom" />
            </div>
          </div>
        </StaggerItem>

        {/* ── Work overview (the headline) ── */}
        <StaggerItem>
          <ErrorBoundary label="DashboardWork" fallbackTitle="Couldn’t load your work overview">
            <DashboardWork
              workspaceId={workspace?.id}
              accent={accent}
              unreadMessages={unreadMessages}
              pendingCount={totalPending}
            />
          </ErrorBoundary>
        </StaggerItem>

        {/* ── Client messages + files ── */}
        <StaggerItem>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Unread client messages */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-gray-400" />
                  <p className="text-sm font-semibold text-gray-800">Client messages</p>
                  {feed.loaded && feed.unread.length > 0 && (
                    <span className="text-3xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: accent }}>
                      {feed.unread.length}
                    </span>
                  )}
                </div>
                <Link href="/clients" className="text-gray-300 hover:text-gray-500 transition-colors"><MoreHorizontal size={16} /></Link>
              </div>

              <div className="space-y-0">
                {!feed.loaded ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-28" /><Skeleton className="h-2.5 w-44" /></div>
                    </div>
                  ))
                ) : feed.unread.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <MessageSquare size={28} className="text-gray-200 mb-3" />
                    <p className="text-xs text-gray-400">You&apos;re all caught up — no unread messages</p>
                  </div>
                ) : (
                  feed.unread.map((m, i, arr) => (
                    <Link
                      key={m.id}
                      href={`/clients/${m.contactId}/messages`}
                      className="flex items-start gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-gray-50 transition-colors"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0 relative" style={{ backgroundColor: accent }}>
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
                  <p className="text-sm font-semibold text-gray-800">Recent files</p>
                </div>
                <Link href="/clients" className="text-gray-300 hover:text-gray-500 transition-colors"><MoreHorizontal size={16} /></Link>
              </div>

              <div className="space-y-0">
                {!feed.loaded ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-32" /><Skeleton className="h-2.5 w-24" /></div>
                    </div>
                  ))
                ) : feed.files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <FileIcon size={28} className="text-gray-200 mb-3" />
                    <p className="text-xs text-gray-400">No files shared yet</p>
                  </div>
                ) : (
                  feed.files.map((f, i, arr) => (
                    <Link
                      key={f.id}
                      href={`/clients/${f.contactId}/files`}
                      className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-xl hover:bg-gray-50 transition-colors"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid #F9FAFB' : 'none' }}
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
