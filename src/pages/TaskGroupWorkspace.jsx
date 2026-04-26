import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, Plus, CheckCircle2, Clock,
  AlertTriangle, Edit2, X, ListTodo,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SimpleTaskItem from '../components/SimpleTaskItem';
import { useSettings } from '../contexts/SettingsContext';
import { PALETTE } from '../data/defaultClients';
import { ICON_NAMES, ICON_MAP, TaskGroupIcon } from '../lib/taskGroupIcons.jsx';

import { getContrastColor } from '../utils/colorContrast';

const TASK_FILTER_OPTIONS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'tomorrow', label: 'Due Tomorrow' },
];

const normalizeHex = (val) => val.trim().startsWith('#') ? val.trim() : `#${val.trim()}`;
const isValidHex = (val) => /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(val));

function DraggableTaskItem({ task, onUpdate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <SimpleTaskItem task={task} onUpdate={onUpdate} onDelete={onDelete} dragListeners={listeners} dragAttributes={attributes} />
    </div>
  );
}

export default function TaskGroupWorkspace({ taskGroupData }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trashStandaloneTask, showToast } = useSettings();

  const { groups, updateGroup, addGroupTask, updateGroupTask, removeGroupTask, reorderGroupTasks } = taskGroupData;
  const group = groups.find((g) => g.id === id);

  const [newTask, setNewTask] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterPos, setFilterPos] = useState({ top: 0, left: 0 });
  const filterBtnRef = useRef(null);
  const filterDropdownRef = useRef(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editCustomHex, setEditCustomHex] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    const handler = (e) => {
      if (
        filterDropdownRef.current && !filterDropdownRef.current.contains(e.target) &&
        filterBtnRef.current && !filterBtnRef.current.contains(e.target)
      ) {
        setFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!group) {
    return (
      <div className="p-8 page-enter text-center py-20">
        <p className="text-gray-400 text-lg">Group not found</p>
        <button onClick={() => navigate('/tasks')} className="text-sm mt-2 hover:underline" style={{ color: 'var(--accent, #ED64A6)' }}>
          Back to Tasks
        </button>
      </div>
    );
  }

  const textColor = getContrastColor(group.color);

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const tomorrowStr = (() => {
    const n = new Date();
    n.setDate(n.getDate() + 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    const title = newTask.trim();
    await addGroupTask(id, title);
    setNewTask('');
  };

  const handleUpdateTask = async (updatedTask) => {
    await updateGroupTask(id, updatedTask.id, {
      title: updatedTask.title,
      done: updatedTask.done,
      deadline: updatedTask.deadline,
    });
  };

  const handleDeleteTask = async (taskId) => {
    const task = group.tasks.find((t) => t.id === taskId);
    if (!task) return;
    removeGroupTask(id, taskId);
    const trashItem = await trashStandaloneTask({ ...task, task_group_id: id });
    if (trashItem) showToast(`"${task.title}" moved to trash`);
  };

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = group.tasks.findIndex((t) => t.id === active.id);
    const newIndex = group.tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderGroupTasks(id, arrayMove(group.tasks, oldIndex, newIndex).map((t) => t.id));
  }, [group.tasks, id, reorderGroupTasks]);

  const filterTaskList = (tasks) => {
    if (taskFilter === 'all') return tasks;
    if (taskFilter === 'overdue') return tasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);
    if (taskFilter === 'today') return tasks.filter((t) => t.deadline === todayStr);
    if (taskFilter === 'tomorrow') return tasks.filter((t) => t.deadline === tomorrowStr);
    return tasks;
  };

  const allTasks = [...group.tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const overdueTasks = allTasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);
  const pendingTasks = filterTaskList(allTasks.filter((t) => !t.done));
  const completedTasks = filterTaskList(allTasks.filter((t) => t.done));

  const dndEnabled = taskFilter === 'all';
  const currentFilterLabel = TASK_FILTER_OPTIONS.find((o) => o.value === taskFilter)?.label || 'All Tasks';
  const completionPct = group.tasks.length > 0
    ? Math.round((group.tasks.filter((t) => t.done).length / group.tasks.length) * 100)
    : 0;

  const openEditModal = () => {
    setEditName(group.name);
    setEditColor(group.color);
    setEditIcon(group.icon || '');
    setEditCustomHex('');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    const name = editName.trim();
    await updateGroup(id, { name, color: editColor, icon: editIcon });
    setEditOpen(false);
  };

  const editPaletteUsed = new Set(groups.filter((g) => g.id !== id).map((g) => g.color));
  const editPaletteToShow = PALETTE.filter((c) => !editPaletteUsed.has(c)).length > 0
    ? PALETTE.filter((c) => !editPaletteUsed.has(c))
    : PALETTE;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-enter overflow-hidden max-w-full">

      {/* ── Main content ── */}
      <div className="flex-1 p-4 lg:p-8 lg:pr-4 min-w-0 overflow-y-auto overflow-x-hidden">

        {/* Back link */}
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to Tasks
        </button>

        {/* Hero header */}
        <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: group.color }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/50 flex-shrink-0 font-display font-bold text-2xl"
              style={{ color: textColor }}
            >
              {group.icon ? (
                <TaskGroupIcon name={group.icon} size={22} />
              ) : (
                <span>{group.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl leading-tight font-bold truncate" style={{ color: textColor }}>
                {group.name}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: textColor, opacity: 0.65 }}>
                {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'} · {completionPct}% complete
              </p>
            </div>
            <button
              onClick={openEditModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/40 hover:bg-white/60 transition-colors text-xs font-medium flex-shrink-0"
              style={{ color: textColor }}
            >
              <Edit2 size={12} />
              Edit
            </button>
          </div>
        </div>

        {/* Filter + task list header row */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold text-gray-800">
            Tasks
            <span className="text-sm font-normal text-gray-400 ml-2">{group.tasks.length}</span>
          </h2>

          {/* Filter button */}
          <div className="relative">
            <button
              ref={filterBtnRef}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setFilterPos({ top: rect.bottom + 4, left: rect.left });
                setFilterDropdownOpen(!filterDropdownOpen);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                taskFilter !== 'all'
                  ? 'text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
              style={taskFilter !== 'all' ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
            >
              {currentFilterLabel}
              <ChevronDown size={13} />
            </button>
            {filterDropdownOpen && (
              <div
                ref={filterDropdownRef}
                className="fixed bg-white rounded-xl shadow-xl border border-gray-100 z-[9999] py-1 w-40"
                style={{ top: filterPos.top, left: filterPos.left }}
              >
                {TASK_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setTaskFilter(opt.value); setFilterDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      taskFilter === opt.value ? 'font-medium' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                    style={taskFilter === opt.value ? { color: 'var(--accent, #ED64A6)' } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task list */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <DndContext
            sensors={dndEnabled ? sensors : []}
            collisionDetection={closestCenter}
            onDragEnd={dndEnabled ? handleDragEnd : undefined}
          >
            <SortableContext items={allTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {pendingTasks.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {pendingTasks.map((task) =>
                    dndEnabled ? (
                      <DraggableTaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                    ) : (
                      <SimpleTaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                    )
                  )}
                </div>
              )}

              {completedTasks.length > 0 && (
                <div className={pendingTasks.length > 0 ? 'border-t border-gray-100' : ''}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-1">
                    Completed
                  </p>
                  <div className="divide-y divide-gray-50">
                    {completedTasks.map((task) =>
                      dndEnabled ? (
                        <DraggableTaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                      ) : (
                        <SimpleTaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                      )
                    )}
                  </div>
                </div>
              )}
            </SortableContext>
          </DndContext>

          {pendingTasks.length === 0 && completedTasks.length === 0 && (
            <div className="flex flex-col items-center py-12 text-gray-300">
              <ListTodo size={28} strokeWidth={1.5} />
              <p className="text-sm mt-3 text-gray-400">
                {taskFilter !== 'all' ? `No tasks match "${currentFilterLabel}"` : 'No tasks yet'}
              </p>
            </div>
          )}

          {/* Add task input */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a task…"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-300 focus:bg-white transition-all min-w-0 placeholder:text-gray-300"
            />
            <button
              onClick={handleAddTask}
              disabled={!newTask.trim()}
              className="flex items-center gap-1 px-3 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-30 transition-all flex-shrink-0"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-[240px] lg:flex-shrink-0 p-4 lg:p-5 lg:pl-2 overflow-y-auto overflow-x-hidden">

        {/* Overview */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-4">Overview</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={15} className="text-green-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 leading-none">
                  {group.tasks.filter((t) => t.done).length}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Clock size={15} className="text-amber-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 leading-none">
                  {group.tasks.filter((t) => !t.done).length}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Pending</p>
              </div>
            </div>
            {overdueTasks.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={15} className="text-red-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-red-500 leading-none">{overdueTasks.length}</p>
                  <p className="text-xs text-red-400 mt-0.5">Overdue</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Completion card */}
        <div className="rounded-2xl p-4 sm:p-5" style={{ backgroundColor: group.color }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textColor, opacity: 0.6 }}>
            Completion
          </p>
          <p className="font-mono text-4xl font-bold leading-none mb-3" style={{ color: textColor }}>
            {completionPct}%
          </p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.35)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%`, backgroundColor: '#ffffff' }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: textColor, opacity: 0.5 }}>
            {group.tasks.filter((t) => t.done).length} of {group.tasks.length} done
          </p>
        </div>
      </div>

      {/* ── Edit Group Modal ── */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-50 animate-fadeIn">
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full md:max-w-md shadow-xl animate-slideUp md:animate-slideDown max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {/* Drag handle — mobile only */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-1 mb-3 md:hidden" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-semibold">Edit Group</h2>
              <button onClick={() => setEditOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <input
              autoFocus
              type="text"
              placeholder="Group name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-100 mb-5"
            />

            {/* Color */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Color</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {editPaletteToShow.map((color) => (
                  <button
                    key={color}
                    onClick={() => { setEditColor(color); setEditCustomHex(''); }}
                    className="w-7 h-7 rounded-full transition-all duration-150 hover:scale-110"
                    style={{
                      backgroundColor: color,
                      outline: editColor === color ? '3px solid #9CA3AF' : '3px solid transparent',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {editCustomHex && isValidHex(editCustomHex) && (
                  <div className="w-6 h-6 rounded-full flex-shrink-0 border border-gray-200" style={{ backgroundColor: normalizeHex(editCustomHex) }} />
                )}
                <input
                  type="text"
                  placeholder="#hex"
                  value={editCustomHex}
                  onChange={(e) => {
                    setEditCustomHex(e.target.value);
                    if (isValidHex(e.target.value)) setEditColor(normalizeHex(e.target.value));
                  }}
                  maxLength={7}
                  className="w-28 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-sm font-mono outline-none focus:border-gray-400 transition-all"
                />
                {editCustomHex && !isValidHex(editCustomHex) && (
                  <span className="text-xs text-red-400">Invalid</span>
                )}
              </div>
            </div>

            {/* Icon */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
                Icon <span className="normal-case font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-8 gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                {ICON_NAMES.map((name) => {
                  const IconComp = ICON_MAP[name];
                  return (
                    <button
                      key={name}
                      onClick={() => setEditIcon(editIcon === name ? '' : name)}
                      title={name}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                        editIcon === name ? 'text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-white'
                      }`}
                      style={editIcon === name ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
                    >
                      <IconComp size={15} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
                className="px-5 py-2 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
