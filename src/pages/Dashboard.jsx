import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Settings, ArrowRight, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, Users, CreditCard,
  AlertTriangle, TriangleAlert, Calendar,
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getContrastColor } from '../utils/colorContrast';

const CARD_COLS = {
  small: 'lg:grid-cols-3',
  medium: 'lg:grid-cols-2',
  large: 'lg:grid-cols-1',
};

function formatDeadline(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTodayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function daysDiff(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((today - d) / 86400000);
}

// ── Swipeable Activity / Task-tracker card ──────────────────────────────────
function SwipeCard({ allTasks, tasksDone, tasksPending, earnedThisMonth, monthlyActivity, maxEarned, currentMonth, formatMoney, todayStr }) {
  const [panel, setPanel] = useState(0); // 0 = Activity, 1 = Tasks
  const PANELS = 2;
  const touchStartX = useRef(null);
  const mouseStartX = useRef(null);
  const isDragging = useRef(false);

  // Touch (mobile)
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) setPanel((p) => diff > 0 ? Math.min(p + 1, PANELS - 1) : Math.max(p - 1, 0));
    touchStartX.current = null;
  };

  // Mouse drag (desktop)
  const handleMouseDown = (e) => { mouseStartX.current = e.clientX; isDragging.current = true; };
  const handleMouseUp = (e) => {
    if (!isDragging.current || mouseStartX.current === null) return;
    const diff = mouseStartX.current - e.clientX;
    if (Math.abs(diff) > 40) setPanel((p) => diff > 0 ? Math.min(p + 1, PANELS - 1) : Math.max(p - 1, 0));
    mouseStartX.current = null;
    isDragging.current = false;
  };
  const handleMouseLeave = () => { mouseStartX.current = null; isDragging.current = false; };

  const totalTasks = allTasks.length;
  const overdueTasks = allTasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr);
  const dueTodayTasks = allTasks.filter((t) => !t.done && t.deadline === todayStr);
  const completionPct = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;
  // SVG ring
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (completionPct / 100) * circ;

  return (
    <div
      className="hidden md:block bg-white rounded-2xl shadow-sm mb-4 overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
    >
      {/* Slide track */}
      <div
        className="flex transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${panel * 100}%)` }}
      >
        {/* ── Panel 0: Activity ── */}
        <div className="min-w-full p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-700">Activity</p>
            <span className="text-xs text-gray-400">6 months</span>
          </div>
          <Link to="/payments" className="block">
            <p className="font-mono text-xl font-bold text-gray-900 mb-1 truncate">{formatMoney(earnedThisMonth)}</p>
            <p className="text-xs font-medium mb-4" style={{ color: 'var(--accent, #ED64A6)' }}>This month</p>
            <div className="flex items-end gap-1.5 h-24">
              {monthlyActivity.map((m) => {
                const isCurrentMonth = m.key === currentMonth;
                const height = m.earned > 0 ? Math.max((m.earned / maxEarned) * 100, 8) : 4;
                const colors = ['#FDE8E8', '#D1FAE5', '#DBEAFE', '#EDE9FE', '#FEF3C7'];
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-md transition-all duration-300 relative overflow-hidden" style={{ height: `${height}%` }}>
                      {colors.map((color, ci) => (
                        <div key={ci} className="w-full" style={{ height: `${100 / colors.length}%`, backgroundColor: color, opacity: m.earned > 0 ? 1 : 0.3 }} />
                      ))}
                      {isCurrentMonth && <div className="absolute inset-0 ring-2 rounded-md" style={{ '--tw-ring-color': `var(--accent, #ED64A6)40` }} />}
                    </div>
                    <span className={`text-xs ${isCurrentMonth ? 'font-semibold' : 'text-gray-400'}`} style={isCurrentMonth ? { color: 'var(--accent, #ED64A6)' } : {}}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Link>
        </div>

        {/* ── Panel 1: Task tracker ── */}
        <div className="min-w-full p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Tasks</p>
            <span className="text-xs text-gray-400">{totalTasks} total</span>
          </div>
          {totalTasks === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No tasks yet</p>
          ) : (
            <div className="flex items-center gap-4">
              {/* Progress ring */}
              <div className="relative flex-shrink-0">
                <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
                  <circle cx="36" cy="36" r={r} fill="none" stroke="#F3F4F6" strokeWidth="7" />
                  <circle
                    cx="36" cy="36" r={r} fill="none"
                    stroke="var(--accent, #ED64A6)" strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    style={{ transition: 'stroke-dasharray 0.4s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-mono text-sm font-bold text-gray-800">{completionPct}%</span>
                </div>
              </div>
              {/* Breakdown */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Done
                  </span>
                  <span className="text-xs font-mono font-semibold text-gray-800">{tasksDone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Pending
                  </span>
                  <span className="text-xs font-mono font-semibold text-gray-800">{tasksPending}</span>
                </div>
                {dueTodayTasks.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-500 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />Due today
                    </span>
                    <span className="text-xs font-mono font-semibold text-amber-600">{dueTodayTasks.length}</span>
                  </div>
                )}
                {overdueTasks.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-red-500 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Overdue
                    </span>
                    <span className="text-xs font-mono font-semibold text-red-500">{overdueTasks.length}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav row: arrow ← dots → arrow */}
      <div className="flex items-center justify-center gap-3 pb-3" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => setPanel((p) => Math.max(p - 1, 0))}
          disabled={panel === 0}
          className="w-5 h-5 flex items-center justify-center rounded-full transition-colors disabled:opacity-20 text-gray-400 hover:text-gray-600 disabled:cursor-default"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="flex items-center gap-1.5">
          {[0, 1].map((i) => (
            <span
              key={i}
              onClick={() => setPanel(i)}
              className="rounded-full cursor-pointer transition-all duration-200"
              style={{
                display: 'block',
                width: i === panel ? '14px' : '5px',
                height: '5px',
                backgroundColor: i === panel ? 'var(--accent, #ED64A6)' : '#D1D5DB',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setPanel((p) => Math.min(p + 1, PANELS - 1))}
          disabled={panel === PANELS - 1}
          className="w-5 h-5 flex items-center justify-center rounded-full transition-colors disabled:opacity-20 text-gray-400 hover:text-gray-600 disabled:cursor-default"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ clients, actions }) {
  const [filter, setFilter] = useState('All');
  const [bellOpen, setBellOpen] = useState(false);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [bellPos, setBellPos] = useState({ top: 0, right: 0 });
  const [overduePos, setOverduePos] = useState({ top: 0, right: 0 });
  const [fileAlerts, setFileAlerts] = useState([]); // [{file, clientId, clientName, status}]
  const bellRef = useRef(null);
  const overdueRef = useRef(null);
  const { settings, formatMoney, convertAmount } = useSettings();
  const { user } = useAuth();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = getTodayStr();

  // Fetch file alerts: amended + declined + pending files across all clients
  useEffect(() => {
    if (!clients.length) return;
    const clientIds = clients.map((c) => c.id);
    const fetchAlerts = async () => {
      const [cf, tf] = await Promise.all([
        supabase.from('client_files').select('id,file_name,status,client_id,created_at').in('client_id', clientIds).in('status', ['amended', 'declined', 'pending']),
        supabase.from('task_files').select('id,file_name,status,client_id,created_at,task_id').in('client_id', clientIds).in('status', ['amended', 'declined', 'pending']),
      ]);
      const all = [
        ...(cf.data || []).map((f) => ({ ...f, _source: 'client' })),
        ...(tf.data || []).map((f) => ({ ...f, _source: 'task' })),
      ].map((f) => ({
        ...f,
        clientName: clients.find((c) => c.id === f.client_id)?.name || '',
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setFileAlerts(all);
    };
    fetchAlerts();
  }, [clients]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (overdueRef.current && !overdueRef.current.contains(e.target)) setOverdueOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allTasks = clients.flatMap((c) =>
    c.tasks.map((t) => ({ ...t, clientId: c.id, clientName: c.name, clientColor: c.color }))
  );

  const tasksDone = allTasks.filter((t) => t.done).length;
  const tasksPending = allTasks.filter((t) => !t.done).length;

  // Deadline groupings for bell
  const dueTodayTasks = allTasks.filter((t) => !t.done && t.deadline === todayStr);
  const upcomingTasks = allTasks.filter((t) => !t.done && t.deadline && t.deadline > todayStr)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 10);
  const overdueTasks = allTasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const bellBadge = dueTodayTasks.length + fileAlerts.filter((f) => f.status === 'amended' || f.status === 'declined').length;
  const overdueBadge = overdueTasks.length;

  // Only show Overdue tab when there are overdue tasks
  const visibleFilters = overdueBadge > 0
    ? ['All', 'Active', 'Completed', 'Overdue', 'Unpaid']
    : ['All', 'Active', 'Completed', 'Unpaid'];

  // Reset filter if Overdue tab disappears
  useEffect(() => {
    if (filter === 'Overdue' && overdueBadge === 0) setFilter('All');
  }, [filter, overdueBadge]);

  const earnedThisMonth = clients.reduce((sum, client) => {
    const taskEarnings = client.tasks
      .filter((t) => t.paid && t.createdAt.startsWith(currentMonth))
      .reduce((s, t) => s + convertAmount(t.amount, t.currency), 0);
    const retainerEarning = client.retainerPaid?.[currentMonth] ? convertAmount(client.retainer, client.retainer_currency || 'NGN') : 0;
    return sum + taskEarnings + retainerEarning;
  }, 0);

  // Filter clients for All tab grid
  const filteredClients = clients.filter((c) => {
    if (filter === 'All') return true;
    if (filter === 'Active') return c.tasks.some((t) => !t.done);
    if (filter === 'Completed') return c.tasks.length > 0 && c.tasks.every((t) => t.done);
    if (filter === 'Overdue') return c.tasks.some((t) => !t.done && t.deadline && t.deadline < todayStr);
    if (filter === 'Unpaid') return c.tasks.some((t) => t.done && !t.paid);
    return true;
  });

  const topClients = filteredClients.slice(0, 6);

  // Flat task list for non-All tabs
  const flatTaskList = filter !== 'All' ? clients.flatMap((c) =>
    c.tasks
      .filter((t) => {
        if (filter === 'Active') return !t.done;
        if (filter === 'Completed') return t.done;
        if (filter === 'Overdue') return !t.done && t.deadline && t.deadline < todayStr;
        if (filter === 'Unpaid') return t.done && !t.paid;
        return false;
      })
      .map((t) => ({ ...t, clientId: c.id, clientName: c.name, clientColor: c.color }))
  ) : [];

  // Group flat tasks by client
  const tasksByClient = filter !== 'All' ? clients
    .map((c) => ({ client: c, tasks: flatTaskList.filter((t) => t.clientId === c.id) }))
    .filter((g) => g.tasks.length > 0) : [];

  // Activity data for mini bar chart (last 6 months)
  const monthlyActivity = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const earned = clients.reduce((sum, client) => {
      const te = client.tasks
        .filter((t) => t.paid && t.createdAt.startsWith(key))
        .reduce((s, t) => s + convertAmount(t.amount, t.currency), 0);
      const re = client.retainerPaid?.[key] ? convertAmount(client.retainer, client.retainer_currency || 'NGN') : 0;
      return sum + te + re;
    }, 0);
    monthlyActivity.push({ label, earned, key });
  }
  const maxEarned = Math.max(...monthlyActivity.map((m) => m.earned), 1);

  // Top 3 clients by earnings
  const topEarningClients = [...clients]
    .map((c) => ({
      ...c,
      totalEarned: c.tasks.filter((t) => t.paid).reduce((s, t) => s + convertAmount(t.amount, t.currency), 0),
      completionPct: c.tasks.length > 0
        ? Math.round((c.tasks.filter((t) => t.done).length / c.tasks.length) * 100)
        : 0,
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, 3);

  const heading = (settings.dashboard_heading || 'Track your\nwork & earnings').replace(/\\n/g, '\n');
  const gridColsDesktop = CARD_COLS[settings.card_size] || 'lg:grid-cols-2';

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-enter overflow-x-hidden">
      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 lg:p-8 lg:pr-4 overflow-y-auto min-w-0">
        {/* Hero heading */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1
                className="font-display text-2xl md:text-3xl lg:text-[2.75rem] leading-tight font-bold text-gray-900"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {heading}
              </h1>
              {settings.dashboard_subtitle && (
                <p className="text-gray-500 text-sm mt-2">{settings.dashboard_subtitle}</p>
              )}
            </div>
            {/* Action icons — mobile only (desktop shows them in right panel) */}
            <div className="lg:hidden flex items-center gap-2 flex-shrink-0 pt-1">
              {overdueBadge > 0 && (
                <div ref={overdueRef}>
                  <button
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setOverduePos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                      setOverdueOpen(!overdueOpen);
                      setBellOpen(false);
                    }}
                    className="relative w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 shadow-sm transition-colors"
                  >
                    <TriangleAlert size={16} />
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                      {overdueBadge > 9 ? '9+' : overdueBadge}
                    </span>
                  </button>
                  {overdueOpen && (
                    <div
                      className="fixed w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-[9999] overflow-hidden"
                      style={{ top: overduePos.top, right: overduePos.right }}
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-red-600">Overdue Tasks</p>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {overdueTasks.map((task) => (
                          <Link
                            key={task.id}
                            to={`/clients/${task.clientId}`}
                            onClick={() => setOverdueOpen(false)}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                              <p className="text-xs text-gray-400">{task.clientName}</p>
                            </div>
                            <span className="text-xs text-red-500 font-medium flex-shrink-0">
                              {daysDiff(task.deadline)}d ago
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div ref={bellRef}>
                <button
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setBellPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                    setBellOpen(!bellOpen);
                    setOverdueOpen(false);
                  }}
                  className="relative w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors"
                >
                  <Bell size={16} />
                  {bellBadge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                      {bellBadge > 9 ? '9+' : bellBadge}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <div
                    className="fixed w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-[9999] overflow-hidden"
                    style={{ top: bellPos.top, right: bellPos.right }}
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-700">Notifications</p>
                    </div>
                    {dueTodayTasks.length === 0 && upcomingTasks.length === 0 && fileAlerts.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">All clear — nothing needs attention</div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        {/* File alerts — amended + declined first */}
                        {fileAlerts.filter((f) => f.status === 'amended' || f.status === 'declined').length > 0 && (
                          <>
                            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-amber-600 uppercase tracking-wider">Files Need Attention</p>
                            {fileAlerts.filter((f) => f.status === 'amended' || f.status === 'declined').map((f) => (
                              <Link
                                key={f.id}
                                to={`/clients/${f.client_id}/files`}
                                onClick={() => setBellOpen(false)}
                                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                              >
                                <span className={`mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${f.status === 'amended' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                                  {f.status === 'amended' ? 'Amend' : 'Declined'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{f.file_name}</p>
                                  <p className="text-xs text-gray-400">{f.clientName}</p>
                                </div>
                              </Link>
                            ))}
                          </>
                        )}
                        {/* Pending files */}
                        {fileAlerts.filter((f) => f.status === 'pending').length > 0 && (
                          <>
                            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Awaiting Review</p>
                            {fileAlerts.filter((f) => f.status === 'pending').slice(0, 5).map((f) => (
                              <Link
                                key={f.id}
                                to={`/clients/${f.client_id}/files`}
                                onClick={() => setBellOpen(false)}
                                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                              >
                                <span className="mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">Pending</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{f.file_name}</p>
                                  <p className="text-xs text-gray-400">{f.clientName}</p>
                                </div>
                              </Link>
                            ))}
                          </>
                        )}
                        {dueTodayTasks.length > 0 && (
                          <>
                            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-amber-600 uppercase tracking-wider">Due Today</p>
                            {dueTodayTasks.map((task) => (
                              <Link
                                key={task.id}
                                to={`/clients/${task.clientId}`}
                                onClick={() => setBellOpen(false)}
                                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                              >
                                <Calendar size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                                  <p className="text-xs text-gray-400">{task.clientName}</p>
                                </div>
                              </Link>
                            ))}
                          </>
                        )}
                        {upcomingTasks.length > 0 && (
                          <>
                            <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Upcoming Deadlines</p>
                            {upcomingTasks.map((task) => (
                              <Link
                                key={task.id}
                                to={`/clients/${task.clientId}`}
                                onClick={() => setBellOpen(false)}
                                className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                              >
                                <Calendar size={14} className="text-gray-300 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                                  <p className="text-xs text-gray-400">{task.clientName}</p>
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0">{formatDeadline(task.deadline)}</span>
                              </Link>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter pills — desktop */}
        <div className="hidden md:flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {visibleFilters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 flex-shrink-0 ${
                filter === f
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
              style={filter === f ? { backgroundColor: f === 'Overdue' ? '#EF4444' : 'var(--accent, #ED64A6)' } : {}}
            >
              {f === 'All' && <Users size={14} />}
              {f === 'Active' && <Clock size={14} />}
              {f === 'Completed' && <CheckCircle2 size={14} />}
              {f === 'Overdue' && <AlertTriangle size={14} />}
              {f === 'Unpaid' && <CreditCard size={14} />}
              {f}
              {f === 'Overdue' && overdueBadge > 0 && filter !== 'Overdue' && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                  {overdueBadge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter dropdown — mobile */}
        <div className="md:hidden mb-6">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl outline-none"
            style={{ color: 'var(--accent, #ED64A6)' }}
          >
            {visibleFilters.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* All tab: client cards grid */}
        {filter === 'All' && (
          <>
            <p className="text-sm text-gray-500 font-medium mb-4">{settings.clients_label || 'Clients'}</p>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridColsDesktop} gap-4`}>
              {topClients.map((client) => {
                const doneTasks = client.tasks.filter((t) => t.done).length;
                const totalTasks = client.tasks.length;
                const paidAmount = client.tasks
                  .filter((t) => t.paid)
                  .reduce((s, t) => s + convertAmount(t.amount, t.currency), 0);
                const textColor = getContrastColor(client.color);
                const hasOverdue = client.tasks.some((t) => !t.done && t.deadline && t.deadline < todayStr);

                return (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="group rounded-2xl p-4 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden"
                    style={{ backgroundColor: client.color }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/60 backdrop-blur-sm"
                        style={{ color: textColor }}
                      >
                        <Users size={12} />
                        {doneTasks}/{totalTasks} tasks
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-red-100/80 text-red-600">
                            <AlertTriangle size={10} />
                            Overdue
                          </span>
                        )}
                        {paidAmount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-white/70 text-success">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            {formatMoney(paidAmount)}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3
                      className="font-display text-xl font-bold mb-1 leading-snug"
                      style={{ color: textColor }}
                    >
                      {client.name}
                    </h3>
                    <p className="text-sm mb-4 opacity-70" style={{ color: textColor }}>
                      {doneTasks} completed, {totalTasks - doneTasks} pending
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <div className="h-1.5 bg-white/40 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%`,
                              backgroundColor: textColor,
                              opacity: 0.5,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {client.logo ? (
                          <img src={client.logo} alt={client.name} className="w-8 h-8 rounded-full object-contain bg-white p-0.5" />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-white/50"
                            style={{ color: textColor }}
                          >
                            {client.name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {clients.length > 6 && (
              <Link
                to="/clients"
                className="flex items-center gap-1.5 text-sm font-medium mt-4 hover:gap-2.5 transition-all"
                style={{ color: 'var(--accent, #ED64A6)' }}
              >
                View all clients <ArrowRight size={14} />
              </Link>
            )}
          </>
        )}

        {/* Non-All tabs: flat task list grouped by client */}
        {filter !== 'All' && (
          <div className="space-y-5 overflow-hidden min-w-0">
            {tasksByClient.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-lg">No tasks</p>
                <p className="text-sm mt-1">Nothing to show in the {filter} view</p>
              </div>
            )}
            {tasksByClient.map(({ client, tasks }) => {
              const textColor = getContrastColor(client.color);
              return (
                <div key={client.id} className="overflow-hidden min-w-0">
                  <Link
                    to={`/clients/${client.id}`}
                    className="flex items-center gap-2 mb-2 hover:opacity-70 transition-opacity min-w-0"
                  >
                    {client.logo ? (
                      <img src={client.logo} alt={client.name} className="w-5 h-5 rounded-md object-contain bg-white flex-shrink-0" />
                    ) : (
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: client.color, color: textColor }}
                      >
                        {client.name.charAt(0)}
                      </div>
                    )}
                    <span className="text-sm font-semibold text-gray-700 truncate">{client.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
                  </Link>
                  <div className="space-y-1.5 pl-1 overflow-hidden min-w-0">
                    {tasks.map((task) => {
                      const isTaskOverdue = task.deadline && task.deadline < todayStr && !task.done;
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border-l-4 shadow-sm min-w-0 w-full"
                          style={{ borderLeftColor: client.color }}
                        >
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className={`text-sm font-medium truncate ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {task.title}
                            </p>
                            {task.deadline && (
                              <p className={`text-xs truncate ${isTaskOverdue ? 'text-red-500 font-medium' : task.deadline === todayStr ? 'text-amber-500' : 'text-gray-400'}`}>
                                {isTaskOverdue ? `${daysDiff(task.deadline)}d overdue` : `Due: ${formatDeadline(task.deadline)}`}
                              </p>
                            )}
                          </div>
                          {task.amount > 0 && (
                            <span className="text-xs font-mono text-gray-500 flex-shrink-0">
                              {formatMoney(convertAmount(task.amount, task.currency))}
                            </span>
                          )}
                          {task.done && (
                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                              task.paid ? 'bg-success/10 text-success' : 'bg-pending/10 text-pending'
                            }`}>
                              {task.paid ? 'Paid' : 'Unpaid'}
                            </span>
                          )}
                          {isTaskOverdue && (
                            <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Summary Panel */}
      <div className="w-full lg:w-[260px] lg:flex-shrink-0 p-4 lg:pl-2 overflow-y-auto overflow-x-hidden">

        {/* Top bar: overdue + bell + settings — desktop only */}
        <div className="hidden lg:flex items-center justify-end gap-2 mb-6">
          {overdueBadge > 0 && (
            <div ref={overdueRef}>
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setOverduePos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                  setOverdueOpen(!overdueOpen);
                  setBellOpen(false);
                }}
                className="relative w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 shadow-sm transition-colors"
              >
                <TriangleAlert size={16} />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                  {overdueBadge > 9 ? '9+' : overdueBadge}
                </span>
              </button>
              {overdueOpen && (
                <div
                  className="fixed w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-[9999] overflow-hidden"
                  style={{ top: overduePos.top, right: overduePos.right }}
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-red-600">Overdue Tasks</p>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {overdueTasks.map((task) => (
                      <Link
                        key={task.id}
                        to={`/clients/${task.clientId}`}
                        onClick={() => setOverdueOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                          <p className="text-xs text-gray-400">{task.clientName}</p>
                        </div>
                        <span className="text-xs text-red-500 font-medium flex-shrink-0">
                          {daysDiff(task.deadline)}d ago
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={bellRef}>
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setBellPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                setBellOpen(!bellOpen);
                setOverdueOpen(false);
              }}
              className="relative w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors"
            >
              <Bell size={16} />
              {bellBadge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                  {bellBadge > 9 ? '9+' : bellBadge}
                </span>
              )}
            </button>
            {bellOpen && (
              <div
                className="fixed w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-[9999] overflow-hidden"
                style={{ top: bellPos.top, right: bellPos.right }}
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">Upcoming Deadlines</p>
                </div>
                {dueTodayTasks.length === 0 && upcomingTasks.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">No upcoming deadlines</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {dueTodayTasks.length > 0 && (
                      <>
                        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-amber-600 uppercase tracking-wider">Due Today</p>
                        {dueTodayTasks.map((task) => (
                          <Link key={task.id} to={`/clients/${task.clientId}`} onClick={() => setBellOpen(false)}
                            className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                          >
                            <Calendar size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                              <p className="text-xs text-gray-400">{task.clientName}</p>
                            </div>
                          </Link>
                        ))}
                      </>
                    )}
                    {upcomingTasks.length > 0 && (
                      <>
                        <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Upcoming</p>
                        {upcomingTasks.map((task) => (
                          <Link key={task.id} to={`/clients/${task.clientId}`} onClick={() => setBellOpen(false)}
                            className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <Calendar size={14} className="text-gray-300 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                              <p className="text-xs text-gray-400">{task.clientName}</p>
                            </div>
                            <span className="text-xs text-gray-400 flex-shrink-0">{formatDeadline(task.deadline)}</span>
                          </Link>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <Link to="/settings" className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors">
            <Settings size={16} />
          </Link>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 text-center">
          {settings.logo ? (
            <img
              src={settings.logo}
              alt="Logo"
              className="w-20 h-20 rounded-2xl mx-auto mt-2 mb-2 object-contain bg-white p-1"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl mx-auto mt-2 mb-2 flex items-center justify-center text-white text-2xl font-display font-bold"
              style={{ background: `linear-gradient(135deg, var(--accent, #ED64A6)99, var(--accent, #ED64A6))` }}
            >
              {(settings.username || 'A').charAt(0).toUpperCase()}
            </div>
          )}
          <h3 className="font-display font-bold text-lg text-gray-900">{settings.username}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{settings.company_name}</p>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
            <Link to="/clients" className="text-center hover:opacity-70 transition-opacity">
              <p className="font-mono font-semibold text-gray-900">{clients.length}</p>
              <p className="text-xs text-gray-400">{settings.clients_label || 'Clients'}</p>
            </Link>
            <Link to="/clients" className="text-center hover:opacity-70 transition-opacity">
              <p className="font-mono font-semibold text-gray-900">{tasksDone}</p>
              <p className="text-xs text-gray-400">Done</p>
            </Link>
            <Link to="/clients" className="text-center hover:opacity-70 transition-opacity">
              <p className="font-mono font-semibold text-gray-900">{tasksPending}</p>
              <p className="text-xs text-gray-400">Pending</p>
            </Link>
          </div>
        </div>

        {/* Activity / Task tracker — swipeable card, hidden on mobile */}
        <SwipeCard
          allTasks={allTasks}
          tasksDone={tasksDone}
          tasksPending={tasksPending}
          earnedThisMonth={earnedThisMonth}
          monthlyActivity={monthlyActivity}
          maxEarned={maxEarned}
          currentMonth={currentMonth}
          formatMoney={formatMoney}
          todayStr={todayStr}
        />

        {/* My clients list */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">My {(settings.clients_label || 'Clients').toLowerCase()}</p>
            <Link to="/clients" className="text-xs hover:underline" style={{ color: 'var(--accent, #ED64A6)' }}>
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {topEarningClients.map((client) => (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {client.logo ? (
                  <img src={client.logo} alt={client.name} className="w-10 h-10 rounded-xl object-contain bg-white p-1 flex-shrink-0" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      backgroundColor: client.color,
                      color: getContrastColor(client.color),
                    }}
                  >
                    {client.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{client.name}</p>
                  <p className="text-xs text-gray-400">
                    {client.tasks.length} task{client.tasks.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-xs font-mono font-medium px-2 py-0.5 rounded-lg"
                    style={{
                      backgroundColor: client.color,
                      color: getContrastColor(client.color),
                    }}
                  >
                    {client.completionPct}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
