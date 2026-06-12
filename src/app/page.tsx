'use client'

import Link from 'next/link'
import { ArrowRight, MessageSquare, FileText, ClipboardList, UserPlus, Settings, Users } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useCrmPending } from '@/hooks/useCrmPending'
import { useContacts } from '@/hooks/useCrm'
import { resolveWorkspaceName } from '@/utils/workspace'
import { useGreeting } from '@/hooks/useGreeting'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import type { ContactStatus } from '@/types/crm'

function statusVariant(status: ContactStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'active') return 'default'
  if (status === 'completed') return 'outline'
  return 'secondary'
}

function statusLabel(status: ContactStatus): string {
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  return 'Idle'
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

const STAT_SKELETON = (
  <Card className="shadow-sm border-gray-100">
    <CardHeader className="pb-2">
      <Skeleton className="h-3 w-24" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-12 mb-1" />
      <Skeleton className="h-3 w-32" />
    </CardContent>
  </Card>
)

export default function DashboardPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const pending = useCrmPending(user?.id)
  const { contacts, loading: contactsLoading } = useContacts()

  const workspaceName = resolveWorkspaceName(settings.company_name, settings.workspace_slug)
  const greeting = useGreeting(workspaceName)
  const rawHeading = (settings.dashboard_heading ?? '').replace(/\\n/g, '\n')
  const isCustomHeading = !!rawHeading.trim() && rawHeading !== 'Track your\nwork & earnings'
  const heading = isCustomHeading ? rawHeading : greeting

  const recentClients = contacts.slice(0, 5)
  const hasAttention = (pending.unreadMessages + pending.pendingContracts + pending.pendingForms) > 0

  const stats = [
    {
      label: 'Total clients',
      value: pending.loaded ? pending.contactCount : null,
      icon: <Users size={14} className="text-gray-400" />,
      href: '/clients',
    },
    {
      label: 'Unread messages',
      value: pending.loaded ? pending.unreadMessages : null,
      icon: <MessageSquare size={14} className="text-gray-400" />,
      href: '/clients',
    },
    {
      label: 'Pending contracts',
      value: pending.loaded ? pending.pendingContracts : null,
      icon: <FileText size={14} className="text-gray-400" />,
      href: '/clients',
    },
    {
      label: 'Pending forms',
      value: pending.loaded ? pending.pendingForms : null,
      icon: <ClipboardList size={14} className="text-gray-400" />,
      href: '/clients',
    },
  ]

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 page-enter">
      {/* Hero heading */}
      <div className="flex items-start justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1
            className="font-display text-[20px] leading-snug font-normal text-gray-700"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {heading}
          </h1>
          {settings.dashboard_subtitle && (
            <p className="text-gray-500 text-sm mt-2">{settings.dashboard_subtitle}</p>
          )}
        </div>
        <Link
          href="/settings"
          className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors flex-shrink-0"
        >
          <Settings size={16} />
        </Link>
      </div>

      {/* Getting started — shown only when workspace has no clients yet */}
      {pending.loaded && pending.contactCount === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Welcome to your workspace 👋</h2>
          <p className="text-sm text-gray-500 mt-1.5 mb-5 max-w-lg leading-relaxed">
            This is your home base. Add your first client to start sending them messages,
            files, contracts, forms and invoices through their portal — or set up your
            workspace branding first.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/clients?new=1"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              <UserPlus size={15} /> Add your first client
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Settings size={15} /> Set up workspace
            </Link>
          </div>
        </div>
      )}

      {/* Stats grid — 4 columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        {pending.loaded
          ? stats.map((s) => (
              <Link key={s.label} href={s.href} className="block group">
                <Card className="shadow-sm border-gray-100 transition-shadow group-hover:shadow-md">
                  <CardHeader className="pb-1">
                    <CardTitle className="flex items-center gap-1.5 font-normal text-muted-foreground text-xs">
                      {s.icon}
                      {s.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-semibold text-2xl tabular-nums text-gray-900">
                      {s.value ?? 0}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))
          : Array.from({ length: 4 }).map((_, i) => <div key={i}>{STAT_SKELETON}</div>)
        }
      </div>

      {/* Needs attention (inline highlight when there are pending items) */}
      {hasAttention && (
        <div
          className="rounded-2xl border mb-4 p-4 flex items-center justify-between gap-4"
          style={{ backgroundColor: `var(--accent, #ED64A6)18`, borderColor: `var(--accent, #ED64A6)30` }}
        >
          <p className="text-sm font-medium text-gray-800">
            You have {pending.unreadMessages > 0 ? `${pending.unreadMessages} unread message${pending.unreadMessages !== 1 ? 's' : ''}` : ''}
            {pending.unreadMessages > 0 && (pending.pendingContracts > 0 || pending.pendingForms > 0) ? ', ' : ''}
            {pending.pendingContracts > 0 ? `${pending.pendingContracts} pending contract${pending.pendingContracts !== 1 ? 's' : ''}` : ''}
            {pending.pendingContracts > 0 && pending.pendingForms > 0 ? ', ' : ''}
            {pending.pendingForms > 0 ? `${pending.pendingForms} pending form${pending.pendingForms !== 1 ? 's' : ''}` : ''}
            {' '}that need your attention.
          </p>
          <Link
            href="/clients"
            className="flex-shrink-0 flex items-center gap-1 text-sm font-semibold hover:gap-2 transition-all"
            style={{ color: 'var(--accent, #ED64A6)' }}
          >
            Review <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Recent clients table */}
      {(contactsLoading || contacts.length > 0) && (
        <Card className="shadow-sm border-gray-100">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-gray-900">Recent clients</CardTitle>
                <CardDescription className="text-xs text-gray-400 mt-0.5">Your latest 5 clients</CardDescription>
              </div>
              <Link
                href="/clients"
                className="flex items-center gap-1 text-xs font-medium hover:gap-2 transition-all"
                style={{ color: 'var(--accent, #ED64A6)' }}
              >
                View all <ArrowRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {contactsLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-gray-100">
                    <TableHead className="pl-6 text-xs">Client</TableHead>
                    <TableHead className="hidden sm:table-cell text-xs">Company</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="hidden md:table-cell text-xs">Portal</TableHead>
                    <TableHead className="pr-6 text-right text-xs">Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentClients.map((c) => (
                    <TableRow
                      key={c.id}
                      className="h-14 hover:bg-gray-50/50 border-gray-50 cursor-pointer"
                      onClick={() => window.location.assign(`/clients/${c.id}/messages`)}
                    >
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2.5">
                          {c.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.avatar_url} alt={c.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-sm text-gray-900 truncate max-w-[120px]">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {c.company ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariant(c.status)}
                          className="text-xs capitalize"
                          style={c.status === 'active' ? { backgroundColor: 'var(--accent, #ED64A6)', color: 'white', borderColor: 'transparent' } : {}}
                        >
                          {statusLabel(c.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={c.portal_enabled ? 'secondary' : 'outline'} className="text-xs">
                          {c.portal_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                        {relativeTime(c.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
