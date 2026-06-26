'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Workflow, WorkflowStage } from '@/types/work-tasks'

interface WorkflowEditorModalProps {
  workflow: Workflow
  onAddStage: (workflowId: string, name: string, color: string, sortOrder: number) => Promise<void>
  onUpdateStage: (id: string, updates: { name?: string; color?: string; sort_order?: number }) => Promise<void>
  onDeleteStage: (id: string) => Promise<void>
  onReorderStages: (orderedIds: string[]) => Promise<void>
  onClose: () => void
}

const STAGE_COLORS = ['#94A3B8', '#3B82F6', '#F59E0B', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6']

/** Editor for a workflow's board stages — drag to reorder, rename, recolor, add, remove. */
export default function WorkflowEditorModal({ workflow, onAddStage, onUpdateStage, onDeleteStage, onReorderStages, onClose }: WorkflowEditorModalProps) {
  // Local order so the list stays put while the reorder request round-trips.
  const [order, setOrder] = useState<WorkflowStage[]>(workflow.stages)
  useEffect(() => { setOrder(workflow.stages) }, [workflow.stages])

  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const update = (id: string, updates: { name?: string; color?: string }) => onUpdateStage(id, updates).catch(msg)
  const del = (id: string) => onDeleteStage(id).catch(msg)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5 max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Board stages</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <p className="text-xs2 text-gray-400 mb-4">{workflow.name} workflow · drag to reorder columns</p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 mb-4">
              {order.map((s) => (
                <StageRow
                  key={s.id}
                  stage={s}
                  canDelete={order.length > 1}
                  onUpdate={update}
                  onDelete={del}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
          <Plus size={14} className="text-gray-300" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
            placeholder="Add a stage…"
            className="flex-1 text-sm py-1 outline-none placeholder:text-gray-300"
          />
          <button
            onClick={() => void add()}
            disabled={!newName.trim() || busy}
            className="px-3 py-1.5 rounded-full text-xs2 font-semibold text-white disabled:opacity-40"
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
  canDelete: boolean
  onUpdate: (id: string, updates: { name?: string; color?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function StageRow({ stage, canDelete, onUpdate, onDelete }: StageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 group bg-white">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-gray-300 hover:text-gray-500">
        <GripVertical size={14} />
      </button>
      <input
        type="color"
        defaultValue={stage.color}
        onBlur={(e) => { if (e.target.value !== stage.color) void onUpdate(stage.id, { color: e.target.value }) }}
        className="w-6 h-6 rounded-md border border-gray-200 cursor-pointer p-0"
        title="Stage color"
      />
      <input
        defaultValue={stage.name}
        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== stage.name) void onUpdate(stage.id, { name: v }) }}
        className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
      />
      <button
        onClick={() => void onDelete(stage.id)}
        disabled={!canDelete}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300"
        title="Remove stage"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
