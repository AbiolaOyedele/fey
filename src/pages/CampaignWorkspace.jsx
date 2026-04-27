import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, GripVertical, Edit2, Check, Layers,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskItem from '../components/TaskItem';
import { useCampaigns } from '../hooks/useCampaigns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { getContrastColor } from '../utils/colorContrast';
import { PALETTE } from '../data/defaultClients';

const normalizeHex = (v) => v.trim().startsWith('#') ? v.trim() : `#${v.trim()}`;
const isValidHex   = (v) => /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(v));

const TASK_FILTER_OPTIONS = [
  { value: 'all',      label: 'All Tasks' },
  { value: 'overdue',  label: 'Overdue' },
  { value: 'today',    label: 'Due Today' },
  { value: 'tomorrow', label: 'Due Tomorrow' },
];

function SortableTaskRow({ task, onUpdate, onDelete }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragListeners={listeners}
        dragAttributes={attributes}
        clientId={null}
      />
    </div>
  );
}

export default function CampaignWorkspace({ clients }) {
  const { id: clientId, campaignId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings, showToast, formatMoney, convertAmount } = useSettings();

  const client   = clients?.find((c) => c.id === clientId);
  const clientColor = client?.color || 'var(--accent, #ED64A6)';
  const textColor   = getContrastColor(clientColor);

  const { campaigns, updateCampaign, addTask, updateTask, deleteTask, reorderTasks, addTasksBulk } = useCampaigns(clientId, user?.id);
  const campaign = campaigns.find((c) => c.id === campaignId);

  const [newTask, setNewTask]               = useState('');
  const [taskFilter, setTaskFilter]         = useState('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterPos, setFilterPos]           = useState({ top: 0, left: 0 });
  const filterBtnRef    = useRef(null);
  const filterDropdownRef = useRef(null);
  const isDraggingRef   = useRef(false);

  // Edit campaign name inline
  const [editing, setEditing]         = useState(false);
  const [editName, setEditName]       = useState('');
  const [editCustomHex, setEditCustomHex] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    const handler = (e) => {
      if (
        filterDropdownRef.current && !filterDropdownRef.current.contains(e.target) &&
        filterBtnRef.current && !filterBtnRef.current.contains(e.target)
      ) setFilterDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!client) return (
    <div className="p-8 text-center py-20">
      <p className="text-gray-400">Client not found</p>
    </div>
  );

  if (campaigns.length > 0 && !campaign) return (
    <div className="p-8 text-center py-20">
      <p className="text-gray-400">Campaign not found</p>
      <button onClick={() => navigate(`/clients/${clientId}`)} className="text-sm mt-2 hover:underline" style={{ color: clientColor }}>
        Back to {client.name}
      </button>
    </div>
  );

  if (!campaign) return null; // still loading

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();
  const tomorrowStr = (() => {
    const n = new Date(); n.setDate(n.getDate() + 1);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const allTasks = [...(campaign.tasks || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const filterTaskList = (tasks) => {
    if (taskFilter === 'overdue')  return tasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);
    if (taskFilter === 'today')    return tasks.filter((t) => t.deadline === todayStr);
    if (taskFilter === 'tomorrow') return tasks.filter((t) => t.deadline === tomorrowStr);
    return tasks;
  };

  const pendingTasks   = filterTaskList(allTasks.filter((t) => !t.done));
  const completedTasks = filterTaskList(allTasks.filter((t) => t.done));
  const overdueTasks   = allTasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);

  const totalEarned  = allTasks.filter((t) => t.paid).reduce((s, t) => s + convertAmount(t.amount || 0, t.currency || 'NGN'), 0);
  const totalPending = allTasks.filter((t) => !t.paid && (t.amount || 0) > 0).reduce((s, t) => s + convertAmount(t.amount || 0, t.currency || 'NGN'), 0);

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    await addTask(campaignId, newTask.trim(), settings.currency);
    setNewTask('');
  };

  const handleTaskPaste = async (e) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    await addTasksBulk(campaignId, lines, settings.currency);
    setNewTask('');
    showToast(`${lines.length} tasks added`);
  };

  const handleUpdateTask = async (updated) => {
    await updateTask(campaignId, updated.id, {
      title: updated.title, done: updated.done, paid: updated.paid,
      amount: updated.amount, currency: updated.currency, deadline: updated.deadline,
    });
  };

  const handleDeleteTask = async (taskId) => {
    await deleteTask(campaignId, taskId);
  };

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setTimeout(() => { isDraggingRef.current = false; }, 500);
    if (!over || active.id === over.id) return;
    const oldI = allTasks.findIndex((t) => t.id === active.id);
    const newI = allTasks.findIndex((t) => t.id === over.id);
    if (oldI === -1 || newI === -1) return;
    const reordered = arrayMove(allTasks, oldI, newI);
    reorderTasks(campaignId, reordered.map((t) => t.id));
  }, [allTasks, campaignId, reorderTasks]);

  const currentFilterLabel = TASK_FILTER_OPTIONS.find((o) => o.value === taskFilter)?.label || 'All Tasks';

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-enter overflow-hidden max-w-full">
      {/* Main content */}
      <div className="flex-1 p-4 lg:p-8 lg:pr-4 min-w-0 overflow-y-auto overflow-x-hidden">

        {/* Back + header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(`/clients/${clientId}`)}
            className="flex items-center gap-1.5 text-sm font-medium mb-4 hover:gap-2.5 transition-all"
            style={{ color: clientColor }}
          >
            <ArrowLeft size={15} /> Back to {client.name}
          </button>

          <div className="flex items-center gap-3">
            {/* Color dot */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: clientColor }}>
              <Layers size={18} style={{ color: textColor }} />
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editName.trim()) { updateCampaign(campaignId, { name: editName.trim() }); setEditing(false); }
                      if (e.key === 'Escape') setEditing(false);
                    }}
                    className="font-display text-xl font-bold text-gray-900 bg-transparent border-b-2 outline-none w-full"
                    style={{ borderColor: clientColor }}
                  />
                  <button onClick={() => { if (editName.trim()) { updateCampaign(campaignId, { name: editName.trim() }); } setEditing(false); }}>
                    <Check size={16} style={{ color: clientColor }} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold text-gray-900 truncate">{campaign.name}</h1>
                  <button onClick={() => { setEditName(campaign.name); setEditing(true); }} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-400">{client.name} · Campaign</p>
            </div>
          </div>
        </div>

        {/* Task filter + list */}
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
          {/* Filter row */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">Tasks</p>
            <div className="relative" ref={filterBtnRef}>
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setFilterPos({ top: rect.bottom + 6, left: rect.left });
                  setFilterDropdownOpen((v) => !v);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {currentFilterLabel}
                <ChevronDown size={12} />
              </button>
            </div>
          </div>

          {filterDropdownOpen && (
            <div
              ref={filterDropdownRef}
              className="fixed bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-1 w-40"
              style={{ top: filterPos.top, left: filterPos.left }}
            >
              {TASK_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setTaskFilter(opt.value); setFilterDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                    taskFilter === opt.value ? 'text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                  style={taskFilter === opt.value ? { color: clientColor } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Pending tasks with DnD */}
          {taskFilter === 'all' && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={() => { isDraggingRef.current = true; }}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={pendingTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {pendingTasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    onUpdate={handleUpdateTask}
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {taskFilter !== 'all' && pendingTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onUpdate={handleUpdateTask}
              onDelete={() => handleDeleteTask(task.id)}
              clientId={null}
            />
          ))}

          {/* Completed tasks (collapsible) */}
          {completedTasks.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs font-semibold text-gray-400 cursor-pointer select-none list-none flex items-center gap-1.5 py-2">
                <ChevronDown size={12} />
                {completedTasks.length} completed
              </summary>
              <div className="opacity-60 mt-1">
                {completedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onUpdate={handleUpdateTask}
                    onDelete={() => handleDeleteTask(task.id)}
                    clientId={null}
                  />
                ))}
              </div>
            </details>
          )}

          {pendingTasks.length === 0 && completedTasks.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No tasks yet. Add one below.</p>
          )}

          {/* Add task input */}
          <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
            <input
              type="text"
              placeholder="Add a new task…"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              onPaste={handleTaskPaste}
              className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none transition-all min-w-0"
              style={{ '--tw-ring-color': clientColor }}
              onFocus={(e) => { e.target.style.borderColor = clientColor; }}
              onBlur={(e) => { e.target.style.borderColor = ''; }}
            />
            <button
              onClick={handleAddTask}
              disabled={!newTask.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
              style={{ backgroundColor: clientColor }}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-full lg:w-[240px] lg:flex-shrink-0 p-4 lg:p-5 lg:pl-2 overflow-y-auto">
        {/* Overview */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-4">Overview</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${clientColor}18` }}>
                <CheckCircle2 size={16} style={{ color: clientColor }} />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">{allTasks.filter((t) => t.done).length}</p>
                <p className="text-xs text-gray-400">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-gray-400" />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">{allTasks.filter((t) => !t.done).length}</p>
                <p className="text-xs text-gray-400">Pending</p>
              </div>
            </div>
            {overdueTasks.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="font-mono font-semibold text-red-600">{overdueTasks.length}</p>
                  <p className="text-xs text-red-400">Overdue</p>
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {allTasks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-400">Progress</p>
                <p className="text-xs font-mono font-semibold text-gray-700">
                  {Math.round((allTasks.filter((t) => t.done).length / allTasks.length) * 100)}%
                </p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(allTasks.filter((t) => t.done).length / allTasks.length) * 100}%`,
                    backgroundColor: clientColor,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Earnings */}
        {(totalEarned > 0 || totalPending > 0) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">Earnings</p>
            <div className="space-y-3">
              {totalEarned > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Total earned</p>
                  <p className="font-mono text-xl font-bold text-green-600 truncate">{formatMoney(totalEarned)}</p>
                </div>
              )}
              {totalPending > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Pending</p>
                  <p className="font-mono text-lg font-semibold text-amber-500 truncate">{formatMoney(totalPending)}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
