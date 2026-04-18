import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Check, Plus, Loader2, Sparkles, CheckCircle2, Clock, AlertTriangle, ChevronDown } from 'lucide-react';

const ACCENT_TEXT = {
  '#FDE8E8': '#92400E', '#FEF3C7': '#78350F', '#D1FAE5': '#065F46',
  '#DBEAFE': '#1E3A8A', '#EDE9FE': '#5B21B6', '#FCE7F3': '#9D174D',
  '#ECFDF5': '#047857', '#FFF7ED': '#9A3412', '#F0FDF4': '#166534',
  '#E0F2FE': '#0C4A6E', '#F5F3FF': '#4C1D95', '#FFF1F2': '#9F1239',
  '#ECFEFF': '#164E63', '#FEFCE8': '#713F12', '#F7FEE7': '#365314',
  '#FDF4FF': '#701A75', '#F0F9FF': '#0C4A6E', '#E6FFFA': '#134E4A',
  '#EEF2FF': '#312E81', '#FFF9F0': '#7C2D12',
};

function getTodayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Read-only task row ────────────────────────────────────────────────────────
function SharedTaskRow({ task, permission, onToggleDone, onTogglePaid }) {
  const todayStr = getTodayStr();
  const isOverdue = !task.done && task.deadline && task.deadline < todayStr;
  const isToday = !task.done && task.deadline === todayStr;
  const canEdit = permission === 'edit';

  return (
    <div className={`flex items-center gap-3 py-3 px-4 rounded-xl transition-all ${
      task.done ? 'opacity-60' : ''
    } ${isOverdue && !task.done ? 'border-l-2 border-red-300 pl-3' : ''}`}>
      {/* Checkbox */}
      <span
        role="checkbox"
        aria-checked={task.done}
        onClick={canEdit ? onToggleDone : undefined}
        className={`rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
        } ${task.done ? 'border-green-500 bg-green-500' : 'border-gray-200'}`}
        style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {task.done && <Check size={10} strokeWidth={3} className="text-white" />}
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium break-words ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
          {task.title}
        </p>
        {task.deadline && (
          <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-400' : isToday ? 'text-amber-500' : 'text-gray-400'}`}>
            {isOverdue ? 'Overdue · ' : isToday ? 'Due today · ' : 'Due '}{formatDate(task.deadline)}
          </p>
        )}
      </div>

      {/* Paid toggle — edit only */}
      {canEdit && task.done && (
        <button
          onClick={onTogglePaid}
          className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
            task.paid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {task.paid ? 'Paid' : 'Unpaid'}
        </button>
      )}
    </div>
  );
}

// ── Error page ────────────────────────────────────────────────────────────────
function ErrorPage({ message = 'This link is no longer available.' }) {
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-6 text-center">
      <img src="/favicon.svg" alt="WorkBoard" className="w-9 h-9 rounded-xl mb-8" />
      <p className="font-display text-2xl font-bold text-gray-900 mb-2">Link Unavailable</p>
      <p className="text-gray-500 text-sm max-w-xs">{message}</p>
    </div>
  );
}

