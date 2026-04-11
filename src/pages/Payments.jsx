import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, TrendingUp, Clock } from 'lucide-react';
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

export default function Payments({ clients }) {
  const [expandedMonth, setExpandedMonth] = useState(null);
  const { formatMoney, trash } = useSettings();

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Build monthly breakdown from active clients
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
          isDeleted: false,
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
          isDeleted: false,
        };
      }
      if (paid) {
        monthlyData[month].clients[client.id].retainer = client.retainer;
        monthlyData[month].clients[client.id].earned += client.retainer;
        monthlyData[month].earned += client.retainer;
      }
    });
  });

  // Also include payment history from trashed clients
  trash.filter((t) => t.item_type === 'client').forEach((trashItem) => {
    try {
      const clientData = JSON.parse(trashItem.item_data);
      const clientKey = `deleted_${trashItem.id}`;

      (clientData.tasks || []).forEach((task) => {
        const month = (task.createdAt || task.created_at || '').slice(0, 7);
        if (!month || (!task.paid && (task.amount || 0) <= 0)) return;

        if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} };
        if (!monthlyData[month].clients[clientKey]) {
          monthlyData[month].clients[clientKey] = {
            id: null,
            name: clientData.name,
            color: clientData.color || '#F0FDF4',
            earned: 0,
            pending: 0,
            retainer: 0,
            tasks: [],
            isDeleted: true,
          };
        }
        const cd = monthlyData[month].clients[clientKey];
        if (task.paid) {
          cd.earned += task.amount || 0;
          monthlyData[month].earned += task.amount || 0;
        } else {
          cd.pending += task.amount || 0;
          monthlyData[month].pending += task.amount || 0;
        }
        cd.tasks.push(task);
      });

      // Retainer payments from trashed client
      Object.entries(clientData.retainerPaid || {}).forEach(([month, paid]) => {
        if (!clientData.retainer || !paid) return;
        if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} };
        if (!monthlyData[month].clients[clientKey]) {
          monthlyData[month].clients[clientKey] = {
            id: null,
            name: clientData.name,
            color: clientData.color || '#F0FDF4',
            earned: 0,
            pending: 0,
            retainer: 0,
            tasks: [],
            isDeleted: true,
          };
        }
        monthlyData[month].clients[clientKey].retainer = clientData.retainer;
        monthlyData[month].clients[clientKey].earned += clientData.retainer;
        monthlyData[month].earned += clientData.retainer;
      });
    } catch {
      // ignore parse errors
    }
  });

  // Also include trashed tasks whose parent client still exists (paid tasks trashed individually)
  trash.filter((t) => t.item_type === 'task').forEach((trashItem) => {
    try {
      const taskData = JSON.parse(trashItem.item_data);
      const parentClient = clients.find((c) => c.id === taskData.client_id);
      if (!parentClient) return; // covered by client trash above
      if (!taskData.paid && (taskData.amount || 0) <= 0) return;

      const month = (taskData.createdAt || '').slice(0, 7);
      if (!month) return;

      if (!monthlyData[month]) monthlyData[month] = { earned: 0, pending: 0, clients: {} };
      const clientId = taskData.client_id;
      if (!monthlyData[month].clients[clientId]) {
        monthlyData[month].clients[clientId] = {
          id: clientId,
          name: parentClient.name,
          color: parentClient.color,
          earned: 0,
          pending: 0,
          retainer: 0,
          tasks: [],
          isDeleted: false,
        };
      }
      const cd = monthlyData[month].clients[clientId];
      if (taskData.paid) {
        cd.earned += taskData.amount || 0;
        monthlyData[month].earned += taskData.amount || 0;
      } else {
        cd.pending += taskData.amount || 0;
        monthlyData[month].pending += taskData.amount || 0;
      }
      cd.tasks.push({ ...taskData, id: `trash_${trashItem.id}` });
    } catch {
      // ignore
    }
  });

  const months = Object.entries(monthlyData)
    .filter(([, data]) => data.earned > 0 || data.pending > 0)
    .sort(([a], [b]) => b.localeCompare(a));

  const totalEarned = months.reduce((sum, [, d]) => sum + d.earned, 0);
  const totalPending = months.reduce((sum, [, d]) => sum + d.pending, 0);

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
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${isExpanded ? '' : 'bg-gray-100'}`}
                      style={isExpanded ? { backgroundColor: 'var(--accent, #667EEA)15' } : {}}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} style={{ color: 'var(--accent, #667EEA)' }} />
                      ) : (
                        <ChevronRight size={16} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-display font-semibold text-gray-900">
                        {label}
                      </span>
                      {isCurrentMonth && (
                        <span
                          className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            backgroundColor: 'var(--accent, #667EEA)15',
                            color: 'var(--accent, #667EEA)',
                          }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {data.earned > 0 && (
                        <span className="text-sm font-mono font-semibold text-success bg-success/10 px-3 py-1 rounded-lg">
                          +{formatMoney(data.earned)}
                        </span>
                      )}
                      {data.pending > 0 && (
                        <span className="text-sm font-mono text-pending bg-pending/10 px-3 py-1 rounded-lg">
                          {formatMoney(data.pending)}
                        </span>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-6 py-4 animate-slideDown space-y-4">
                      {clientEntries.map((clientData) => {
                        const textColor = ACCENT_TEXT[clientData.color] || '#374151';
                        return (
                          <div key={clientData.id || clientData.name}>
                            {/* Client header row */}
                            {clientData.isDeleted ? (
                              <div className="flex items-center gap-3 mb-2">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{ backgroundColor: clientData.color, color: textColor }}
                                >
                                  {clientData.name.charAt(0)}
                                </div>
                                <span className="text-sm font-semibold text-gray-800">
                                  {clientData.name}
                                </span>
                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                  deleted
                                </span>
                                {clientData.earned > 0 && (
                                  <span className="text-xs font-mono text-success ml-auto">
                                    +{formatMoney(clientData.earned)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Link
                                to={`/clients/${clientData.id}`}
                                className="flex items-center gap-3 mb-2 group"
                              >
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{ backgroundColor: clientData.color, color: textColor }}
                                >
                                  {clientData.name.charAt(0)}
                                </div>
                                <span className="text-sm font-semibold text-gray-800 group-hover:text-primary transition-colors">
                                  {clientData.name}
                                </span>
                                {clientData.earned > 0 && (
                                  <span className="text-xs font-mono text-success ml-auto">
                                    +{formatMoney(clientData.earned)}
                                  </span>
                                )}
                              </Link>
                            )}

                            {/* Task/retainer breakdown */}
                            <div className="pl-11 space-y-1.5">
                              {clientData.retainer > 0 && (
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>Retainer fee</span>
                                  <span className="font-mono text-success">
                                    {formatMoney(clientData.retainer)}
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
                                    <span className={`font-mono ${task.paid ? 'text-success' : 'text-pending'}`}>
                                      {formatMoney(task.amount)}
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
            {formatMoney(totalEarned)}
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
              {formatMoney(totalPending)}
            </p>
          </div>
        )}

        {/* This month */}
        <div className="rounded-2xl p-5 mb-4" style={{ backgroundColor: 'var(--accent, #667EEA)0D' }}>
          <p className="text-sm font-semibold text-gray-700 mb-1">This Month</p>
          <p className="font-mono text-xl font-bold" style={{ color: 'var(--accent, #667EEA)' }}>
            {formatMoney(earnedThisMonth)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Top clients by earnings (active only) */}
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
                      {formatMoney(c.totalEarned)}
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
