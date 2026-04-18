import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings, CheckCircle2, Clock, AlertTriangle,
  Calendar, ChevronRight, ArrowRight,
  TriangleAlert, ListChecks,
} from 'lucide-react';
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
};

function getTodayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function formatDeadline(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function daysDiff(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((today - d) / 86400000);
}

// ── Completion Ring ───────────────────────────────────────────────────────────
function CompletionRing({ pct, done, total, size = 80, strokeWidth = 7 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--accent, #ED64A6)" strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold text-gray-900 text-lg leading-none">{pct}%</span>
        <span className="text-[10px] text-gray-400 mt-0.5">{done}/{total}</span>
      </div>
    </div>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────
function TaskRow({ task, todayStr, onToggle }) {
  const [pending, setPending] = useState(false);
  const isOverdue = !task.done && task.deadline && task.deadline < todayStr;
  const isDueToday = !task.done && task.deadline === todayStr;
  const daysOver = isOverdue ? daysDiff(task.deadline) : 0;

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (!onToggle || pending) return;
    setPending(true);
    await onToggle(!task.done);
    setPending(false);
  };

  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 transition-opacity ${task.done ? 'opacity-50' : ''}`}>
      {/* Checkbox */}
      <span
        role="checkbox"
        aria-checked={task.done}
        onClick={handleToggle}
        className={`mt-0.5 flex-shrink-0 rounded-md border-2 flex items-center justify-center cursor-pointer transition-colors ${
          task.done
            ? 'border-green-500 bg-green-500'
            : isOverdue
              ? 'border-red-300 hover:border-red-400'
              : isDueToday
                ? 'border-amber-400 hover:border-amber-500'
                : 'border-gray-200 hover:border-gray-400'
        } ${pending ? 'opacity-50' : ''}`}
        style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        {task.done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 3.5L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      <p className={`flex-1 text-sm min-w-0 select-none ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {task.title}
      </p>

      {task.deadline && !task.done && (
        <span className={`text-xs flex-shrink-0 font-medium px-1.5 py-0.5 rounded-md ${
          isOverdue ? 'bg-red-50 text-red-500' : isDueToday ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
        }`}>
          {isOverdue ? `${daysOver}d overdue` : isDueToday ? 'Today' : formatDeadline(task.deadline)}
        </span>
      )}
    </div>
  );
}

// ── Group card ────────────────────────────────────────────────────────────────
function GroupCard({ group, todayStr, expanded, onToggle, onToggleTask }) {
  const textColor = ACCENT_TEXT[group.color] || '#374151';
  const total = group.tasks.length;
  const done = group.tasks.filter((t) => t.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const overdue = group.tasks.filter((t) => !t.done && t.deadline && t.deadline < todayStr).length;
  const dueToday = group.tasks.filter((t) => !t.done && t.deadline === todayStr).length;

  const sortedTasks = [...group.tasks].sort((a, b) => {
    const rank = (t) => {
      if (t.done) return 3;
      if (t.deadline && t.deadline < todayStr) return 0;
      if (t.deadline === todayStr) return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm border border-white/60"
      style={{ backgroundColor: group.color }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {/* Icon / initial */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.4)', color: textColor }}
        >
          {group.icon || group.name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm leading-tight truncate" style={{ color: textColor }}>
            {group.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs opacity-60" style={{ color: textColor }}>{done}/{total} done</span>
            {overdue > 0 && (
              <span className="text-xs font-semibold text-red-600 bg-red-100/70 px-1.5 py-0.5 rounded-md">
                {overdue} overdue
              </span>
            )}
            {dueToday > 0 && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded-md">
                {dueToday} today
              </span>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:flex flex-col items-end gap-1 w-20">
            <span className="text-xs font-mono font-bold" style={{ color: textColor }}>{pct}%</span>
            <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: textColor, opacity: 0.6 }}
              />
            </div>
          </div>
          <ChevronRight
            size={14}
            className="transition-transform duration-200"
            style={{ color: textColor, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      {/* Expanded task list */}
      {expanded && (
        <div className="bg-white/70 backdrop-blur-sm mx-3 mb-3 rounded-xl px-3 py-1">
          {sortedTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No tasks yet</p>
          ) : (
            sortedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                todayStr={todayStr}
                onToggle={onToggleTask ? (done) => onToggleTask(group.id, task.id, { done }) : null}
              />
            ))
          )}
          <Link
            to={`/tasks/${group.id}`}
            className="flex items-center justify-center gap-1 text-xs font-medium py-2 mt-1 hover:opacity-70 transition-opacity"
            style={{ color: textColor }}
          >
            Open group <ArrowRight size={11} />
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Standalone tasks panel ────────────────────────────────────────────────────
function StandalonePanel({ tasks, todayStr, onToggleTask }) {
  if (!tasks || tasks.length === 0) return null;
  const sorted = [...tasks].sort((a, b) => {
    const rank = (t) => {
      if (t.done) return 3;
      if (t.deadline && t.deadline < todayStr) return 0;
      if (t.deadline === todayStr) return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });
  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <ListChecks size={14} className="text-gray-400" />
        <p className="text-sm font-semibold text-gray-700">Standalone Tasks</p>
      </div>
      <div className="px-4 pb-3">
        {sorted.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            todayStr={todayStr}
            onToggle={onToggleTask ? (done) => onToggleTask(task.id, { done }) : null}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function TaskDashboard({ groups = [], standaloneTasks = [], onToggleGroupTask, onToggleStandaloneTask }) {
  const { settings } = useSettings();
  const todayStr = getTodayStr();
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [bellPos, setBellPos] = useState({ top: 0, right: 0 });
  const [overduePos, setOverduePos] = useState({ top: 0, right: 0 });
  const bellRef = useRef(null);
  const overdueRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (overdueRef.current && !overdueRef.current.contains(e.target)) setOverdueOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Flatten all tasks from groups + standalone
  const allGroupTasks = groups.flatMap((g) =>
    g.tasks.map((t) => ({ ...t, groupId: g.id, groupName: g.name, groupColor: g.color }))
  );
  const allStandalone = (standaloneTasks || []).map((t) => ({ ...t, groupId: null, groupName: 'Standalone' }));
  const allTasks = [...allGroupTasks, ...allStandalone];

  const total = allTasks.length;
  const done = allTasks.filter((t) => t.done).length;
  const pending = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const overdueTasks = allTasks
    .filter((t) => !t.done && t.deadline && t.deadline < todayStr)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const dueTodayTasks = allTasks.filter((t) => !t.done && t.deadline === todayStr);
  const upcomingTasks = allTasks
    .filter((t) => !t.done && t.deadline && t.deadline > todayStr)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 10);

  const bellBadge = dueTodayTasks.length;
  const overdueBadge = overdueTasks.length;

  const FILTERS = ['All', 'Active', 'Completed', ...(overdueBadge > 0 ? ['Overdue'] : [])];

  useEffect(() => {
    if (filter === 'Overdue' && overdueBadge === 0) setFilter('All');
  }, [filter, overdueBadge]);

  const filteredGroups = groups.filter((g) => {
    if (g.tasks.length === 0) return filter === 'All';
    if (filter === 'Active') return g.tasks.some((t) => !t.done);
    if (filter === 'Completed') return g.tasks.every((t) => t.done);
    if (filter === 'Overdue') return g.tasks.some((t) => !t.done && t.deadline && t.deadline < todayStr);
    return true;
  });

  const heading = (settings.dashboard_heading || 'Your tasks,\nyour way').replace(/\\n/g, '\n');

  return (
    <div className="flex flex-col lg:flex-row min-h-screen page-enter overflow-x-hidden">

      {/* ── Main content ── */}
      <div className="flex-1 p-4 md:p-6 lg:p-8 lg:pr-4 overflow-y-auto min-w-0">

        {/* Hero */}
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

            {/* Action icons — mobile */}
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
                            to={task.groupId ? `/tasks/${task.groupId}` : '/tasks'}
                            onClick={() => setOverdueOpen(false)}
                            className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                              <p className="text-xs text-gray-400">{task.groupName} · {daysDiff(task.deadline)}d overdue</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {bellBadge > 0 && (
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
                    <Calendar size={16} />
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-white text-xs flex items-center justify-center font-bold">
                      {bellBadge}
                    </span>
                  </button>
                  {bellOpen && (
                    <div
                      className="fixed w-72 bg-white rounded-2xl shadow-xl border border-gray-100 z-[9999] overflow-hidden"
                      style={{ top: bellPos.top, right: bellPos.right }}
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">Due Today</p>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {dueTodayTasks.map((task) => (
                          <Link
                            key={task.id}
                            to={task.groupId ? `/tasks/${task.groupId}` : '/tasks'}
                            onClick={() => setBellOpen(false)}
                            className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            <Clock size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                              <p className="text-xs text-gray-400">{task.groupName}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats — mobile */}
        <div className="lg:hidden bg-white rounded-2xl p-4 shadow-sm mb-4 flex items-center gap-4">
          <CompletionRing pct={pct} done={done} total={total} size={64} strokeWidth={6} />
          <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <p className="text-xs text-gray-400">Done</p>
              <p className="font-mono font-bold text-gray-900">{done}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Pending</p>
              <p className="font-mono font-bold text-gray-900">{pending}</p>
            </div>
            {overdueBadge > 0 && (
              <div>
                <p className="text-xs text-gray-400">Overdue</p>
                <p className="font-mono font-bold text-red-500">{overdueBadge}</p>
              </div>
            )}
            {bellBadge > 0 && (
              <div>
                <p className="text-xs text-gray-400">Due Today</p>
                <p className="font-mono font-bold text-amber-500">{bellBadge}</p>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filter === f
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-500 hover:text-gray-800 shadow-sm'
              }`}
              style={filter === f ? { backgroundColor: 'var(--accent, #ED64A6)' } : {}}
            >
              {f}
              {f === 'Overdue' && overdueBadge > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                  {overdueBadge}
                </span>
              )}
              {f === 'Active' && pending > 0 && (
                <span className="ml-1.5 text-[10px] opacity-60">{pending}</span>
              )}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {groups.length === 0 && standaloneTasks.length === 0 ? (
          <div className="text-center py-20">
            <ListChecks size={40} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-medium">No task groups yet</p>
            <p className="text-sm text-gray-300 mt-1">Create a group in Tasks to get started</p>
            <Link
              to="/tasks"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              Go to Tasks <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.length === 0 && filter !== 'All' ? (
              <div className="text-center py-16 text-gray-400">
                <p>No groups match this filter</p>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  todayStr={todayStr}
                  expanded={expandedId === group.id}
                  onToggle={() => setExpandedId(expandedId === group.id ? null : group.id)}
                  onToggleTask={onToggleGroupTask}
                />
              ))
            )}

            {/* Standalone tasks shown only in All/Active filter */}
            {(filter === 'All' || filter === 'Active') && (
              <StandalonePanel tasks={standaloneTasks} todayStr={todayStr} onToggleTask={onToggleStandaloneTask} />
            )}
          </div>
        )}
      </div>

      {/* ── Right panel — desktop ── */}
      <div className="hidden lg:flex flex-col gap-4 w-72 xl:w-80 p-6 pl-4 flex-shrink-0">
        {/* Settings icon */}
        <div className="flex items-center justify-end">
          <Link
            to="/settings"
            className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors"
          >
            <Settings size={16} />
          </Link>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          {settings.logo ? (
            <img
              src={settings.logo}
              alt="Logo"
              className="w-20 h-20 rounded-2xl mx-auto mt-2 mb-2 object-contain bg-white p-1"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl mx-auto mt-2 mb-2 flex items-center justify-center text-white text-2xl font-display font-bold"
              style={{ background: `linear-gradient(135deg, var(--accent, #ED64A6), var(--accent, #ED64A6)99)` }}
            >
              {(settings.username || 'A').charAt(0).toUpperCase()}
            </div>
          )}
          <h3 className="font-display font-bold text-lg text-gray-900">{settings.username}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{settings.company_name}</p>
        </div>

        {/* Overall progress */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">Overall Progress</p>
          <div className="flex items-center gap-5">
            <CompletionRing pct={pct} done={done} total={total} size={80} strokeWidth={7} />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-sm text-gray-600">{done} done</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-300" />
                <span className="text-sm text-gray-600">{pending} pending</span>
              </div>
              {overdueBadge > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-400" />
                  <span className="text-sm text-red-500">{overdueBadge} overdue</span>
                </div>
              )}
              {bellBadge > 0 && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-amber-500" />
                  <span className="text-sm text-amber-600">{bellBadge} due today</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overdue */}
        {overdueTasks.length > 0 && (
          <div className="bg-red-50 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-1.5">
              <TriangleAlert size={14} /> Overdue
            </p>
            <div>
              {overdueTasks.slice(0, 5).map((task) => (
                <Link
                  key={task.id}
                  to={task.groupId ? `/tasks/${task.groupId}` : '/tasks'}
                  className="flex items-start gap-2.5 py-2 border-b border-red-100/60 last:border-0 hover:opacity-70 transition-opacity"
                >
                  <AlertTriangle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{task.title}</p>
                    <p className="text-[11px] text-red-400">{task.groupName} · {daysDiff(task.deadline)}d ago</p>
                  </div>
                </Link>
              ))}
              {overdueTasks.length > 5 && (
                <p className="text-xs text-red-400 pt-2">+{overdueTasks.length - 5} more</p>
              )}
            </div>
          </div>
        )}

        {/* Due today */}
        {dueTodayTasks.length > 0 && (
          <div className="bg-amber-50 rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
              <Clock size={14} /> Due Today
            </p>
            <div>
              {dueTodayTasks.map((task) => (
                <Link
                  key={task.id}
                  to={task.groupId ? `/tasks/${task.groupId}` : '/tasks'}
                  className="flex items-center gap-2.5 py-2 border-b border-amber-100/60 last:border-0 hover:opacity-70 transition-opacity"
                >
                  <Clock size={13} className="text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{task.title}</p>
                    <p className="text-[11px] text-amber-500">{task.groupName}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcomingTasks.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-400" /> Upcoming
            </p>
            <div>
              {upcomingTasks.slice(0, 6).map((task) => (
                <Link
                  key={task.id}
                  to={task.groupId ? `/tasks/${task.groupId}` : '/tasks'}
                  className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0 hover:opacity-70 transition-opacity"
                >
                  <Calendar size={13} className="text-gray-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{task.title}</p>
                    <p className="text-[11px] text-gray-400">{task.groupName}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">
                    {formatDeadline(task.deadline)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Manage link */}
        <Link
          to="/tasks"
          className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
        >
          <ListChecks size={16} /> Manage Task Groups
        </Link>
      </div>
    </div>
  );
}