// ── Welcome page ──────────────────────────────────────────────────────────────
function WelcomePage({ shareRecord, clientName, onAccept }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('shared_client_members')
      .insert({ shared_client_id: shareRecord.id, name: name.trim() })
      .select()
      .single();
    if (err) { setError(err.message); setLoading(false); return; }

    // Insert notification for owner
    await supabase.from('notifications').insert({
      user_id: shareRecord.owner_id,
      message: `${name.trim()} joined ${clientName}`,
    });

    // Persist membership in localStorage
    localStorage.setItem(
      `workboard_member_${shareRecord.token}`,
      JSON.stringify({ id: data.id, name: data.name })
    );
    onAccept({ id: data.id, name: data.name });
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <img src="/favicon.svg" alt="WorkBoard" className="w-8 h-8 rounded-xl mb-8 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-gray-900 text-center mb-1">
          {shareRecord.owner_name} has shared
        </h1>
        <p className="font-display text-2xl font-bold text-center mb-8" style={{ color: 'var(--accent, #ED64A6)' }}>
          {clientName}
        </p>
        <p className="text-sm text-gray-500 text-center mb-6">
          Enter your name to access the shared workspace.
        </p>

        <div className="space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAccept()}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 transition-all"
          />
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button
            onClick={handleAccept}
            disabled={loading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Accept & View
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared dashboard ──────────────────────────────────────────────────────────
function SharedDashboard({ shareRecord, client, tasks, setTasks, member, permission }) {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newTask, setNewTask] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [filter, setFilter] = useState('all');
  const todayStr = getTodayStr();

  const textColor = ACCENT_TEXT[client.color] || '#374151';
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.done).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const pendingTasks = filteredTasks.filter((t) => !t.done);
  const completedTasks = filteredTasks.filter((t) => t.done);

  const canEdit = permission === 'edit';

  const handleToggleDone = async (task) => {
    const newDone = !task.done;
    const { error } = await supabase
      .from('tasks')
      .update({ done: newDone, paid: newDone ? task.paid : false })
      .eq('id', task.id);
    if (!error) {
      setTasks((prev) =>
        prev.map((t) => t.id === task.id ? { ...t, done: newDone, paid: newDone ? t.paid : false } : t)
      );
    }
  };

  const handleTogglePaid = async (task) => {
    const newPaid = !task.paid;
    const { error } = await supabase
      .from('tasks')
      .update({ paid: newPaid })
      .eq('id', task.id);
    if (!error) {
      setTasks((prev) =>
        prev.map((t) => t.id === task.id ? { ...t, paid: newPaid } : t)
      );
    }
  };

  const handleAddTask = async () => {
    if (!newTask.trim() || !canEdit) return;
    setAddingTask(true);
    const maxSort = tasks.length > 0 ? Math.max(...tasks.map((t) => t.sort_order ?? 0)) + 1 : 0;
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        client_id: client.id,
        user_id: shareRecord.owner_id,
        title: newTask.trim(),
        done: false,
        paid: false,
        amount: 0,
        currency: 'NGN',
        sort_order: maxSort,
      })
      .select()
      .single();
    if (!error && data) {
      setTasks((prev) => [...prev, {
        id: data.id,
        title: data.title,
        done: data.done,
        paid: data.paid,
        amount: data.amount,
        currency: data.currency,
        deadline: data.deadline || null,
        sort_order: data.sort_order ?? maxSort,
      }]);
      setNewTask('');
    }
    setAddingTask(false);
  };

  const totalEarned = tasks.filter((t) => t.paid).reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Header banner */}
      <div className="w-full p-4 sm:p-6" style={{ backgroundColor: client.color }}>
        <div className="max-w-2xl mx-auto">
          {/* Logo + member name */}
          <div className="flex items-center justify-between mb-4">
            <img src="/favicon.svg" alt="WorkBoard" className="w-7 h-7 rounded-lg opacity-80" />
            <p className="text-xs font-medium opacity-60" style={{ color: textColor }}>
              Viewing as {member.name}
            </p>
          </div>

          {/* Client info */}
          <div className="flex items-center gap-3">
            {client.logo ? (
              <img src={client.logo} alt={client.name} className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 flex-shrink-0" />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold bg-white/40 flex-shrink-0"
                style={{ color: textColor }}
              >
                {client.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-display text-xl font-bold leading-tight" style={{ color: textColor }}>
                {client.name}
              </h1>
              <p className="text-xs opacity-60" style={{ color: textColor }}>
                Shared by {shareRecord.owner_name}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium opacity-60" style={{ color: textColor }}>
                {doneTasks} of {totalTasks} tasks complete
              </span>
              <span className="text-xs font-mono font-bold" style={{ color: textColor }}>{pct}%</span>
            </div>
            <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: textColor, opacity: 0.6 }}
              />
            </div>
          </div>

          {/* Earnings — edit only */}
          {canEdit && totalEarned > 0 && (
            <p className="text-xs mt-3 font-medium opacity-60" style={{ color: textColor }}>
              Total earned: {totalEarned.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {/* Filter + view-only label */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1.5">
            {['all', 'pending', 'done'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  filter === f ? 'text-white' : 'bg-white text-gray-500 shadow-sm'
                }`}
                style={filter === f ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          {!canEdit && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
              View only
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {pendingTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle2 size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No tasks</p>
            </div>
          ) : (
            <>
              {pendingTasks.length > 0 && (
                <div className="py-2">
                  {pendingTasks.map((task) => (
                    <SharedTaskRow
                      key={task.id}
                      task={task}
                      permission={permission}
                      onToggleDone={() => handleToggleDone(task)}
                      onTogglePaid={() => handleTogglePaid(task)}
                    />
                  ))}
                </div>
              )}
              {completedTasks.length > 0 && (
                <div className={`py-2 ${pendingTasks.length > 0 ? 'border-t border-gray-100' : ''}`}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider px-4 py-2">Completed</p>
                  {completedTasks.map((task) => (
                    <SharedTaskRow
                      key={task.id}
                      task={task}
                      permission={permission}
                      onToggleDone={() => handleToggleDone(task)}
                      onTogglePaid={() => handleTogglePaid(task)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Add task — edit only */}
          {canEdit && (
            <div className="border-t border-gray-100 flex items-center gap-2 px-4 py-3">
              <input
                type="text"
                placeholder="Add a task..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-300"
              />
              <button
                onClick={handleAddTask}
                disabled={!newTask.trim() || addingTask}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                {addingTask ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Try WorkBoard FAB */}
      <button
        onClick={() => navigate(`/register?from_share=true&token=${shareRecord.token}`)}
        className="fixed bottom-5 right-5 flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-xs font-semibold shadow-lg hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
      >
        <Sparkles size={13} />
        Try WorkBoard free
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SharedClientPage() {
  const { token } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | error | welcome | dashboard
  const [shareRecord, setShareRecord] = useState(null);
  const [client, setClient] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [member, setMember] = useState(null);
  const [memberPermission, setMemberPermission] = useState('view');

  useEffect(() => {
    async function init() {
      const stored = localStorage.getItem(`workboard_member_${token}`);
      const storedMember = stored ? JSON.parse(stored) : null;

      // Fetch share record — no auth required (RLS disabled)
      const { data: share, error: shareErr } = await supabase
        .from('shared_clients')
        .select('*')
        .eq('token', token)
        .eq('active', true)
        .maybeSingle();

      if (shareErr || !share) { setPhase('error'); return; }
      setShareRecord(share);

      // Build client object from cached fields in shared_clients
      // (avoids needing to read the clients table which has RLS enabled)
      const clientObj = {
        id: share.client_id,
        name: share.client_name || 'Shared Workspace',
        color: share.client_color || '#D1FAE5',
        logo: share.client_logo || '',
      };
      setClient(clientObj);

      // Fetch tasks — requires tasks table RLS to be disabled
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('client_id', share.client_id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      setTasks((tasksData || []).map((t) => ({
        id: t.id,
        title: t.title,
        done: t.done,
        paid: t.paid,
        amount: t.amount || 0,
        currency: t.currency || 'NGN',
        deadline: t.deadline || null,
        sort_order: t.sort_order ?? 0,
      })));

      if (storedMember) {
        setMember(storedMember);
        // Fetch per-member permission if set
        const { data: memberRow } = await supabase
          .from('shared_client_members')
          .select('permission')
          .eq('id', storedMember.id)
          .maybeSingle();
        setMemberPermission(memberRow?.permission || share.permission || 'view');
        setPhase('dashboard');
      } else {
        setPhase('welcome');
      }
    }
    init();
  }, [token]);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (phase === 'error') return <ErrorPage />;

  if (phase === 'welcome') {
    return (
      <WelcomePage
        shareRecord={shareRecord}
        clientName={client?.name || ''}
        onAccept={(m) => {
          setMember(m);
          setMemberPermission(shareRecord?.permission || 'view');
          setPhase('dashboard');
        }}
      />
    );
  }

  return (
    <SharedDashboard
      shareRecord={shareRecord}
      client={client}
      tasks={tasks}
      setTasks={setTasks}
      member={member}
      permission={memberPermission}
    />
  );
}
