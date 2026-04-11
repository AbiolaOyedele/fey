import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Plus, CheckCircle2, Clock, CreditCard } from 'lucide-react';
import TaskItem from '../components/TaskItem';

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

export default function ClientWorkspace({ clients, actions }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = clients.find((c) => c.id === id);
  const [newTask, setNewTask] = useState('');
  const [retainerOpen, setRetainerOpen] = useState(false);

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

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    await actions.addTask(id, newTask.trim());
    setNewTask('');
  };

  const handleUpdateTask = async (updatedTask) => {
    await actions.updateTask(id, updatedTask.id, {
      title: updatedTask.title,
      done: updatedTask.done,
      paid: updatedTask.paid,
      amount: updatedTask.amount,
    });
  };

  const handleDeleteTask = async (taskId) => {
    await actions.deleteTask(id, taskId);
  };

  const handleSetRetainer = async (amount) => {
    await actions.updateRetainer(id, parseInt(amount) || 0);
  };

  const handleToggleRetainerPaid = async () => {
    const newPaid = !retainerPaidThisMonth;
    await actions.toggleRetainerPaid(id, currentMonth, newPaid);
  };

  const pendingTasks = client.tasks.filter((t) => !t.done);
  const completedTasks = client.tasks.filter((t) => t.done);
  const totalEarned = client.tasks.filter((t) => t.paid).reduce((s, t) => s + t.amount, 0);
  const totalPending = client.tasks.filter((t) => !t.paid && t.amount > 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="flex min-h-screen page-enter">
      {/* Main content */}
      <div className="flex-1 p-8 pr-4 min-w-0">
        {/* Back link */}
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Clients
        </button>

        {/* Hero header with client color */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ backgroundColor: client.color }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-display font-bold bg-white/50"
              style={{ color: textColor }}
            >
              {client.name.charAt(0)}
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold" style={{ color: textColor }}>
                {client.name}
              </h1>
              <p className="text-sm mt-0.5 opacity-70" style={{ color: textColor }}>
                {client.tasks.length} task{client.tasks.length !== 1 ? 's' : ''} total
              </p>
            </div>
          </div>
        </div>

        {/* Retainer Section */}
        <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
          <button
            onClick={() => setRetainerOpen(!retainerOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>
              Monthly Retainer
              {client.retainer > 0 && (
                <span className="ml-2 font-mono text-primary">
                  NGN {client.retainer.toLocaleString()}
                </span>
              )}
            </span>
            {retainerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {retainerOpen && (
            <div className="px-6 pb-5 border-t border-gray-100 pt-4 animate-slideDown">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-gray-400">NGN</span>
                  <input
                    type="number"
                    value={client.retainer || ''}
                    onChange={(e) => handleSetRetainer(e.target.value)}
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

        {/* Task List */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-display text-lg font-semibold text-gray-900 mb-4">
            Tasks
            <span className="text-sm font-sans font-normal text-gray-400 ml-2">
              {client.tasks.length} total
            </span>
          </h2>

          {/* Pending tasks */}
          {pendingTasks.length > 0 && (
            <div className="mb-4">
              {pendingTasks.map((task) => (
                <TaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
              ))}
            </div>
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div className={pendingTasks.length > 0 ? 'border-t border-gray-100 pt-3' : ''}>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 px-4">Completed</p>
              {completedTasks.map((task) => (
                <TaskItem key={task.id} task={task} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />
              ))}
            </div>
          )}

          {client.tasks.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No tasks yet. Add one below.</p>
          )}

          {/* Add Task */}
          <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
            <input
              type="text"
              placeholder="Add a new task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <button
              onClick={handleAddTask}
              disabled={!newTask.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-all"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Right Summary Panel */}
      <div className="w-[260px] flex-shrink-0 p-5 pl-2 overflow-y-auto">
        {/* Client stats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-4">Overview</p>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-success" />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">{completedTasks.length}</p>
                <p className="text-xs text-gray-400">Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-pending/10 flex items-center justify-center">
                <Clock size={16} className="text-pending" />
              </div>
              <div>
                <p className="font-mono font-semibold text-gray-900">{pendingTasks.length}</p>
                <p className="text-xs text-gray-400">Pending</p>
              </div>
            </div>
          </div>
        </div>

        {/* Earnings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Earnings</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Total earned</p>
              <p className="font-mono text-xl font-bold text-success">
                ₦{totalEarned.toLocaleString()}
              </p>
            </div>
            {totalPending > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Pending</p>
                <p className="font-mono text-lg font-semibold text-pending">
                  ₦{totalPending.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Completion */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: client.color }}
        >
          <p className="text-sm font-semibold mb-3" style={{ color: textColor }}>
            Completion
          </p>
          <div className="flex items-end gap-2 mb-2">
            <span className="font-mono text-3xl font-bold" style={{ color: textColor }}>
              {client.tasks.length > 0
                ? Math.round((completedTasks.length / client.tasks.length) * 100)
                : 0}%
            </span>
          </div>
          <div className="h-2 bg-white/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${client.tasks.length > 0 ? (completedTasks.length / client.tasks.length) * 100 : 0}%`,
                backgroundColor: textColor,
                opacity: 0.6,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
