import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Check, Plus, Loader2, Sparkles, CheckCircle2, Clock, AlertTriangle, Edit2, Eye, Ban } from 'lucide-react';

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
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!code.trim()) { setError('Please enter your invite code'); return; }
    setLoading(true);
    setError('');

    const normalized = code.trim().toUpperCase();

    // Validate invite code
    const { data: invite, error: inviteErr } = await supabase
      .from('shared_client_invites')
      .select('*')
      .eq('shared_client_id', shareRecord.id)
      .eq('code', normalized)
      .maybeSingle();

    if (inviteErr || !invite) {
      setError('Invalid invite code. Please check and try again.');
      setLoading(false);
      return;
    }
    if (invite.status === 'revoked') {
      setError('This invite code has been revoked. Please request a new one.');
      setLoading(false);
      return;
    }
    if (invite.status === 'used') {
      setError('This invite code has already been used.');
      setLoading(false);
      return;
    }

    // Create member row
    const { data: member, error: memberErr } = await supabase
      .from('shared_client_members')
      .insert({ shared_client_id: shareRecord.id, name: name.trim() })
      .select()
      .single();
    if (memberErr) { setError(memberErr.message); setLoading(false); return; }

    // Mark invite code as used
    await supabase
      .from('shared_client_invites')
      .update({ status: 'used', member_id: member.id, member_name: name.trim() })
      .eq('id', invite.id);

    // Notify owner
    await supabase.from('notifications').insert({
      user_id: shareRecord.owner_id,
      message: `${name.trim()} joined ${clientName}`,
    });

    // Persist membership + code ID in localStorage
    localStorage.setItem(
      `workboard_member_${shareRecord.token}`,
      JSON.stringify({ id: member.id, name: member.name, codeId: invite.id })
    );
    onAccept({ id: member.id, name: member.name });
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
          <input
            type="text"
            placeholder="Invite code (e.g. ABCD-EFGH)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleAccept()}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-gray-400 transition-all font-mono tracking-widest uppercase"
          />
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button
            onClick={handleAccept}
            disabled={loading || !name.trim() || !code.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Accept & View
          </button>
          <p className="text-xs text-gray-400 text-center">
            You need an invite code from the workspace owner to join.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Shared dashboard ──────────────────────────────────────────────────────────
function SharedDashboard({ shareRecord, client, tasks, setTasks, member, permission }) {
  const navigate = useNavigate();
  const [newTask, setNewTask] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [filter, setFilter] = useState('all');
  const todayStr = getTodayStr();

  const textColor = ACCENT_TEXT[client.color] || '#374151';
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.done).length;
  const pendingCount = tasks.filter((t) => !t.done).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const overdueTasks = tasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);
  const totalEarned = tasks.filter((t) => t.paid).reduce((s, t) => s + (t.amount || 0), 0);
  const totalPending = tasks.filter((t) => !t.paid && (t.amount || 0) > 0).reduce((s, t) => s + (t.amount || 0), 0);

  const canEdit = permission === 'edit';

  const allFiltered = tasks.filter((t) => {
    if (filter === 'pending') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });
  const pendingTasks = allFiltered.filter((t) => !t.done);
  const completedTasks = allFiltered.filter((t) => t.done);

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
    const { error } = await supabase.from('tasks').update({ paid: newPaid }).eq('id', task.id);
    if (!error) setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, paid: newPaid } : t));
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
        done: false, paid: false, amount: 0, currency: 'NGN', sort_order: maxSort,
      })
      .select().single();
    if (!error && data) {
      setTasks((prev) => [...prev, {
        id: data.id, title: data.title, done: data.done, paid: data.paid,
        amount: data.amount, currency: data.currency, deadline: data.deadline || null,
        sort_order: data.sort_order ?? maxSort,
      }]);
      setNewTask('');
    }
    setAddingTask(false);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#F7F8FA] overflow-hidden max-w-full">

      {/* ── Main column ── */}
      <div className="flex-1 p-4 lg:p-8 lg:pr-4 min-w-0 overflow-y-auto overflow-x-hidden">

        {/* Top bar — WorkBoard logo + "Viewing as" */}
        <div className="flex items-center justify-between mb-6">
          <img src="/favicon.svg" alt="WorkBoard" className="w-8 h-8 rounded-xl opacity-80" />
          <span className="text-xs text-gray-400">
            Viewing as <span className="font-medium text-gray-600">{member.name}</span>
          </span>
        </div>

        {/* Hero banner — identical style to ClientWorkspace */}
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
                {totalTasks} task{totalTasks !== 1 ? 's' : ''} total · shared by {shareRecord.owner_name}
              </p>
            </div>
            {/* Permission badge */}
            <span
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/40"
              style={{ color: textColor }}
            >
              <span className="flex items-center gap-1.5">
                {canEdit ? <Edit2 size={12} /> : <Eye size={12} />}
                {canEdit ? 'Can edit' : 'View only'}
              </span>
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-1.5 mb-4">
          {[
            { value: 'all', label: 'All Tasks' },
            { value: 'pending', label: 'Pending' },
            { value: 'done', label: 'Completed' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === f.value ? 'text-white' : 'bg-white text-gray-500 shadow-sm hover:bg-gray-50'
              }`}
              style={filter === f.value ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Task card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 overflow-hidden">
          <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
            Tasks
            <span className="text-sm font-normal text-gray-400 ml-2">{totalTasks} total</span>
          </h2>

          {pendingTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle2 size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">{filter !== 'all' ? 'No tasks in this filter' : 'No tasks yet.'}</p>
            </div>
          ) : (
            <>
              {pendingTasks.length > 0 && (
                <div className="mb-4">
                  {pendingTasks.map((task) => (
                    <SharedTaskRow key={task.id} task={task} permission={permission}
                      onToggleDone={() => handleToggleDone(task)}
                      onTogglePaid={() => handleTogglePaid(task)} />
                  ))}
                </div>
              )}
              {completedTasks.length > 0 && (
                <div className={pendingTasks.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-4">Completed</p>
                  {completedTasks.map((task) => (
                    <SharedTaskRow key={task.id} task={task} permission={permission}
                      onToggleDone={() => handleToggleDone(task)}
                      onTogglePaid={() => handleTogglePaid(task)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Add task — edit only */}
          {canEdit && (
            <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
              <input
                type="text"
                placeholder="Add a new task..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-all min-w-0"
              />
              <button
                onClick={handleAddTask}
                disabled={!newTask.trim() || addingTask}
                className="flex items-center gap-1.5 px-4 py-2.5 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
                style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
              >
                {addingTask ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar — mirrors ClientWorkspace exactly ── */}
      <div className="w-full lg:w-[260px] lg:flex-shrink-0 p-4 lg:p-5 lg:pl-2 space-y-4 overflow-y-auto overflow-x-hidden">

        {/* Overview */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">Overview</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={16} className="text-green-500" />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">{doneTasks}</p>
                <p className="text-xs text-gray-400">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-amber-500" />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">{pendingCount}</p>
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

        {/* Earnings — only shown to editors with paid tasks */}
        {canEdit && (totalEarned > 0 || totalPending > 0) && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3">Earnings</p>
            <div className="space-y-3">
              {totalEarned > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Total earned</p>
                  <p className="font-mono text-xl font-bold text-green-600">
                    {totalEarned.toLocaleString()}
                  </p>
                </div>
              )}
              {totalPending > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Pending</p>
                  <p className="font-mono text-lg font-semibold text-amber-500">
                    {totalPending.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completion — colored, same as ClientWorkspace */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: client.color }}>
          <p className="text-sm font-semibold mb-3" style={{ color: textColor }}>Completion</p>
          <div className="flex items-end gap-2 mb-2">
            <span className="font-mono text-3xl font-bold" style={{ color: textColor }}>{pct}%</span>
          </div>
          <div className="h-2 bg-white/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: textColor, opacity: 0.6 }}
            />
          </div>
        </div>

        {/* Try WorkBoard CTA */}
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <Sparkles size={20} className="mx-auto mb-2" style={{ color: 'var(--accent, #ED64A6)' }} />
          <p className="text-sm font-semibold text-gray-800 mb-1">Like what you see?</p>
          <p className="text-xs text-gray-400 mb-3">Track your own clients & tasks with WorkBoard.</p>
          <button
            onClick={() => navigate(`/register?from_share=true&token=${shareRecord.token}`)}
            className="w-full py-2.5 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
          >
            Try WorkBoard free
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Access revoked page ───────────────────────────────────────────────────────
function AccessRevokedPage({ token }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-xs">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
          <Ban size={28} className="text-red-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-gray-900 mb-2">Access Revoked</h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          Your access to this workspace has been removed by the owner.
        </p>
        <button
          onClick={() => navigate(`/register?from_share=true&token=${token}`)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
        >
          <Sparkles size={15} />
          Try WorkBoard free
        </button>
        <p className="text-xs text-gray-400 mt-4">
          Create your own workspace and invite your clients.
        </p>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SharedClientPage() {
  const { token } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | error | welcome | dashboard | revoked
  const [shareRecord, setShareRecord] = useState(null);
  const [client, setClient] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [member, setMember] = useState(null);
  const [memberPermission, setMemberPermission] = useState('view');

  useEffect(() => {
    let realtimeChannel;

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
        id: t.id, title: t.title, done: t.done, paid: t.paid,
        amount: t.amount || 0, currency: t.currency || 'NGN',
        deadline: t.deadline || null, sort_order: t.sort_order ?? 0,
      })));

      if (storedMember) {
        // 1. Verify invite code is still valid (not revoked)
        if (storedMember.codeId) {
          const { data: codeRow } = await supabase
            .from('shared_client_invites')
            .select('status')
            .eq('id', storedMember.codeId)
            .maybeSingle();

          if (!codeRow || codeRow.status === 'revoked') {
            localStorage.removeItem(`workboard_member_${token}`);
            setPhase('revoked');
            return;
          }
        }

        // 2. Verify member row still exists
        const { data: memberRow } = await supabase
          .from('shared_client_members')
          .select('id, permission')
          .eq('id', storedMember.id)
          .maybeSingle();

        if (!memberRow) {
          localStorage.removeItem(`workboard_member_${token}`);
          setPhase('revoked');
          return;
        }

        setMember(storedMember);
        setMemberPermission(memberRow.permission || 'view');
        setPhase('dashboard');

        // Realtime: detect kick while actively viewing (invite code revoked)
        realtimeChannel = supabase
          .channel(`member-revoke-${storedMember.id}`)
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'shared_client_members',
              filter: `id=eq.${storedMember.id}`,
            },
            () => {
              localStorage.removeItem(`workboard_member_${token}`);
              setPhase('revoked');
            }
          )
          .subscribe();
      } else {
        setPhase('welcome');
      }
    }

    init();
    return () => { if (realtimeChannel) supabase.removeChannel(realtimeChannel); };
  }, [token]);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (phase === 'error') return <ErrorPage />;

  if (phase === 'revoked') return <AccessRevokedPage token={token} />;

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
