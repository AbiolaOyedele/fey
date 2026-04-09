import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, TrendingUp, Clock } from 'lucide-react';

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

export default function Payments({ clients }) {
  const [expandedMonth, setExpandedMonth] = useState(null);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Build monthly breakdown
  const monthlyData = {};

  clients.forEach((client) => {
    client.tasks.forEach((task) => {
      const month = task.createdAt.slice(0, 7);
      if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} };
      if (!monthlyData[month].clients[client.id]) {
        monthlyData[month].clients[client.id] = {
          id: client.id,
          name: client.name,
          color: client.color,
          earned: 0,
          pending: 0,
          retainer: 0,
          tasks: [],
        };
      }
      const clientData = monthlyData[month].clients[client.id];
      if (task.paid) {
        clientData.earned += task.amount;
        monthlyData[month].earned += task.amount;
      } else if (task.amount > 0) {
        clientData.pending += task.amount;
        monthlyData[month].pending += task.amount;
      }
      clientData.tasks.push(task);
    });

    Object.entries(client.retainerPaid || {}).forEach(([month, paid]) => {
      if (!client.retainer) return;
      if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} };
      if (!monthlyData[month].clients[client.id]) {
        monthlyData[month].clients[client.id] = {
          id: client.id,
          name: client.name,
          color: client.color,
          earned: 0,
          pending: 0,
          retainer: 0,
          tasks: [],
        };
      }
      if (paid) {
        monthlyData[month].clients[client.id].retainer = client.retainer;
        monthlyData[month].clients[client.id].earned += client.retainer;
        monthlyData[month].earned += client.retainer;
      }
    });
  });

  const months = Object.entries(monthlyData)
    .filter(([, data]) => data.earned > 0 || data.pending > 0)
    .sort(([a], [b]) => b.localeCompare(a));

  const totalEarned = months.reduce((sum, [, d]) => sum + d.earned, 0);
  const totalPending = months.reduce((sum, [, d]) => sum + d.pending, 0);

  // Earnings for the current month
  const thisMonthData = monthlyData[currentMonth];
  const earnedThisMonth = thisMonthData?.earned || 0;

  return (
    <div className="flex min-h-screen page-enter">
      {/* Main content */}
      <div className="flex-1 p-8 pr-4 min-w-0">
        <h1 className="font-display text-[2.75rem] leading-tight font-bold text-gray-900 mb-8">
          Payments
        </h1>

        {months.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No payments yet</p>
            <p className="text-sm mt-1">Mark tasks as paid to see earnings here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {months.map(([month, data]) => {
              const isExpanded = expandedMonth === month;
              const date = new Date(month + '-01');
              const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              const isCurrentMonth = month === currentMonth;
              const clientEntries = Object.values(data.clients).filter(
                (c) => c.earned > 0 || c.pending > 0
              );

              return (
                <div key={month} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedMonth(isExpanded ? null : month)}
                    className="w-full flex items-center gap-4 px-6 py-5 hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isExpanded ? 'bg-primary/10' : 'bg-gray-100'}`}>
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-primary" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-display font-semibold text-gray-900">
                        {label}
                      </span>
                      {isCurrentMonth && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {data.earned > 0 && (
                        <span className="text-sm font-mono font-semibold text-success bg-success/10 px-3 py-1 rounded-lg">
                          +₦{data.earned.toLocaleString()}
                        </span>
                      )}
                      {data.pending > 0 && (
                        <span className="text-sm font-mono text-pending bg-pending/10 px-3 py-1 rounded-lg">
                          ₦{data.pending.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-6 py-4 animate-slideDown space-y-4">
                      {clientEntries.map((clientData) => {
                        const textColor = ACCENT_TEXT[clientData.color] || '#374151';
                        return (
                          <div key={clientData.name}>
                            <Link
                              to={`/clients/${clientData.id}`}
                              className="flex items-center gap-3 mb-2 group"
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                                style={{ backgroundColor: clientData.color, color: textColor }}
                              >
                                {clientData.name.charAt(0)}
                              </div>
                              <span className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">
                                {clientData.name}
                              </span>
                              {clientData.earned > 0 && (
                                <span className="text-xs font-mono text-success ml-auto">
                                  +₦{clientData.earned.toLocaleString()}
                                </span>
                              )}
                            </Link>
                            <div className="pl-11 space-y-1.5">
                              {clientData.retainer > 0 && (
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>Retainer fee</span>
                                  <span className="font-mono text-success">
                                    ₦{clientData.retainer.toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {clientData.tasks
                                .filter((t) => t.amount > 0)
                                .map((task) => (
                                  <div
                                    key={task.id}
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span className={task.paid ? 'text-gray-600' : 'text-gray-400'}>
                                      {task.title}
                                    </span>
                                    <span
                                      className={`font-mono ${
                                        task.paid ? 'text-success' : 'text-pending'
                                      }`}
                                    >
                                      ₦{task.amount.toLocaleString()}
                                      {!task.paid && ' (pending)'}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Summary Panel */}
      <div className="w-[260px] flex-shrink-0 p-5 pl-2 overflow-y-auto">
        {/* Total earned */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp size={16} className="text-success" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Total Earned</p>
          </div>
          <p className="font-mono text-2xl font-bold text-gray-900">
            ₦{totalEarned.toLocaleString()}
          </p>
        </div>

        {/* Pending */}
        {totalPending > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-pending/10 flex items-center justify-center">
                <Clock size={16} className="text-pending" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Pending</p>
            </div>
            <p className="font-mono text-2xl font-bold text-pending">
              ₦{totalPending.toLocaleString()}
            </p>
          </div>
        )}

        {/* This month */}
        <div className="bg-primary/5 rounded-2xl p-5 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">This Month</p>
          <p className="font-mono text-xl font-bold text-primary">
            ₦{earnedThisMonth.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Top clients by earnings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-4">Top Earners</p>
          <div className="space-y-3">
            {[...clients]
              .map((c) => ({
                ...c,
                totalEarned: c.tasks.filter((t) => t.paid).reduce((s, t) => s + t.amount, 0),
              }))
              .filter((c) => c.totalEarned > 0)
              .sort((a, b) => b.totalEarned - a.totalEarned)
              .slice(0, 5)
              .map((c) => {
                const textColor = ACCENT_TEXT[c.color] || '#374151';
                return (
                  <Link
                    key={c.id}
                    to={`/clients/${c.id}`}
                    className="flex items-center gap-3 p-1.5 -mx-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: c.color, color: textColor }}
                    >
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    </div>
                    <span className="text-xs font-mono text-success font-medium">
                      ₦{(c.totalEarned / 1000).toFixed(0)}k
                    </span>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
