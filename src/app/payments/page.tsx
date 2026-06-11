'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, TrendingUp, Clock } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { useAuth } from '@/contexts/AuthContext'
import { useSupabaseData } from '@/hooks/useSupabaseData'
import { getContrastColor } from '@/utils/colorContrast'
import type { Client, Task } from '@/types'

interface ClientBreakdown {
  id: string | null
  name: string
  color: string
  earned: number
  pending: number
  retainer: number
  tasks: Task[]
  isDeleted: boolean
}

interface MonthData {
  earned: number
  pending: number
  clients: Record<string, ClientBreakdown>
}

export default function PaymentsPage() {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const { formatMoney, convertAmount, trash, resolveColor } = useSettings()
  const { user } = useAuth()
  const { clients } = useSupabaseData(user?.id)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Build monthly breakdown from active clients
  const monthlyData: Record<string, MonthData> = {}

  clients.forEach((client: Client) => {
    client.tasks.forEach((task) => {
      const month = task.createdAt.slice(0, 7)
      if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} }
      if (!monthlyData[month].clients[client.id]) {
        monthlyData[month].clients[client.id] = {
          id: client.id,
          name: client.name,
          color: client.color,
          earned: 0,
          pending: 0,
          retainer: 0,
          tasks: [],
          isDeleted: false,
        }
      }
      const clientData = monthlyData[month].clients[client.id]
      const converted = convertAmount(task.amount, task.currency)
      if (task.paid) {
        clientData.earned += converted
        monthlyData[month].earned += converted
      } else if (task.amount > 0) {
        clientData.pending += converted
        monthlyData[month].pending += converted
      }
      clientData.tasks.push(task)
    })

    Object.entries(client.retainerPaid || {}).forEach(([month, paid]) => {
      if (!client.retainer) return
      if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} }
      if (!monthlyData[month].clients[client.id]) {
        monthlyData[month].clients[client.id] = {
          id: client.id,
          name: client.name,
          color: client.color,
          earned: 0,
          pending: 0,
          retainer: 0,
          tasks: [],
          isDeleted: false,
        }
      }
      if (paid) {
        const convertedRetainer = convertAmount(client.retainer, client.retainer_currency || 'NGN')
        monthlyData[month].clients[client.id].retainer = convertedRetainer
        monthlyData[month].clients[client.id].earned += convertedRetainer
        monthlyData[month].earned += convertedRetainer
      }
    })
  })

  // Also include payment history from trashed clients
  trash.filter((t) => t.item_type === 'client').forEach((trashItem) => {
    try {
      const clientData = JSON.parse(trashItem.item_data) as {
        name: string
        color?: string
        retainer?: number
        retainer_currency?: string
        retainerPaid?: Record<string, boolean>
        tasks?: Array<{
          createdAt?: string
          created_at?: string
          paid?: boolean
          amount?: number
          currency?: string
          id?: string
          title?: string
          done?: boolean
          deadline?: string | null
          sort_order?: number
        }>
      }
      const clientKey = `deleted_${trashItem.id}`

      ;(clientData.tasks || []).forEach((task) => {
        const month = (task.createdAt ?? task.created_at ?? '').slice(0, 7)
        if (!month || (!task.paid && (task.amount ?? 0) <= 0)) return

        if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} }
        if (!monthlyData[month].clients[clientKey]) {
          monthlyData[month].clients[clientKey] = {
            id: null,
            name: clientData.name,
            color: clientData.color ?? '#F0FDF4',
            earned: 0,
            pending: 0,
            retainer: 0,
            tasks: [],
            isDeleted: true,
          }
        }
        const cd = monthlyData[month].clients[clientKey]
        const convertedAmt = convertAmount(task.amount ?? 0, task.currency ?? 'NGN')
        const normalizedTask: Task = {
          id: task.id ?? `trash_task_${Math.random()}`,
          title: task.title ?? '',
          done: task.done ?? false,
          paid: task.paid ?? false,
          amount: task.amount ?? 0,
          currency: task.currency ?? 'NGN',
          deadline: task.deadline ?? null,
          sort_order: task.sort_order ?? 0,
          createdAt: task.createdAt ?? task.created_at ?? '',
        }
        if (task.paid) {
          cd.earned += convertedAmt
          monthlyData[month].earned += convertedAmt
        } else {
          cd.pending += convertedAmt
          monthlyData[month].pending += convertedAmt
        }
        cd.tasks.push(normalizedTask)
      })

      // Retainer payments from trashed client
      Object.entries(clientData.retainerPaid ?? {}).forEach(([month, paid]) => {
        if (!clientData.retainer || !paid) return
        if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} }
        if (!monthlyData[month].clients[clientKey]) {
          monthlyData[month].clients[clientKey] = {
            id: null,
            name: clientData.name,
            color: clientData.color ?? '#F0FDF4',
            earned: 0,
            pending: 0,
            retainer: 0,
            tasks: [],
            isDeleted: true,
          }
        }
        const convertedTrashedRetainer = convertAmount(
          clientData.retainer,
          clientData.retainer_currency ?? 'NGN',
        )
        monthlyData[month].clients[clientKey].retainer = convertedTrashedRetainer
        monthlyData[month].clients[clientKey].earned += convertedTrashedRetainer
        monthlyData[month].earned += convertedTrashedRetainer
      })
    } catch {
      // ignore parse errors
    }
  })

  // Also include trashed tasks whose parent client still exists (paid tasks trashed individually)
  trash.filter((t) => t.item_type === 'task').forEach((trashItem) => {
    try {
      const taskData = JSON.parse(trashItem.item_data) as {
        client_id?: string
        paid?: boolean
        amount?: number
        currency?: string
        createdAt?: string
        id?: string
        title?: string
        done?: boolean
        deadline?: string | null
        sort_order?: number
      }
      const parentClient = clients.find((c) => c.id === taskData.client_id)
      if (!parentClient) return // covered by client trash above
      if (!taskData.paid && (taskData.amount ?? 0) <= 0) return

      const month = (taskData.createdAt ?? '').slice(0, 7)
      if (!month) return

      if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} }
      const clientId = taskData.client_id ?? ''
      if (!monthlyData[month].clients[clientId]) {
        monthlyData[month].clients[clientId] = {
          id: clientId,
          name: parentClient.name,
          color: parentClient.color,
          earned: 0,
          pending: 0,
          retainer: 0,
          tasks: [],
          isDeleted: false,
        }
      }
      const cd = monthlyData[month].clients[clientId]
      const convertedTaskAmt = convertAmount(taskData.amount ?? 0, taskData.currency ?? 'NGN')
      const normalizedTask: Task = {
        id: `trash_${trashItem.id}`,
        title: taskData.title ?? '',
        done: taskData.done ?? false,
        paid: taskData.paid ?? false,
        amount: taskData.amount ?? 0,
        currency: taskData.currency ?? 'NGN',
        deadline: taskData.deadline ?? null,
        sort_order: taskData.sort_order ?? 0,
        createdAt: taskData.createdAt ?? '',
      }
      if (taskData.paid) {
        cd.earned += convertedTaskAmt
        monthlyData[month].earned += convertedTaskAmt
      } else {
        cd.pending += convertedTaskAmt
        monthlyData[month].pending += convertedTaskAmt
      }
      cd.tasks.push(normalizedTask)
    } catch {
      // ignore
    }
  })

  const months = Object.entries(monthlyData)
    .filter(([, data]) => data.earned > 0 || data.pending > 0)
    .sort(([a], [b]) => b.localeCompare(a))

  const totalEarned = months.reduce((sum, [, d]) => sum + d.earned, 0)
  const totalPending = months.reduce((sum, [, d]) => sum + d.pending, 0)

  const thisMonthData = monthlyData[currentMonth]
  const earnedThisMonth = thisMonthData?.earned ?? 0

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-enter overflow-x-hidden">
      {/* Main content */}
      <div className="flex-1 p-4 md:p-6 lg:p-8 lg:pr-4 min-w-0">
        <h1 className="font-display text-2xl font-semibold text-gray-900 mb-6 lg:mb-8">
          Payments
        </h1>

        {months.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <TrendingUp size={32} className="text-gray-200 mb-4" />
            <p className="text-[15px] font-medium text-gray-600 mb-1">No payments yet</p>
            <p className="text-[13px] text-gray-400">Mark tasks as paid to see your earnings here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {months.map(([month, data]) => {
              const isExpanded = expandedMonth === month
              const date = new Date(month + '-01')
              const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              const isCurrentMonth = month === currentMonth
              const clientEntries = Object.values(data.clients).filter(
                (c) => c.earned > 0 || c.pending > 0,
              )

              return (
                <div key={month} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedMonth(isExpanded ? null : month)}
                    className="w-full flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5 hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isExpanded ? '' : 'bg-gray-100'}`}
                      style={isExpanded ? { backgroundColor: 'var(--accent, #ED64A6)15' } : {}}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} style={{ color: 'var(--accent, #ED64A6)' }} />
                      ) : (
                        <ChevronRight size={16} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Month label — 16px weight 500 */}
                        <span className="text-base font-medium text-gray-900">
                          {label}
                        </span>
                        {isCurrentMonth && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: 'var(--accent, #ED64A6)15',
                              color: 'var(--accent, #ED64A6)',
                            }}
                          >
                            Current
                          </span>
                        )}
                      </div>
                      {/* Mobile: amounts stacked below label */}
                      <div className="flex items-center gap-2 mt-1 sm:hidden flex-wrap">
                        {data.earned > 0 && (
                          <span className="text-xs font-mono font-semibold text-success bg-success/10 px-2 py-0.5 rounded-lg break-all">
                            +{formatMoney(data.earned)}
                          </span>
                        )}
                        {data.pending > 0 && (
                          <span className="text-xs font-mono text-pending bg-pending/10 px-2 py-0.5 rounded-lg break-all">
                            {formatMoney(data.pending)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Desktop: amounts inline — more prominent */}
                    <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                      {data.earned > 0 && (
                        <span className="text-base font-mono font-semibold text-success">
                          +{formatMoney(data.earned)}
                        </span>
                      )}
                      {data.pending > 0 && (
                        <span className="text-sm font-mono text-pending bg-pending/10 px-3 py-1 rounded-lg">
                          {formatMoney(data.pending)} pending
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 sm:px-6 py-4 animate-slideDown space-y-4">
                      {clientEntries.map((cd) => {
                        const textColor = getContrastColor(cd.color)
                        // Shared avatar element
                        const avatar = (
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ backgroundColor: cd.color, color: textColor }}
                          >
                            {cd.name.charAt(0)}
                          </div>
                        )
                        return (
                          <div key={cd.id ?? cd.name}>
                            {/* Client group header — 13px, weight 500, muted, h-9 (36px) */}
                            {cd.isDeleted ? (
                              <div className="flex items-center gap-2 h-9">
                                {avatar}
                                <span className="text-[13px] font-medium text-gray-500 truncate flex-1 min-w-0">
                                  {cd.name}
                                </span>
                                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                  deleted
                                </span>
                                {cd.earned > 0 && (
                                  <span className="text-xs font-mono font-semibold text-success ml-auto flex-shrink-0">
                                    +{formatMoney(cd.earned)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Link
                                href={`/clients/${cd.id}`}
                                className="flex items-center gap-2 h-9 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                              >
                                {avatar}
                                <span className="text-[13px] font-medium text-gray-500 truncate flex-1 min-w-0 hover:text-gray-700 transition-colors">
                                  {cd.name}
                                </span>
                                {cd.earned > 0 && (
                                  <span className="text-xs font-mono font-semibold text-success ml-auto flex-shrink-0">
                                    +{formatMoney(cd.earned)}
                                  </span>
                                )}
                              </Link>
                            )}

                            {/* Task/retainer breakdown — indented 16px under the client header */}
                            <div className="pl-4 space-y-1.5 mb-2">
                              {cd.retainer > 0 && (
                                <div className="flex items-center justify-between text-xs py-0.5">
                                  <span className="text-gray-400">Retainer fee</span>
                                  <span className="font-mono font-medium text-success">
                                    +{formatMoney(cd.retainer)}
                                  </span>
                                </div>
                              )}
                              {cd.tasks
                                .filter((t) => t.amount > 0)
                                .map((task) => (
                                  <div
                                    key={task.id}
                                    className="flex items-center justify-between text-xs py-0.5"
                                  >
                                    <span className={`truncate flex-1 min-w-0 mr-3 ${task.paid ? 'text-gray-600' : 'text-gray-400'}`}>
                                      {task.title}
                                    </span>
                                    <span className={`font-mono font-medium flex-shrink-0 ${task.paid ? 'text-success' : 'text-amber-500'}`}>
                                      {formatMoney(convertAmount(task.amount, task.currency ?? 'NGN'))}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right Summary Panel */}
      <div className="w-full lg:w-[260px] lg:flex-shrink-0 p-4 lg:p-5 lg:pl-2 overflow-y-auto">
        {/* Total earned */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp size={16} className="text-success" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Total Earned</p>
          </div>
          <p className="font-mono text-2xl font-bold text-gray-900">
            {formatMoney(totalEarned)}
          </p>
        </div>

        {/* Pending */}
        {totalPending > 0 && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-pending/10 flex items-center justify-center">
                <Clock size={16} className="text-pending" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Pending</p>
            </div>
            <p className="font-mono text-2xl font-bold text-pending">
              {formatMoney(totalPending)}
            </p>
          </div>
        )}

        {/* This month — same card style as Total Earned and Pending */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent, #ED64A6)15' }}>
              <TrendingUp size={16} style={{ color: 'var(--accent, #ED64A6)' }} />
            </div>
            <p className="text-sm font-semibold text-gray-700">This Month</p>
          </div>
          <p className="font-mono text-2xl font-bold" style={{ color: 'var(--accent, #ED64A6)' }}>
            {formatMoney(earnedThisMonth)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Top clients by earnings (active only) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">Top Earners</p>
          <div className="space-y-3">
            {[...clients]
              .map((c) => ({
                ...c,
                totalEarned: c.tasks
                  .filter((t) => t.paid)
                  .reduce((s, t) => s + convertAmount(t.amount, t.currency), 0),
              }))
              .filter((c) => c.totalEarned > 0)
              .sort((a, b) => b.totalEarned - a.totalEarned)
              .slice(0, 5)
              .map((c) => {
                const rc = resolveColor(c.color)
                const textColor = getContrastColor(rc)
                return (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="flex items-center gap-3 p-1.5 -mx-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: rc, color: textColor }}
                    >
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    </div>
                    <span className="text-xs font-mono text-success font-medium">
                      {formatMoney(c.totalEarned)}
                    </span>
                  </Link>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
