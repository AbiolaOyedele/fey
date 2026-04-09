import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Settings, ArrowRight, ChevronRight,
  CheckCircle2, Clock, Users, CreditCard,
} from 'lucide-react';

const FILTERS = ['All', 'Active', 'Completed', 'Paid'];

// Darker text colors for each pastel background
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

export default function Dashboard({ clients }) {
  const [filter, setFilter] = useState('All');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const allTasks = clients.flatMap((c) =>
    c.tasks.map((t) => ({ ...t, clientId: c.id, clientName: c.name, clientColor: c.color }))
  );

  const tasksDone = allTasks.filter((t) => t.done).length;
  const tasksPending = allTasks.filter((t) => !t.done).length;

  const earnedThisMonth = clients.reduce((sum, client) => {
    const taskEarnings = client.tasks
      .filter((t) => t.paid && t.createdAt.startsWith(currentMonth))
      .reduce((s, t) => s + t.amount, 0);
    const retainerEarning = client.retainerPaid?.[currentMonth] ? client.retainer : 0;
    return sum + taskEarnings + retainerEarning;
  }, 0);

  // Filter clients
  const filteredClients = clients.filter((c) => {
    if (filter === 'All') return true;
    if (filter === 'Active') return c.tasks.some((t) => !t.done);
    if (filter === 'Completed') return c.tasks.length > 0 && c.tasks.every((t) => t.done);
    if (filter === 'Paid') return c.tasks.some((t) => t.paid);
    return true;
  });

  // Sort by most tasks for "Most active"
  const topClients = [...filteredClients]
    .sort((a, b) => b.tasks.length - a.tasks.length)
    .slice(0, 6);

  // Activity data for the mini bar chart (last 6 months)
  const monthlyActivity = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const earned = clients.reduce((sum, client) => {
      const te = client.tasks
        .filter((t) => t.paid && t.createdAt.startsWith(key))
        .reduce((s, t) => s + t.amount, 0);
      const re = client.retainerPaid?.[key] ? client.retainer : 0;
      return sum + te + re;
    }, 0);
    monthlyActivity.push({ label, earned, key });
  }
  const maxEarned = Math.max(...monthlyActivity.map((m) => m.earned), 1);

  // Top 3 clients by earnings for "My clients" panel
  const topEarningClients = [...clients]
    .map((c) => ({
      ...c,
      totalEarned: c.tasks.filter((t) => t.paid).reduce((s, t) => s + t.amount, 0),
      completionPct: c.tasks.length > 0
        ? Math.round((c.tasks.filter((t) => t.done).length / c.tasks.length) * 100)
        : 0,
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, 3);

  return (
    <div className="flex min-h-screen page-enter">
      {/* Main Content */}
      <div className="flex-1 p-8 pr-4 overflow-y-auto min-w-0">
        {/* Hero heading */}
        <div className="mb-8">
          <h1 className="font-display text-[2.75rem] leading-tight font-bold text-gray-900">
            Track your<br />work & earnings
          </h1>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                filter === f
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {f === 'All' && <Users size={14} />}
              {f === 'Active' && <Clock size={14} />}
              {f === 'Completed' && <CheckCircle2 size={14} />}
              {f === 'Paid' && <CreditCard size={14} />}
              {f}
            </button>
          ))}
        </div>

        {/* Section label */}
        <p className="text-sm text-gray-500 font-medium mb-4">Most active</p>

        {/* Client cards grid — colorful pastel backgrounds */}
        <div className="grid grid-cols-2 gap-4">
          {topClients.map((client) => {
            const doneTasks = client.tasks.filter((t) => t.done).length;
            const totalTasks = client.tasks.length;
            const paidAmount = client.tasks
              .filter((t) => t.paid)
              .reduce((s, t) => s + t.amount, 0);
            const textColor = ACCENT_TEXT[client.color] || '#374151';

            return (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="group rounded-2xl p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden"
                style={{ backgroundColor: client.color }}
              >
                {/* Category badge + rating */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/60 backdrop-blur-sm"
                    style={{ color: textColor }}
                  >
                    <Users size={12} />
                    {doneTasks}/{totalTasks} tasks
                  </span>
                  {paidAmount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-white/70 text-success">
                      <span className="w-1.5 h-1.5 rounded-full bg-success" />
                      ₦{(paidAmount / 1000).toFixed(0)}k
                    </span>
                  )}
                </div>

                {/* Client name */}
                <h3
                  className="font-display text-xl font-bold mb-1 leading-snug"
                  style={{ color: textColor }}
                >
                  {client.name}
                </h3>

                {/* Task summary */}
                <p className="text-sm mb-4 opacity-70" style={{ color: textColor }}>
                  {doneTasks} completed, {totalTasks - doneTasks} pending
                </p>

                {/* Bottom row: progress + avatar */}
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
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-white/50"
                    style={{ color: textColor }}
                  >
                    {client.name.charAt(0)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* "View all clients" link */}
        {clients.length > 6 && (
          <Link
            to="/clients"
            className="flex items-center gap-1.5 text-sm text-primary font-medium mt-4 hover:gap-2.5 transition-all"
          >
            View all clients <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {/* Right Summary Panel */}
      <div className="w-[260px] flex-shrink-0 p-4 pl-2 overflow-y-auto overflow-x-hidden">
        {/* Top bar: bell + settings */}
        <div className="flex items-center justify-between mb-6">
          <button className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors">
            <Bell size={16} />
          </button>
          <button className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm transition-colors">
            <Settings size={16} />
          </button>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/60 to-purple-400 mx-auto mb-3 flex items-center justify-center text-white text-xl font-display font-bold">
            A
          </div>
          <h3 className="font-display font-bold text-lg text-gray-900">Abiola</h3>
          <p className="text-xs text-gray-400 mt-0.5">The Arc Company</p>

          {/* Quick stats row */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-100">
            <Link to="/clients" className="text-center hover:opacity-70 transition-opacity">
              <p className="font-mono font-semibold text-gray-900">{clients.length}</p>
              <p className="text-xs text-gray-400">Clients</p>
            </Link>
            <div className="w-px h-8 bg-gray-100" />
            <Link to="/clients" className="text-center hover:opacity-70 transition-opacity">
              <p className="font-mono font-semibold text-gray-900">{tasksDone}</p>
              <p className="text-xs text-gray-400">Done</p>
            </Link>
            <div className="w-px h-8 bg-gray-100" />
            <Link to="/clients" className="text-center hover:opacity-70 transition-opacity">
              <p className="font-mono font-semibold text-gray-900">{tasksPending}</p>
              <p className="text-xs text-gray-400">Pending</p>
            </Link>
          </div>
        </div>

        {/* Activity chart card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-700">Activity</p>
            <span className="text-xs text-gray-400">6 months</span>
          </div>
          <Link to="/payments" className="block">
            <p className="font-mono text-xl font-bold text-gray-900 mb-1 truncate">
              ₦{earnedThisMonth.toLocaleString()}
            </p>
            <p className="text-xs text-success font-medium mb-4">This month</p>

            {/* Mini bar chart */}
            <div className="flex items-end gap-1.5 h-24">
              {monthlyActivity.map((m, i) => {
                const isCurrentMonth = m.key === currentMonth;
                const height = m.earned > 0 ? Math.max((m.earned / maxEarned) * 100, 8) : 4;
                // Use stacked colored bars like the reference
                const colors = ['#FDE8E8', '#D1FAE5', '#DBEAFE', '#EDE9FE', '#FEF3C7'];
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-md transition-all duration-300 relative overflow-hidden"
                      style={{ height: `${height}%` }}
                    >
                      {colors.map((color, ci) => (
                        <div
                          key={ci}
                          className="w-full"
                          style={{
                            height: `${100 / colors.length}%`,
                            backgroundColor: color,
                            opacity: m.earned > 0 ? 1 : 0.3,
                          }}
                        />
                      ))}
                      {isCurrentMonth && (
                        <div className="absolute inset-0 ring-2 ring-primary/40 rounded-md" />
                      )}
                    </div>
                    <span className={`text-[10px] ${isCurrentMonth ? 'text-primary font-semibold' : 'text-gray-400'}`}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Link>
        </div>

        {/* My clients list */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">My clients</p>
            <Link to="/clients" className="text-xs text-primary hover:underline">
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
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    backgroundColor: client.color,
                    color: ACCENT_TEXT[client.color] || '#374151',
                  }}
                >
                  {client.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{client.name}</p>
                  <p className="text-xs text-gray-400">
                    {client.tasks.length} task{client.tasks.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span
                    className="text-xs font-mono font-medium px-2 py-0.5 rounded-lg"
                    style={{
                      backgroundColor: client.color,
                      color: ACCENT_TEXT[client.color] || '#374151',
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
