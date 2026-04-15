import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, ChevronUp, Plus, CheckCircle2, Clock,
  AlertTriangle, GripVertical, Edit2,
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
import TaskItem from '../components/TaskItem';
import EditClientModal from '../components/EditClientModal';
import { useSettings } from '../contexts/SettingsContext';

const ACCENT_TEXT = {
  '#FDE8E8': '#92400E',
  '#FEF3C7': '#78350F',
  '#D1FAE5': '#065F46',
  '#DBEAFE': '#1E3A8A',
  '#EDE9FE': '#5B21B6',
  '#FCE7F3': '#9D174D',
  '#ECFDF5': '#047857',
  '#FFF7ED': '#9A3412',
  '#F0FDF4': '#166534',
  '#E0F2FE': '#0C4A6E',
  '#F5F3FF': '#4C1D95',
  '#FFF1F2': '#9F1239',
  '#ECFEFF': '#164E63',
  '#FEFCE8': '#713F12',
  '#F7FEE7': '#365314',
  '#FDF4FF': '#701A75',
  '#F0F9FF': '#0C4A6E',
  '#E6FFFA': '#134E4A',
  '#EEF2FF': '#312E81',
  '#FFF9F0': '#7C2D12',
};

const TASK_FILTER_OPTIONS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'tomorrow', label: 'Due Tomorrow' },
];

function SortableTaskRow({ task, onUpdate, onDelete, dragListeners, dragAttributes, isDragging }) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragListeners={dragListeners}
        dragAttributes={dragAttributes}
      />
    </div>
  );
}

// Wrapper that provides drag handle listeners to TaskItem
function DraggableTaskItem({ task, onUpdate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragListeners={listeners}
        dragAttributes={attributes}
      />
    </div>
  );
}

