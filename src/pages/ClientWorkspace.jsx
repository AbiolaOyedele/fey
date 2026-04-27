import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, ChevronUp, Plus, Check, CheckCircle2, Clock,
  AlertTriangle, GripVertical, Edit2, Share2, Users, FileText,
  Mail, Phone, Globe, RotateCcw, XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ShareModal from '../components/ShareModal';
import { useAuth } from '../contexts/AuthContext';
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
import ClientFilesCard from '../components/ClientFilesCard';
import { useClientFiles } from '../hooks/useClientFiles';
import { useSettings } from '../contexts/SettingsContext';
import { getContrastColor } from '../utils/colorContrast';

const TASK_FILTER_OPTIONS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'tomorrow', label: 'Due Tomorrow' },
];

function SortableTaskRow({ task, onUpdate, onDelete, dragListeners, dragAttributes, isDragging, clientId }) {
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
        clientId={clientId}
      />
    </div>
  );
}

// Wrapper that provides drag handle listeners to TaskItem
function DraggableTaskItem({ task, onUpdate, onDelete, clientId }) {
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
        clientId={clientId}
      />
    </div>
  );
}

export default function ClientWorkspace({ clients, actions }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatMoney, convertAmount, settings, showToast } = useSettings();
  const { user } = useAuth();
  const client = clients.find((c) => c.id === id);
  const [newTask, setNewTask] = useState('');
  const [retainerOpen, setRetainerOpen] = useState(false);
  // Retainer is stored in client.retainer_currency — display as-is (no conversion for input)
  const formatRetainerInput = (amount) => {
    if (!amount) return '';
    const n = Number(amount);
    return isNaN(n) ? '' : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };
  const [retainerInput, setRetainerInput] = useState(() => formatRetainerInput(client?.retainer));
  const [retainerCurrency, setRetainerCurrency] = useState(client?.retainer_currency || 'NGN');
  const [billingType, setBillingType] = useState(settings[`billing_type_${id}`] || 'retainer');
  const toggleBillingType = () => {
    const next = billingType === 'retainer' ? 'hourly' : 'retainer';
    setBillingType(next);
    settings[`billing_type_${id}`] = next; // lightweight local persist via settings object
  };
  const [editingClient, setEditingClient] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'members'
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [shareRecordId, setShareRecordId] = useState(null);
  const [openMemberMenu, setOpenMemberMenu] = useState(null); // member id whose dropdown is open
  const memberMenuRef = useRef(null);
  const [taskFilter, setTaskFilter] = useState('all');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterPos, setFilterPos] = useState({ top: 0, left: 0 });
  const filterBtnRef = useRef(null);
  const filterDropdownRef = useRef(null);
  const isDraggingRef = useRef(false);

  // File status counts for overview panel
  const { files: allFiles } = useClientFiles(id);
  const amendedFiles  = allFiles.filter((f) => f.status === 'amended');
  const declinedFiles = allFiles.filter((f) => f.status === 'declined');
  const pendingFiles  = allFiles.filter((f) => f.status === 'pending');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Sync retainer input when retainer value or currency changes
  useEffect(() => {
    setRetainerInput(formatRetainerInput(client?.retainer));
    setRetainerCurrency(client?.retainer_currency || 'NGN');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.retainer, client?.retainer_currency]);

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

  // Close member permission dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target)) {
        setOpenMemberMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch members and set up realtime subscription
  useEffect(() => {
    if (!user || !id) return;
    let channel;

    async function fetchShareAndMembers() {
      setMembersLoading(true);
      // Get the share record for this client
      const { data: share } = await supabase
        .from('shared_clients')
        .select('id')
        .eq('client_id', id)
        .eq('owner_id', user.id)
        .eq('active', true)
        .maybeSingle();

      if (!share) { setMembersLoading(false); return; }
      setShareRecordId(share.id);

      // Fetch members
      const { data: mems } = await supabase
        .from('shared_client_members')
        .select('*')
        .eq('shared_client_id', share.id)
        .order('joined_at', { ascending: false });
      setMembers(mems || []);
      setMembersLoading(false);

      // Realtime subscription — unique name per mount to survive StrictMode double-invoke
      try {
        channel = supabase
          .channel(`members-${share.id}-${Date.now()}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'shared_client_members', filter: `shared_client_id=eq.${share.id}` },
            (payload) => {
              setMembers((prev) => [payload.new, ...prev]);
              const memberName = payload.new.name || 'Someone';
              showToast(`${memberName} joined ${client?.name || 'the workspace'}`);
            }
          )
          .subscribe();
      } catch (e) {
        // ignore StrictMode double-invoke errors
      }
    }

    fetchShareAndMembers();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user, id]);

  // Re-fetch members when share modal closes (user may have created/revoked)
  const handleShareModalClose = useCallback(async () => {
    setShareModalOpen(false);
    if (!user || !id) return;
    const { data: share } = await supabase
      .from('shared_clients')
      .select('id')
      .eq('client_id', id)
      .eq('owner_id', user.id)
      .eq('active', true)
      .maybeSingle();
    if (!share) { setShareRecordId(null); setMembers([]); return; }
    setShareRecordId(share.id);
    const { data: mems } = await supabase
      .from('shared_client_members')
      .select('*')
      .eq('shared_client_id', share.id)
      .order('joined_at', { ascending: false });
    setMembers(mems || []);
  }, [user, id]);

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
  const textColor = getContrastColor(client.color);
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

  // Bulk paste: if pasted text has multiple non-empty lines, create a task per line
  const handleTaskPaste = async (e) => {
    const text = e.clipboardData.getData('text');
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return; // single line → let default paste handle it
    e.preventDefault();
    for (const line of lines) {
      await actions.addTask(id, line, settings.currency);
    }
    setNewTask('');
    showToast(`${lines.length} tasks added`);
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

  const handleRetainerInputChange = (val) => {
    // Strip everything except digits and one decimal point
    const raw = val.replace(/,/g, '').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    // Format integer part with commas
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setRetainerInput(parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0]);
  };

  const handleRetainerBlur = () => {
    const parsed = parseFloat(retainerInput.replace(/,/g, '').replace(/[^0-9.]/g, '')) || 0;
    // Store retainer in the chosen retainer currency (no conversion — raw amount)
    actions.updateRetainer(id, parsed, retainerCurrency);
  };

  const handleRetainerCurrencyChange = (newCurrency) => {
    setRetainerCurrency(newCurrency);
    // Persist the currency change immediately (keep existing amount)
    const parsed = parseFloat(retainerInput.replace(/,/g, '').replace(/[^0-9.]/g, '')) || 0;
    if (parsed > 0) actions.updateRetainer(id, parsed, newCurrency);
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
    + paidRetainerMonths * convertAmount(client.retainer || 0, client.retainer_currency || 'NGN');
  const totalPending = client.tasks.filter((t) => !t.paid && t.amount > 0).reduce((s, t) => s + convertAmount(t.amount, t.currency), 0);

  const dndEnabled = taskFilter === 'all';

  const currentFilterLabel = TASK_FILTER_OPTIONS.find((o) => o.value === taskFilter)?.label || 'All Tasks';

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-enter overflow-hidden max-w-full">
      {/* Main content */}
      <div className="flex-1 p-4 lg:p-8 lg:pr-4 min-w-0 overflow-y-auto overflow-x-hidden">
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            {client.logo ? (
              <img src={client.logo} alt={client.name} className="w-14 h-14 rounded-2xl object-contain bg-white p-1 flex-shrink-0" />
            ) : (
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-display font-bold bg-white/50 flex-shrink-0"
                style={{ color: textColor }}
              >
                {client.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-3xl leading-tight font-bold truncate" style={{ color: textColor }}>
                {client.name}
              </h1>
              <p className="text-sm mt-0.5 opacity-70" style={{ color: textColor }}>
                {client.tasks.length} task{client.tasks.length !== 1 ? 's' : ''} total
              </p>
            </div>
            {/* Buttons in banner */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShareModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/40 hover:bg-white/60 transition-colors text-xs font-medium"
                style={{ color: textColor }}
              >
                <Share2 size={13} />
                Share
              </button>
              <button
                onClick={() => navigate('/invoices/new', { state: { prefillClientId: client.id, prefillClient: client, prefillLineItems: [], prefillTaskIds: [] } })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/40 hover:bg-white/60 transition-colors text-xs font-medium"
                style={{ color: textColor }}
              >
                <FileText size={13} />
                Invoice
              </button>
              <button
                onClick={() => setEditingClient(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/40 hover:bg-white/60 transition-colors text-xs font-medium"
                style={{ color: textColor }}
              >
                <Edit2 size={13} />
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Retainer Section + Task Filter */}
        <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-4">
          <div className="bg-white rounded-2xl shadow-sm flex-1 overflow-hidden">
            <button
              onClick={() => setRetainerOpen(!retainerOpen)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span>
                {billingType === 'hourly' ? 'Hourly Rate' : 'Monthly Retainer'}
                {client.retainer > 0 && (
                  <span className="ml-2 font-mono" style={{ color: 'var(--accent, #ED64A6)' }}>
                    {formatMoney(convertAmount(client.retainer, client.retainer_currency || 'NGN'))}
                    {billingType === 'hourly' ? '/hr' : '/mo'}
                  </span>
                )}
              </span>
              {retainerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {retainerOpen && (
              <div className="px-6 pb-5 border-t border-gray-100 pt-4 animate-slideDown">
                {/* Billing type toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={toggleBillingType}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${billingType === 'retainer' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={billingType === 'retainer' ? { backgroundColor: 'var(--accent)' } : {}}
                  >Monthly Retainer</button>
                  <button
                    onClick={toggleBillingType}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${billingType === 'hourly' ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
                    style={billingType === 'hourly' ? { backgroundColor: 'var(--accent)' } : {}}
                  >Hourly Rate</button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    {/* Retainer currency dropdown */}
                    <select
                      value={retainerCurrency}
                      onChange={(e) => handleRetainerCurrencyChange(e.target.value)}
                      className="px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-xs font-medium outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="NGN">₦ NGN</option>
                      <option value="USD">$ USD</option>
                      <option value="GBP">£ GBP</option>
                      <option value="EUR">€ EUR</option>
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={retainerInput}
                      onChange={(e) => handleRetainerInputChange(e.target.value)}
                      onBlur={handleRetainerBlur}
                      placeholder="0"
                      className="w-28 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-primary"
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
          <div className="relative w-full sm:w-auto">
            <button
              ref={filterBtnRef}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setFilterPos({ top: rect.bottom + 4, left: rect.left });
                setFilterDropdownOpen(!filterDropdownOpen);
              }}
              className={`w-full sm:w-auto h-full flex items-center gap-2 px-4 py-3 bg-white rounded-2xl shadow-sm text-sm font-medium whitespace-nowrap transition-colors ${
                taskFilter !== 'all' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={taskFilter !== 'all' ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
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
                    style={taskFilter === opt.value ? { color: 'var(--accent, #ED64A6)' } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task List */}
        {(
        <div className="bg-white rounded-2xl shadow-sm p-6 overflow-hidden">
          <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
            Tasks
            <span className="text-sm font-normal text-gray-400 ml-2">
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
                      <DraggableTaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} clientId={id} />
                    ) : (
                      <TaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} clientId={id} />
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
                      <DraggableTaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} clientId={id} />
                    ) : (
                      <TaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} clientId={id} />
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
              onPaste={handleTaskPaste}
              className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all min-w-0"
            />
            <button
              onClick={handleAddTask}
              disabled={!newTask.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Right Summary Panel */}
      <div className="w-full lg:w-[260px] lg:flex-shrink-0 p-4 lg:p-5 lg:pl-2 overflow-y-auto overflow-x-hidden">
        {/* Client stats */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
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
            {amendedFiles.length > 0 && (
              <button onClick={() => navigate(`/clients/${id}/files`)} className="flex items-center gap-3 w-full text-left hover:bg-amber-50 rounded-xl -mx-2 px-2 py-1 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <RotateCcw size={16} className="text-amber-500" />
                </div>
                <div>
                  <p className="font-mono font-semibold text-amber-600">{amendedFiles.length}</p>
                  <p className="text-xs text-amber-400">Files need amends</p>
                </div>
              </button>
            )}
            {declinedFiles.length > 0 && (
              <button onClick={() => navigate(`/clients/${id}/files`)} className="flex items-center gap-3 w-full text-left hover:bg-red-50 rounded-xl -mx-2 px-2 py-1 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <XCircle size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="font-mono font-semibold text-red-600">{declinedFiles.length}</p>
                  <p className="text-xs text-red-400">Files declined</p>
                </div>
              </button>
            )}
            {pendingFiles.length > 0 && (
              <button onClick={() => navigate(`/clients/${id}/files`)} className="flex items-center gap-3 w-full text-left hover:bg-gray-50 rounded-xl -mx-2 px-2 py-1 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-gray-400" />
                </div>
                <div>
                  <p className="font-mono font-semibold text-gray-700">{pendingFiles.length}</p>
                  <p className="text-xs text-gray-400">Files awaiting review</p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Contact info */}
        {(client.email || client.phone || client.website) && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Contact</p>
            <div className="space-y-2">
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors group"
                >
                  <Mail size={13} className="text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                  <span className="truncate">{client.email}</span>
                </a>
              )}
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors group"
                >
                  <Phone size={13} className="text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                  <span className="truncate">{client.phone}</span>
                </a>
              )}
              {client.website && (
                <a
                  href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 transition-colors group"
                >
                  <Globe size={13} className="text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                  <span className="truncate">{client.website}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Earnings */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
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
        <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: client.color }}>
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

        {/* Members panel */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-700">Members</p>
              {members.length > 0 && (
                <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">{members.length}</span>
              )}
            </div>
            <button
              onClick={() => setShareModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              <Share2 size={11} />
              Share
            </button>
          </div>

          {membersLoading ? (
            <p className="text-xs text-gray-400 text-center py-2">Loading…</p>
          ) : members.length === 0 ? (
            <div className="text-center py-3">
              <Users size={18} className="mx-auto text-gray-200 mb-1.5" />
              <p className="text-xs text-gray-400">No members yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Share this page to invite collaborators</p>
            </div>
          ) : (
            <div ref={memberMenuRef}>
              {members.map((m) => {
                const perm = m.permission || 'view';
                const isOpen = openMemberMenu === m.id;
                return (
                  <div key={m.id} className="flex items-center gap-2.5 py-2.5 border-b border-gray-50 last:border-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: client.color, color: textColor }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{m.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(m.joined_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Permission dropdown */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setOpenMemberMenu(isOpen ? null : m.id)}
                        className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                          perm === 'edit' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {perm === 'edit' ? 'Edit' : 'View'}
                        <ChevronDown size={9} />
                      </button>

                      {isOpen && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fadeIn">
                          {/* View */}
                          <button
                            onClick={async () => {
                              await supabase.from('shared_client_members').update({ permission: 'view' }).eq('id', m.id);
                              setMembers((prev) => prev.map((mem) => mem.id === m.id ? { ...mem, permission: 'view' } : mem));
                              setOpenMemberMenu(null);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${perm === 'view' ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                            View only
                            {perm === 'view' && <Check size={10} className="ml-auto text-gray-400" />}
                          </button>
                          {/* Edit */}
                          <button
                            onClick={async () => {
                              await supabase.from('shared_client_members').update({ permission: 'edit' }).eq('id', m.id);
                              setMembers((prev) => prev.map((mem) => mem.id === m.id ? { ...mem, permission: 'edit' } : mem));
                              setOpenMemberMenu(null);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${perm === 'edit' ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            Can edit
                            {perm === 'edit' && <Check size={10} className="ml-auto text-gray-400" />}
                          </button>
                          {/* Divider + Remove */}
                          <div className="border-t border-gray-100 mx-2" />
                          <button
                            onClick={async () => {
                              // Revoke their invite code first (blocks re-entry)
                              await supabase
                                .from('shared_client_invites')
                                .update({ status: 'revoked' })
                                .eq('member_id', m.id);
                              // Then remove the member row (triggers realtime on their page)
                              await supabase.from('shared_client_members').delete().eq('id', m.id);
                              setMembers((prev) => prev.filter((mem) => mem.id !== m.id));
                              setOpenMemberMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                            Remove member
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Files card */}
        <ClientFilesCard clientId={id} />
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

      {shareModalOpen && user && (
        <ShareModal
          client={client}
          userId={user.id}
          onClose={handleShareModalClose}
        />
      )}
    </div>
  );
}
