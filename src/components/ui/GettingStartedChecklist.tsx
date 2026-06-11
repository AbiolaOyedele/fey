'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSettings } from '@/contexts/SettingsContext'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { Client } from '@/types'

interface ChecklistStep {
  id: string
  label: string
  link: string
}

const STEPS: ChecklistStep[] = [
  { id: 'setup_business',  label: 'Set up your business',       link: '/settings?tab=Business+Info' },
  { id: 'add_client',      label: 'Add your first client',       link: '/clients' },
  { id: 'send_invoice',    label: 'Send an invoice or quote',    link: '/clients' },
  { id: 'create_proposal', label: 'Create a proposal',           link: '/clients' },
  { id: 'track_finances',  label: 'Track your finances',         link: '/payments' },
]

interface GettingStartedChecklistProps {
  clients?: Client[]
}

export default function GettingStartedChecklist({ clients = [] }: GettingStartedChecklistProps) {
  const { settings, saveSetting } = useSettings()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  if (settings.checklist_dismissed === 'true') return null

  let stored: Record<string, boolean> = {}
  try { stored = JSON.parse(settings.checklist_steps || '{}') as Record<string, boolean> } catch { /* ignore */ }

  // Auto-detect completed steps from app state
  const steps: Record<string, boolean> = {
    ...stored,
    setup_business: stored['setup_business'] ?? ((settings.company_name?.trim().length > 0) && (settings.business_email?.trim().length > 0 || settings.business_phone?.trim().length > 0)),
    add_client: stored['add_client'] ?? clients.length > 0,
    track_finances: stored['track_finances'] ?? clients.some((c) => c.tasks?.some((t) => t.paid)),
  }

  const doneCount = STEPS.filter((s) => steps[s.id]).length
  const total = STEPS.length

  const handleDismiss = () => saveSetting('checklist_dismissed', 'true')

  const handleStepClick = (step: ChecklistStep) => {
    if (steps[step.id]) return
    // For manually-completed steps, toggle them on click
    if (step.id === 'send_invoice' || step.id === 'create_proposal') {
      const next = { ...stored, [step.id]: !stored[step.id] }
      saveSetting('checklist_steps', JSON.stringify(next))
    }
    router.push(step.link)
  }

  // Hide permanently once all done
  if (doneCount === total) {
    saveSetting('checklist_dismissed', 'true')
    return null
  }

  const pct = Math.round((doneCount / total) * 100)

  return (
    <div className="fixed bottom-6 right-6 z-40 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Getting Started</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, white)', color: 'var(--accent)' }}
          >
            {doneCount}/{total}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 mx-4 rounded-full mb-1">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }}
        />
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="p-2 pb-3">
          {STEPS.map((step) => {
            const done = !!steps[step.id]
            const isManual = step.id === 'send_invoice' || step.id === 'create_proposal'
            return (
              <button
                key={step.id}
                onClick={() => handleStepClick(step)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  done ? 'cursor-default' : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                {done ? (
                  <CheckCircle2 size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                ) : (
                  <Circle size={17} className="text-gray-300 flex-shrink-0" />
                )}
                <span
                  className={`text-sm leading-snug ${
                    done ? 'line-through text-gray-400' : 'text-gray-700'
                  }`}
                >
                  {step.label}
                </span>
                {!done && isManual && (
                  <span className="ml-auto text-[10px] text-gray-400 italic flex-shrink-0">
                    click to mark
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
