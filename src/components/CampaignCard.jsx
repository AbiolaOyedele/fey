import { useState, useRef, useCallback } from 'react';
import { Plus, ChevronDown, ChevronUp, Edit2, Trash2, Check, GripVertical, Layers } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskItem from './TaskItem';
import { PALETTE } from '../data/defaultClients';
import { useSettings } from '../contexts/SettingsContext';
import { getContrastColor } from '../utils/colorContrast';

const normalizeHex = (v) => v.trim().startsWith('#') ? v.trim() : `#${v.trim()}`;
const isValidHex = (v) => /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(v));

function DraggableCampaignTask({ task, onUpdate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragListeners={listeners}
        dragAttributes={attributes}
        clientId={null} /* file attachments not on campaign tasks */
      />
    </div>
  );
}

/**
 * Single campaign card — collapsible, with its own DnD task list.
 * Props:
 *   campaign      – { id, name, color, tasks[] }
 *   onUpdate      – (campaignId, updates) update campaign meta
 *   onDelete      – (campaignId)
 *   onAddTask     – (campaignId, title)
 *   onAddTasksBulk– (campaignId, titles[])
 *   onUpdateTask  – (campaignId, taskId, updates)
 *   onDeleteTask  – (campaignId, taskId)
 *   onReorderTasks– (campaignId, orderedIds[])
 *   currency      – default currency string
 */
export default function CampaignCard({
  campaign,
  onUpdate,
  onDelete,
  onAddTask,
  onAddTasksBulk,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
  currency,
}) {
  const { showToast } = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(campaign.name);
  const [editColor, setEditColor] = useState(campaign.color);
  const [editCustomHex, setEditCustomHex] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDraggingRef = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const textColor = getContrastColor(campaign.color);

  const tasks = [...campaign.tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const doneTasks = tasks.filter((t) => t.done);
  const pendingTasks = tasks.filter((t) => !t.done);

  const handleAddTask = async () => {
    const title = newTask.trim();
    if (!title) return;
    await onAddTask(campaign.id, title, currency);
    setNewTask('');
  };

  const handlePaste = async (e) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    await onAddTasksBulk(campaign.id, lines, currency);
    setNewTask('');
    showToast?.(`${lines.length} tasks added`);
  };

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setTimeout(() => { isDraggingRef.current = false; }, 500);
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    onReorderTasks(campaign.id, reordered.map((t) => t.id));
  }, [tasks, campaign.id, onReorderTasks]);

  const handleSaveEdit = async () => {
    const name = editName.trim();
    if (!name) return;
    await onUpdate(campaign.id, { name, color: editColor });
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
      {/* Campaign header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ backgroundColor: campaign.color }}
        onClick={() => !editing && setCollapsed((v) => !v)}
      >
        <Layers size={15} style={{ color: textColor, opacity: 0.8 }} className="flex-shrink-0" />
        <span className="flex-1 text-sm font-semibold truncate" style={{ color: textColor }}>
          {campaign.name}
        </span>
        {/* Progress badge */}
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)', color: textColor }}
        >
          {doneTasks.length}/{tasks.length}
        </span>
        {/* Edit */}
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); setEditName(campaign.name); setEditColor(campaign.color); }}
          className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
          style={{ color: textColor }}
        >
          <Edit2 size={13} />
        </button>
        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
          style={{ color: textColor }}
        >
          <Trash2 size={13} />
        </button>
        {/* Collapse toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
          className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
          style={{ color: textColor }}
        >
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>

      {/* Edit name/color inline panel */}
      {editing && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-3">
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
            placeholder="Campaign name"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400"
          />
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setEditColor(c)}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: editColor === c ? '#111' : 'transparent' }}
              />
            ))}
            <input
              type="text"
              value={editCustomHex}
              onChange={(e) => {
                setEditCustomHex(e.target.value);
                if (isValidHex(e.target.value)) setEditColor(normalizeHex(e.target.value));
              }}
              placeholder="#hex"
              className="w-20 px-2 py-0.5 rounded-lg border border-gray-200 text-xs outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium bg-gray-800 hover:bg-gray-900 transition-colors"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="px-4 py-3 border-b border-gray-100 bg-red-50 flex items-center justify-between gap-3">
          <p className="text-xs text-red-600 font-medium">Delete "{campaign.name}" and all its tasks?</p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => { onDelete(campaign.id); setConfirmDelete(false); }}
              className="px-3 py-1.5 rounded-xl text-white text-xs font-medium bg-red-500 hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {!collapsed && (
        <>
          {tasks.length === 0 ? (
            <p className="px-4 py-4 text-xs text-gray-400 text-center">No tasks yet — add one below</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={() => { isDraggingRef.current = true; }}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {tasks.map((task) => (
                  <DraggableCampaignTask
                    key={task.id}
                    task={task}
                    onUpdate={(updated) => onUpdateTask(campaign.id, task.id, updated)}
                    onDelete={() => onDeleteTask(campaign.id, task.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* Add task input */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              onPaste={handlePaste}
              placeholder="Add a task…"
              className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-300 transition-colors min-w-0"
            />
            <button
              onClick={handleAddTask}
              disabled={!newTask.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-white text-xs font-medium disabled:opacity-40 transition-opacity hover:opacity-90 flex-shrink-0"
              style={{ backgroundColor: campaign.color }}
            >
              <Plus size={13} />
              Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
