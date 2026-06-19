'use client'

import { useState } from 'react'
import { X, Plus, Trash2, GripVertical } from 'lucide-react'
import type { Workflow } from '@/types/work-tasks'

interface WorkflowEditorModalProps {
  workflow: Workflow
  onAddStage: (workflowId: string, name: string, color: string, sortOrder: number) => Promise<void>
  onUpdateStage: (id: string, updates: { name?: string; color?: string; sort_order?: number }) => Promise<void>
  onDeleteStage: (id: string) => Promise<void>
  onClose: () => void
}

const STAGE_COLORS = ['#94A3B8', '#3B82F6', '#F59E0B', '#22C55E', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6']

/** Lightweight editor for a workflow's board stages (rename, recolor, add, remove). */
export default function WorkflowEditorModal({ workflow, onAddStage, onUpdateStage, onDeleteStage, onClose }: WorkflowEditorModalProps) {
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    const n = newName.trim()
    if (!n || busy) return
    setBusy(true)
    try {
      await onAddStage(workflow.id, n, STAGE_COLORS[workflow.stages.length % STAGE_COLORS.length], workflow.stages.length)
      setNewName('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Board stages</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <p className="text-xs2 text-gray-400 mb-4">{workflow.name} workflow · columns on the board</p>

        <div className="space-y-2 mb-4">
          {workflow.stages.map((s) => (
            <div key={s.id} className="flex items-center gap-2 group">
              <GripVertical size={14} className="text-gray-200" />
              <div className="relative">
                <input
                  type="color"
                  defaultValue={s.color}
                  onBlur={(e) => { if (e.target.value !== s.color) void onUpdateStage(s.id, { color: e.target.value }) }}
                  className="w-6 h-6 rounded-md border border-gray-200 cursor-pointer p-0"
                  title="Stage color"
                />
              </div>
              <input
                defaultValue={s.name}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) void onUpdateStage(s.id, { name: v }) }}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400"
              />
              <button
                onClick={() => void onDeleteStage(s.id)}
                disabled={workflow.stages.length <= 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300"
                title="Remove stage"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

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