export default function ClientWorkspace({ clients, actions }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatMoney, convertAmount, settings } = useSettings();
  const client = clients.find((c) => c.id === id);
  const [newTask, setNewTask] = useState('');
  const [retainerOpen, setRetainerOpen] = useState(false);
  const formatRetainerInput = (retainerNGN) => {
    if (!retainerNGN) return '';
    const val = convertAmount(retainerNGN, 'NGN');
    return settings.currency === 'USD'
      ? val.toFixed(2)
      : Math.round(val).toLocaleString();
  };
  const [retainerInput, setRetainerInput] = useState(() => formatRetainerInput(client?.retainer));
  const [editingClient, setEditingClient] = useState(false);
  const [taskFilter, setTaskFilter] = useState('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterPos, setFilterPos] = useState({ top: 0, left: 0 });
  const filterBtnRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const isDraggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Sync retainer input when currency or retainer value changes
  useEffect(() => {
    setRetainerInput(formatRetainerInput(client?.retainer));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.retainer, settings.currency]);

  // Close filter dropdown on outside click
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

  if (!client) {
    return (
      <div className="p-8 page-enter text-center py-20">
        <p className="text-gray-400 text-lg">Client not found</p>
        <button onClick={() => navigate('/clients')} className="text-primary text-sm mt-2 hover:underline">
          Back to Clients
        </button>
      </div>
    );
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const textColor = ACCENT_TEXT[client.color] || '#374151';
  const retainerPaidThisMonth = client.retainerPaid?.[currentMonth] || false;

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
    await actions.addTask(id, newTask.trim(), settings.currency);
    setNewTask('');
  };

  const handleUpdateTask = async (updatedTask) => {
    await actions.updateTask(id, updatedTask.id, {
      title: updatedTask.title,
      done: updatedTask.done,
      paid: updatedTask.paid,
      amount: updatedTask.amount,
      currency: updatedTask.currency,
      deadline: updatedTask.deadline,
    });
  };

  const handleDeleteTask = async (taskId) => {
    await actions.deleteTask(id, taskId);
  };

  const handleSetRetainer = async (amount) => {
    await actions.updateRetainer(id, parseInt(amount) || 0);
  };

  const handleRetainerInputChange = (val) => {
    if (settings.currency === 'USD') {
      // Allow decimals for USD
      const cleaned = val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
      setRetainerInput(cleaned);
    } else {
      const digits = val.replace(/[^0-9]/g, '');
      setRetainerInput(digits === '' ? '' : parseInt(digits, 10).toLocaleString());
    }
  };

  const handleRetainerBlur = () => {
    const parsed = parseFloat(retainerInput.replace(/[^0-9.]/g, '')) || 0;
    // Always store retainer in NGN — back-convert if currently viewing in USD
    const inNGN = settings.currency === 'USD'
      ? Math.round(parsed * (Number(settings.exchange_rate) || 1357))
      : Math.round(parsed);
    handleSetRetainer(inNGN);
  };

  const handleToggleRetainerPaid = async () => {
    const newPaid = !retainerPaidThisMonth;
    await actions.toggleRetainerPaid(id, currentMonth, newPaid);
  };

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setTimeout(() => { isDraggingRef.current = false; }, 500);
    if (!over || active.id === over.id) return;
    const oldIndex = client.tasks.findIndex((t) => t.id === active.id);
    const newIndex = client.tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(client.tasks, oldIndex, newIndex);
    actions.reorderTasks(id, newOrder.map((t) => t.id));
  }, [client.tasks, actions, id]);

  const allTasks = [...client.tasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const filterTaskList = (tasks) => {
    if (taskFilter === 'all') return tasks;
    if (taskFilter === 'overdue') return tasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);
    if (taskFilter === 'today') return tasks.filter((t) => t.deadline === todayStr);
    if (taskFilter === 'tomorrow') return tasks.filter((t) => t.deadline === tomorrowStr);
    return tasks;
  };

  const pendingTasks = filterTaskList(allTasks.filter((t) => !t.done));
  const completedTasks = filterTaskList(allTasks.filter((t) => t.done));
  const overdueTasks = allTasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);

  const paidRetainerMonths = Object.values(client.retainerPaid || {}).filter(Boolean).length;
  const totalEarned = client.tasks.filter((t) => t.paid).reduce((s, t) => s + convertAmount(t.amount, t.currency), 0)
    + paidRetainerMonths * convertAmount(client.retainer || 0, 'NGN');
  const totalPending = client.tasks.filter((t) => !t.paid && t.amount > 0).reduce((s, t) => s + convertAmount(t.amount, t.currency), 0);

  const dndEnabled = taskFilter === 'all';

  const currentFilterLabel = TASK_FILTER_OPTIONS.find((o) => o.value === taskFilter)?.label || 'All Tasks';

  return (
    <div className="flex min-h-screen page-enter overflow-hidden max-w-full">
      {/* Main content */}
      <div className="flex-1 p-8 pr-4 min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Back link */}
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Clients
        </button>

        {/* Hero header */}
        <div className="rounded-2xl p-6 mb-6 overflow-hidden" style={{ backgroundColor: client.color }}>
          <div className="flex items-center gap-4">
            {client.logo ? (
              <img src={client.logo} alt={client.name} className="w-14 h-14 rounded-2xl object-cover bg-white/50 flex-shrink-0" />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-display font-bold bg-white/50 flex-shrink-0"
                style={{ color: textColor }}
              >
                {client.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl font-bold truncate" style={{ color: textColor }}>
                {client.name}
              </h1>
              <p className="text-sm mt-0.5 opacity-70" style={{ color: textColor }}>
                {client.tasks.length} task{client.tasks.length !== 1 ? 's' : ''} total
              </p>
            </div>
            {/* Edit button in banner */}
            <button
              onClick={() => setEditingClient(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/40 hover:bg-white/60 transition-colors text-xs font-medium flex-shrink-0"
              style={{ color: textColor }}
            >
              <Edit2 size={13} />
              Edit
            </button>
          </div>
        </div>

        {/* Retainer Section + Task Filter */}
        <div className="flex items-stretch gap-2 mb-4">
          <div className="bg-white rounded-2xl shadow-sm flex-1 overflow-hidden">
            <button
              onClick={() => setRetainerOpen(!retainerOpen)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span>
                Monthly Retainer
                {client.retainer > 0 && (
                  <span className="ml-2 font-mono" style={{ color: 'var(--accent, #667EEA)' }}>
                    {formatMoney(convertAmount(client.retainer, 'NGN'))}
                  </span>
                )}
              </span>
              {retainerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {retainerOpen && (
              <div className="px-6 pb-5 border-t border-gray-100 pt-4 animate-slideDown">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-gray-400">{settings.currency || 'NGN'}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={retainerInput}
                      onChange={(e) => handleRetainerInputChange(e.target.value)}
                      onBlur={handleRetainerBlur}
                      placeholder="0"
                      className="w-32 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                    <button
                      onClick={handleToggleRetainerPaid}
                      disabled={!client.retainer}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                        retainerPaidThisMonth
                          ? 'bg-success text-white'
                          : client.retainer
                          ? 'bg-gray-100 text-gray-500 hover:bg-pending/20 hover:text-pending'
                          : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      {retainerPaidThisMonth ? 'Paid' : 'Mark Paid'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Task filter button */}
          <div className="relative">
            <button
              ref={filterBtnRef}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setFilterPos({ top: rect.bottom + 4, left: rect.left });
                setFilterDropdownOpen(!filterDropdownOpen);
              }}
              className={`h-full flex items-center gap-2 px-4 py-3 bg-white rounded-2xl shadow-sm text-sm font-medium whitespace-nowrap transition-colors ${
                taskFilter !== 'all' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={taskFilter !== 'all' ? { backgroundColor: 'var(--accent, #667EEA)' } : {}}
            >
              {currentFilterLabel}
              <ChevronDown size={14} />
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
                      taskFilter === opt.value
                        ? 'font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    style={taskFilter === opt.value ? { color: 'var(--accent, #667EEA)' } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task List */}
        <div className="bg-white rounded-2xl shadow-sm p-6 overflow-hidden">
          <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
            Tasks
            <span className="text-sm font-sans font-normal text-gray-400 ml-2">
              {client.tasks.length} total
            </span>
          </h2>

          <DndContext
            sensors={dndEnabled ? sensors : []}
            collisionDetection={closestCenter}
            onDragStart={dndEnabled ? handleDragStart : undefined}
            onDragEnd={dndEnabled ? handleDragEnd : undefined}
          >
            <SortableContext items={allTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {/* Pending tasks */}
              {pendingTasks.length > 0 && (
                <div className="mb-4">
                  {pendingTasks.map((task) => (
                    dndEnabled ? (
                      <DraggableTaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                    ) : (
                      <TaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                    )
                  ))}
                </div>
              )}

              {/* Completed tasks */}
              {completedTasks.length > 0 && (
                <div className={pendingTasks.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-4">Completed</p>
                  {completedTasks.map((task) => (
                    dndEnabled ? (
                      <DraggableTaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                    ) : (
                      <TaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
                    )
                  ))}
                </div>
              )}
            </SortableContext>
          </DndContext>

          {pendingTasks.length === 0 && completedTasks.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">
              {taskFilter !== 'all' ? `No tasks in "${currentFilterLabel}" filter` : 'No tasks yet. Add one below.'}
            </p>
          )}

          {/* Add Task */}
          <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
            <input
              type="text"
              placeholder="Add a new task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all min-w-0"
            />
            <button
              onClick={handleAddTask}
              disabled={!newTask.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
              style={{ backgroundColor: 'var(--accent, #667EEA)' }}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Right Summary Panel */}
      <div className="w-[260px] flex-shrink-0 p-5 pl-2 overflow-y-auto overflow-x-hidden">
        {/* Client stats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-4">Overview</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={16} className="text-success" />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">{client.tasks.filter((t) => t.done).length}</p>
                <p className="text-xs text-gray-400">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pending/10 flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-pending" />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">{client.tasks.filter((t) => !t.done).length}</p>
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
        </div>

        {/* Earnings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Earnings</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Total earned</p>
              <p className="font-mono text-xl font-bold text-success truncate">
                {formatMoney(totalEarned)}
              </p>
            </div>
            {totalPending > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Pending</p>
                <p className="font-mono text-lg font-semibold text-pending truncate">
                  {formatMoney(totalPending)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Completion */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: client.color }}>
          <p className="text-sm font-semibold mb-3" style={{ color: textColor }}>
            Completion
          </p>
          <div className="flex items-end gap-2 mb-2">
            <span className="font-mono text-3xl font-bold" style={{ color: textColor }}>
              {client.tasks.length > 0
                ? Math.round((client.tasks.filter((t) => t.done).length / client.tasks.length) * 100)
                : 0}%
            </span>
          </div>
          <div className="h-2 bg-white/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${client.tasks.length > 0 ? (client.tasks.filter((t) => t.done).length / client.tasks.length) * 100 : 0}%`,
                backgroundColor: textColor,
                opacity: 0.6,
              }}
            />
          </div>
        </div>
      </div>

      {editingClient && (
        <EditClientModal
          client={client}
          onClose={() => setEditingClient(false)}
          onSave={async (updates) => {
            await actions.updateClient(client.id, updates);
            setEditingClient(false);
          }}
        />
      )}
    </div>
  );
}
