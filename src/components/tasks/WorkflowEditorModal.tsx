'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, GripVertical, ChevronDown, ShieldCheck } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Workflow, WorkflowStage, UpdateStagePayload, StageHandoffMode } from '@/types/work-tasks'
import PersonPicker from './PersonPicker'

interface WorkflowEditorModalProps {
  workflow: Workflow
  workspaceId: string | null | undefined
  onAddStage: (workflowId: string, name: string, color: string, sortOrder: number) => Promise<void>
  onUpdateStage: (id: string, updates: UpdateStagePayload) => Promise<void>
  onDeleteStage: (id: string) => Promise<void>
  onReorderStages: (orderedIds: string[]) => Promise<void>
  onClose: () => void
}

const STAGE_COLORS = ['#94A3B8', '#3B82F6', '#F59E0B', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6']

const HANDOFF_OPTIONS: Array<{ value: StageHandoffMode; label: string; hint: string }> = [
  { value: 'keep',   label: 'Stays put',  hint: 'Whoever has the task keeps it.' },
  { value: 'fixed',  label: 'Hand to…',   hint: 'Always goes to the same person.' },
  { value: 'prompt', label: 'Ask',        hint: 'Whoever moves it picks who’s next.' },
]

/**
 * Editor for a workflow's stages — order, name, colour, and the two rules that
 * decide how work travels: who picks it up here, and whether it needs signing
 * off before it can leave.
 */
export default function WorkflowEditorModal({
  workflow, workspaceId, onAddStage, onUpdateStage, onDeleteStage, onReorderStages, onClose,
}: WorkflowEditorModalProps) {
  // Local order so the list stays put while the reorder request round-trips.
  const [order, setOrder] = useState<WorkflowStage[]>(workflow.stages)
  useEffect(() => { setOrder(workflow.stages) }, [workflow.stages])

  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const msg = (e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = order.findIndex((s) => s.id === active.id)
    const newIndex = order.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(order, oldIndex, newIndex)
    setOrder(next)
    setError(null)
    void onReorderStages(next.map((s) => s.id)).catch((err) => { msg(err); setOrder(workflow.stages) })
  }

  const add = async () => {
    const n = newName.trim()
    if (!n || busy) return
    setBusy(true)
    setError(null)
    try {
      await onAddStage(workflow.id, n, STAGE_COLORS[order.length % STAGE_COLORS.length], order.length)
      setNewName('')
    } catch (err) {
      msg(err)
    } finally {
      setBusy(false)
    }
  }

  const update = (id: string, updates: UpdateStagePayload) => {
    setError(null)
    return onUpdateStage(id, updates).catch(msg)
  }
  const del = (id: string) => onDeleteStage(id).catch(msg)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl p-4 sm:p-5 max-h-[92dvh] sm:max-h-[88dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Board stages</h2>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs2 text-gray-400 mb-4">
          {workflow.name} workflow · drag to reorder. Tap <span className="font-semibold text-gray-500">Rules</span> on a
          stage to set who picks work up there, whether it needs signing off, and how long it should take.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 mb-4">
              {order.map((s) => (
                <StageRow
                  key={s.id}
                  stage={s}
                  workspaceId={workspaceId}
                  canDelete={order.length > 1}
                  isOpen={expanded === s.id}
                  onToggleOpen={() => setExpanded(expanded === s.id ? null : s.id)}
                  onUpdate={update}
                  onDelete={del}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
          <Plus size={14} className="text-gray-300 flex-shrink-0" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
            placeholder="Add a stage…"
            className="flex-1 min-w-0 text-sm py-1 outline-none placeholder:text-gray-300"
          />
          <button
            onClick={() => void add()}
            disabled={!newName.trim() || busy}
            className="px-4 min-h-[44px] rounded-full text-xs2 font-semibold text-white disabled:opacity-40 flex-shrink-0"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

interface StageRowProps {
  stage: WorkflowStage
  workspaceId: string | null | undefined
  canDelete: boolean
  isOpen: boolean
  onToggleOpen: () => void
  onUpdate: (id: string, updates: UpdateStagePayload) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function StageRow({ stage, workspaceId, canDelete, isOpen, onToggleOpen, onUpdate, onDelete }: StageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  /**
   * One-line summary of the rules, always rendered — including the defaults.
   * An unconfigured stage used to show nothing at all, which made the editor
   * look identical to the old one and left the whole feature undiscoverable.
   */
  const summary = [
    stage.handoff_mode === 'fixed' && stage.handoff_user_id ? 'Hands to a set person'
      : stage.handoff_mode === 'prompt' ? 'Asks who’s next'
      : 'Stays with whoever has it',
    stage.requires_approval ? 'Needs sign-off' : null,
    stage.target_days ? `${stage.target_days}d target` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl border border-gray-100">
      <div className="flex items-center gap-2 p-2">
        <button
          {...attributes}
          {...listeners}
          aria-label="Reorder stage"
          className="cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-gray-500 w-6 h-11 flex items-center justify-center flex-shrink-0"
        >
          <GripVertical size={14} />
        </button>
        <input
          type="color"
          defaultValue={stage.color}
          onBlur={(e) => { if (e.target.value !== stage.color) void onUpdate(stage.id, { color: e.target.value }) }}
          className="w-7 h-7 rounded-md border border-gray-200 cursor-pointer p-0 flex-shrink-0"
          title="Stage colour"
        />
        <input
          defaultValue={stage.name}
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== stage.name) void onUpdate(stage.id, { name: v }) }}
          className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
        />
        <button
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          aria-label={isOpen ? `Hide rules for ${stage.name}` : `Set rules for ${stage.name}`}
          className="min-h-[44px] px-2.5 rounded-lg flex items-center gap-1 text-2xs font-medium text-gray-500 hover:bg-gray-100 flex-shrink-0"
        >
          Rules
          <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => void onDelete(stage.id)}
          disabled={!canDelete}
          aria-label="Remove stage"
          className="w-11 h-11 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300 flex-shrink-0"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {!isOpen && (
        <button
          onClick={onToggleOpen}
          className="w-full text-left px-3 pb-2 -mt-1 text-2xs text-gray-400 flex items-center gap-1 flex-wrap hover:text-gray-600"
        >
          {stage.requires_approval && <ShieldCheck size={11} className="text-amber-500 flex-shrink-0" />}
          {summary}
        </button>
      )}

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-4 border-t border-gray-50">
          {/* Who picks the work up */}
          <div>
            <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">When work arrives here</p>
            <div className="flex flex-wrap gap-1.5">
              {HANDOFF_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => void onUpdate(stage.id, {
                    handoff_mode: o.value,
                    // A 'fixed' stage needs somebody named, so it opens with the
                    // person already there (if any) and the picker below.
                    ...(o.value === 'fixed' ? { handoff_user_id: stage.handoff_user_id } : {}),
                  })}
                  className={`px-3 min-h-[36px] rounded-lg text-xs2 font-medium border transition-colors ${
                    stage.handoff_mode === o.value
                      ? 'border-gray-900 text-gray-900'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-2xs text-gray-400">
              {HANDOFF_OPTIONS.find((o) => o.value === stage.handoff_mode)?.hint}
            </p>
            {stage.handoff_mode === 'fixed' && (
              <div className="mt-2">
                <PersonPicker
                  workspaceId={workspaceId}
                  selectedId={stage.handoff_user_id}
                  onChange={(id) => void onUpdate(stage.id, { handoff_mode: 'fixed', handoff_user_id: id })}
                  title={`Who owns ${stage.name}?`}
                  emptyLabel="Choose a person"
                />
                {!stage.handoff_user_id && (
                  <p className="mt-1 text-2xs text-amber-600">
                    Pick someone, or work will stay with whoever moved it.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Approval gate */}
          <div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={stage.requires_approval}
                onChange={(e) => void onUpdate(stage.id, { requires_approval: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 flex-shrink-0"
                style={{ accentColor: 'var(--accent, #ED64A6)' }}
              />
              <span className="min-w-0">
                <span className="block text-xs2 font-medium text-gray-700">Needs sign-off to leave</span>
                <span className="block text-2xs text-gray-400">
                  Work stops here until someone approves it or sends it back.
                </span>
              </span>
            </label>
            {stage.requires_approval && (
              <div className="mt-2 pl-6">
                <PersonPicker
                  workspaceId={workspaceId}
                  selectedId={stage.approver_id}
                  onChange={(id) => void onUpdate(stage.id, { approver_id: id })}
                  title={`Who signs off on ${stage.name}?`}
                  emptyLabel="Anyone who manages this workspace"
                  clearable
                  clearLabel="Anyone who manages this workspace"
                />
              </div>
            )}
          </div>

          {/* Stage target */}
          <div>
            <p className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Should take no longer than</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                defaultValue={stage.target_days ?? ''}
                onBlur={(e) => {
                  const raw = e.target.value.trim()
                  const next = raw === '' ? null : Math.min(365, Math.max(1, parseInt(raw, 10) || 1))
                  if (next !== stage.target_days) void onUpdate(stage.id, { target_days: next })
                }}
                placeholder="—"
                className="w-20 px-2.5 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
              />
              <span className="text-xs2 text-gray-500">days</span>
            </div>
            <p className="mt-1.5 text-2xs text-gray-400">
              Past this, the task shows as stalled here — measured from when it arrived, so a
              hold-up in this stage doesn’t read as a delay by whoever worked on it earlier.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
