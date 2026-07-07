'use client'

import { useState, useEffect, useRef } from 'react'
import { formatDate } from '@/utils/formatDate'
import {
  Trash2, Check, Calendar, GripVertical,
  ChevronDown, ChevronUp, Paperclip, ExternalLink,
} from 'lucide-react'
import type { DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSettings } from '@/contexts/SettingsContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import TaskFileAttachment from '@/components/ui/TaskFileAttachment'
import DateField from '@/components/ui/DateField'
import { useTaskFiles } from '@/hooks/useTaskFiles'
import type { Task } from '@/types'

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g

function renderWithLinks(
  text: string,
  isDone: boolean,
  onTextClick: () => void,
): React.ReactNode[] | null {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  URL_REGEX.lastIndex = 0

  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t-${lastIndex}`} onClick={onTextClick} className="cursor-text">
          {text.slice(lastIndex, match.index)}
        </span>
      )
    }
    const url = match[0]
    parts.push(
      <a
        key={`l-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-0.5 underline underline-offset-2 decoration-dotted hover:decoration-solid transition-colors ${
          isDone ? 'text-gray-400' : 'text-blue-500 hover:text-blue-700'
        }`}
        title={url}
      >
        {url.length > 40 ? url.slice(0, 40) + '…' : url}
        <ExternalLink size={10} className="flex-shrink-0 opacity-70" />
      </a>
    )
    lastIndex = match.index + url.length
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`t-${lastIndex}`} onClick={onTextClick} className="cursor-text">
        {text.slice(lastIndex)}
      </span>
    )
  }

  return parts.length > 0 ? parts : null
}

function formatWithCommas(val: number | string): string {
  const num = parseFloat(String(val).replace(/,/g, ''))
  if (isNaN(num) || num === 0) return ''
  const rounded = Math.round(num * 100) / 100
  const parts   = rounded.toString().split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

function formatDeadline(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return formatDate(d)
}

const todayStr = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

interface TaskItemProps {
  task: Task
  onUpdate: (task: Task) => void
  onDelete: (id: string) => void
  dragListeners?: DraggableSyntheticListeners
  dragAttributes?: Record<string, unknown>
  noMoney?: boolean
  clientId?: string | null
}

export default function TaskItem({
  task,
  onUpdate,
  onDelete,
  dragListeners,
  dragAttributes,
  noMoney = false,
  clientId = null,
}: TaskItemProps) {
  const [editing,      setEditing]      = useState(false)
  const [title,        setTitle]        = useState(task.title)
  const [expanded,     setExpanded]     = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [bouncing,     setBouncing]     = useState(false)
  const [amountInput,  setAmountInput]  = useState('')
  const [amountEditing, setAmountEditing] = useState(false)
  const [paidMenuOpen, setPaidMenuOpen] = useState(false)
  const [fileOpen,     setFileOpen]     = useState(false)
  const paidMenuRef = useRef<HTMLDivElement>(null)

  const { count: fileCount } = useTaskFiles(clientId ? task.id : null, false)
  const confirm = useConfirm()

  useEffect(() => {
    if (!paidMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (paidMenuRef.current && !paidMenuRef.current.contains(e.target as Node)) {
        setPaidMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [paidMenuOpen])

  const { settings, convertAmount } = useSettings()
  const currencyLabel = settings.currency === 'USD' ? 'USD' : 'NGN'

  const today     = todayStr()
  const isOverdue = Boolean(task.deadline && !task.done && task.deadline < today)
  const isToday   = Boolean(task.deadline && task.deadline === today)

  useEffect(() => {
    if (!amountEditing) {
      const converted = convertAmount(task.amount, task.currency)
      setAmountInput(converted > 0 ? formatWithCommas(converted) : '')
    }
  }, [task.amount, task.currency, settings.currency, settings.exchange_rate, amountEditing, convertAmount])

  const handleDone = () => {
    setBouncing(true)
    setTimeout(() => setBouncing(false), 200)
    const newDone = !task.done
    onUpdate({ ...task, done: newDone, paid: newDone ? task.paid : false })
  }

  const handlePaid = () => { onUpdate({ ...task, paid: !task.paid }) }

  const handleTitleBlur = () => {
    setEditing(false)
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) {
      setTitle(trimmed)
      onUpdate({ ...task, title: trimmed })
    } else {
      setTitle(task.title)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    if (!/^\d*\.?\d*$/.test(raw)) return
    const parts = raw.split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    setAmountInput(parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0])
  }

  const handleAmountBlur = () => {
    setAmountEditing(false)
    const raw = parseFloat(amountInput.replace(/,/g, '')) || 0
    onUpdate({ ...task, amount: raw, currency: settings.currency })
    setAmountInput(raw > 0 ? formatWithCommas(raw) : '')
  }

  const handleDeadlineChange = (deadline: string | null) => {
    onUpdate({ ...task, deadline })
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete this task?',
      message: 'This permanently removes the task. This can’t be undone.',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    setDeleting(true)
    setTimeout(() => onDelete(task.id), 200)
  }

  return (
    <div
      className={`group rounded-xl hover:bg-gray-50 transition-colors duration-150 ${
        deleting ? 'animate-fadeOut' : 'animate-fadeIn'
      } ${isOverdue ? 'border-l-2 border-red-400' : ''}`}
    >
      {/* Main task row */}
      <div className={`flex items-center gap-3 py-3 px-4 ${isOverdue ? 'pl-3' : ''}`}>
        <span
          onClick={handleDone}
          role="checkbox"
          aria-checked={task.done}
          className={`relative rounded-md border-2 flex items-center justify-center transition-colors duration-150 flex-shrink-0 cursor-pointer after:absolute after:-inset-x-2 after:-inset-y-2 after:content-[''] ${
            bouncing ? 'animate-scaleBounce' : ''
          } ${task.done ? 'text-white' : 'border-gray-300'}`}
          style={{
            width: 18, height: 18,
            ...(task.done ? { backgroundColor: 'var(--accent, #ED64A6)', borderColor: 'var(--accent, #ED64A6)' } : {}),
          }}
          onMouseEnter={(e) => { if (!task.done) (e.currentTarget as HTMLSpanElement).style.borderColor = 'var(--accent, #ED64A6)' }}
          onMouseLeave={(e) => { if (!task.done) (e.currentTarget as HTMLSpanElement).style.borderColor = '' }}
        >
          {task.done && <Check size={11} strokeWidth={3} />}
        </span>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              className="w-full bg-transparent border-b border-primary/30 outline-none text-sm py-0.5 font-medium"
            />
          ) : (
            <span
              onClick={() => setEditing(true)}
              className={`block text-sm font-medium break-words whitespace-normal min-w-0 ${
                task.done ? 'line-through text-gray-400' : 'text-gray-800'
              }`}
            >
              {renderWithLinks(task.title, task.done, () => setEditing(true)) ?? task.title}
            </span>
          )}
          {task.deadline && (
            <span className={`text-xs ${
              isOverdue ? 'text-red-500 font-medium' : isToday ? 'text-amber-500 font-medium' : 'text-gray-400'
            }`}>
              Due: {formatDeadline(task.deadline)}
            </span>
          )}
        </div>

        {!noMoney && task.paid && <span className="hidden md:block w-2 h-2 rounded-full bg-success flex-shrink-0" />}

        {!noMoney && (
          <div className="hidden md:flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-gray-400">{currencyLabel}</span>
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={handleAmountChange}
              onFocus={() => setAmountEditing(true)}
              onBlur={handleAmountBlur}
              placeholder="0"
              className="w-16 sm:w-24 text-right text-sm font-mono bg-transparent outline-none text-gray-700 placeholder:text-gray-300"
            />
          </div>
        )}

        {!noMoney && (
          <div className="hidden md:block relative flex-shrink-0" ref={paidMenuRef}>
            <button
              onClick={() => setPaidMenuOpen((v) => !v)}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-200 ${
                task.paid ? 'bg-success text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {task.paid ? 'Paid' : 'Unpaid'}
              {paidMenuOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {paidMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 min-w-[100px]">
                <button
                  onClick={() => { if (!task.paid) handlePaid(); setPaidMenuOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${task.paid ? 'text-success font-semibold' : 'text-gray-600'}`}
                >
                  {task.paid ? <Check size={10} className="text-success" /> : <span className="w-[10px]" />}
                  Paid
                </button>
                <button
                  onClick={() => { if (task.paid) handlePaid(); setPaidMenuOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${!task.paid ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}
                >
                  {!task.paid ? <Check size={10} className="text-gray-500" /> : <span className="w-[10px]" />}
                  Unpaid
                </button>
              </div>
            )}
          </div>
        )}

        <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
          {clientId && (
            <button
              onClick={(e) => { e.stopPropagation(); setFileOpen((v) => !v) }}
              title="Attachments"
              className={`relative flex items-center justify-center w-6 h-6 transition-[opacity,color] after:absolute after:-inset-x-[3px] after:-inset-y-2 after:content-[''] ${
                fileOpen
                  ? 'text-gray-600'
                  : fileCount > 0
                  ? 'text-gray-400'
                  : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500'
              }`}
            >
              <Paperclip size={14} />
              {fileCount > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full text-white text-5xs font-bold flex items-center justify-center leading-none"
                  style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
                >
                  {fileCount > 9 ? '9+' : fileCount}
                </span>
              )}
            </button>
          )}

          <DateField
            value={task.deadline || null}
            onChange={handleDeadlineChange}
            placeholder="Set deadline"
            title={task.deadline ? `Due: ${formatDeadline(task.deadline)}` : 'Set deadline'}
            className={`flex items-center justify-center w-6 h-6 transition-[opacity,color] ${
              isOverdue
                ? 'text-red-400 hover:text-red-600'
                : task.deadline
                ? 'text-amber-400 hover:text-amber-600'
                : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500'
            }`}
          >
            <Calendar size={14} />
          </DateField>

          <button
            onClick={() => void handleDelete()}
            className="relative flex items-center justify-center w-6 h-6 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-danger transition-[opacity,color] duration-150 after:absolute after:-inset-x-[3px] after:-inset-y-2 after:content-['']"
          >
            <Trash2 size={14} />
          </button>

          {dragListeners && (
            <button
              {...(dragListeners as Record<string, unknown>)}
              {...(dragAttributes as Record<string, unknown>)}
              className="relative flex items-center justify-center w-6 h-6 opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity cursor-grab active:cursor-grabbing touch-none text-gray-400 after:absolute after:-inset-x-[3px] after:-inset-y-2 after:content-['']"
              tabIndex={-1}
            >
              <GripVertical size={14} />
            </button>
          )}
        </div>

        {!noMoney && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="md:hidden flex items-center justify-center w-7 h-7 text-gray-400 flex-shrink-0 transition-colors"
          >
            <ChevronDown
              size={16}
              className="transition-transform duration-200"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        )}

        {noMoney && (
          <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
            <DateField
              value={task.deadline || null}
              onChange={handleDeadlineChange}
              placeholder="Set deadline"
              className={`flex items-center justify-center w-6 h-6 transition-colors ${
                isOverdue ? 'text-red-400' : task.deadline ? 'text-amber-400' : 'text-gray-300'
              }`}
            >
              <Calendar size={14} />
            </DateField>
            <button
              onClick={() => void handleDelete()}
              className="flex items-center justify-center w-6 h-6 text-gray-300 hover:text-danger transition-colors duration-150"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Mobile expanded panel */}
      {!noMoney && expanded && (
        <div className="md:hidden flex items-center gap-2 flex-wrap pt-2 pb-1 pl-8 px-4">
          <span className="text-xs text-gray-400">{currencyLabel}</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={handleAmountChange}
            onFocus={() => setAmountEditing(true)}
            onBlur={handleAmountBlur}
            placeholder="0"
            className="w-20 text-right text-sm font-mono bg-gray-50 rounded-lg px-2 py-1 border border-gray-200 outline-none text-gray-700 placeholder:text-gray-300"
          />
          <div className="relative flex-shrink-0" ref={paidMenuRef}>
            <button
              onClick={() => setPaidMenuOpen((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors duration-200 ${
                task.paid ? 'bg-success text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {task.paid ? 'Paid' : 'Unpaid'}
              {paidMenuOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {paidMenuOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 min-w-[100px]">
                <button
                  onClick={() => { if (!task.paid) handlePaid(); setPaidMenuOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${task.paid ? 'text-success font-semibold' : 'text-gray-600'}`}
                >
                  {task.paid ? <Check size={10} className="text-success" /> : <span className="w-[10px]" />}
                  Paid
                </button>
                <button
                  onClick={() => { if (task.paid) handlePaid(); setPaidMenuOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${!task.paid ? 'text-gray-800 font-semibold' : 'text-gray-400'}`}
                >
                  {!task.paid ? <Check size={10} className="text-gray-500" /> : <span className="w-[10px]" />}
                  Unpaid
                </button>
              </div>
            )}
          </div>
          <DateField
            value={task.deadline || null}
            onChange={handleDeadlineChange}
            placeholder="Set deadline"
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
              isOverdue ? 'text-red-400' : task.deadline ? 'text-amber-400' : 'text-gray-300'
            }`}
          >
            <Calendar size={14} />
          </DateField>
          <button
            onClick={() => void handleDelete()}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-300 hover:text-danger transition-colors duration-150"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {clientId && (
        <TaskFileAttachment taskId={task.id} clientId={clientId} open={fileOpen} />
      )}
    </div>
  )
}
