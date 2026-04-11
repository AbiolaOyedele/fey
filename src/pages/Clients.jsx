import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, LayoutGrid, List, X, Trash2, Users } from 'lucide-react';
import { getNextColor } from '../data/defaultClients';

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

export default function Clients({ clients, actions }) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sortBy, setSortBy] = useState('name');

  const filtered = clients
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'tasks') return b.tasks.length - a.tasks.length;
      return a.name.localeCompare(b.name);
    });

  const handleAddClient = async () => {
    if (!newName.trim()) return;
    await actions.addClient(newName.trim(), getNextColor(clients));
    setNewName('');
    setShowModal(false);
  };

  const handleDeleteClient = async (id) => {
    await actions.deleteClient(id);
    setConfirmDelete(null);
  };

  return (
    <div className="p-8 page-enter">
      <h1 className="font-display text-[2.75rem] leading-tight font-bold text-gray-900 mb-8">
        Clients
      </h1>

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white rounded-full border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>

        {viewMode === 'list' && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2.5 bg-white rounded-full border border-gray-200 text-sm outline-none"
          >
            <option value="name">Sort by name</option>
            <option value="tasks">Sort by tasks</option>
          </select>
        )}

        <div className="flex bg-white rounded-full border border-gray-200 overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List size={16} />
          </button>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus size={16} />
          Add Client
        </button>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => {
            const totalTasks = client.tasks.length;
            const doneTasks = client.tasks.filter((t) => t.done).length;
            const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            const paidAmount = client.tasks.filter((t) => t.paid).reduce((s, t) => s + t.amount, 0);
            const textColor = ACCENT_TEXT[client.color] || '#374151';

            return (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="group rounded-2xl p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden"
                style={{ backgroundColor: client.color }}
              >
                {/* Top badges */}
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
                  className="font-display text-xl font-bold mb-1"
                  style={{ color: textColor }}
                >
                  {client.name}
                </h3>
                <p className="text-sm mb-4 opacity-70" style={{ color: textColor }}>
                  {doneTasks} completed, {totalTasks - doneTasks} pending
                </p>

                {/* Progress + avatar + delete */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <div className="h-1.5 bg-white/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: textColor,
                          opacity: 0.5,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(client.id); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/50 hover:bg-white/80 transition-all"
                      style={{ color: textColor }}
                    >
                      <Trash2 size={12} />
                    </button>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-white/50"
                      style={{ color: textColor }}
                    >
                      {client.name.charAt(0)}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => {
            const totalTasks = client.tasks.length;
            const doneTasks = client.tasks.filter((t) => t.done).length;
            const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            const textColor = ACCENT_TEXT[client.color] || '#374151';

            return (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                style={{ backgroundColor: client.color }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 bg-white/50"
                  style={{ color: textColor }}
                >
                  {client.name.charAt(0)}
                </div>
                <span className="font-display font-semibold w-40 truncate" style={{ color: textColor }}>
                  {client.name}
                </span>
                <span className="text-sm opacity-70 w-24" style={{ color: textColor }}>
                  {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                </span>
                <div className="flex-1 max-w-xs">
                  <div className="h-1.5 bg-white/40 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: textColor, opacity: 0.5 }}
                    />
                  </div>
                </div>
                <span className="text-sm font-mono opacity-60 w-12 text-right" style={{ color: textColor }}>
                  {pct}%
                </span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(client.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: textColor }}
                >
                  <Trash2 size={14} />
                </button>
              </Link>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No clients found</p>
          <p className="text-sm mt-1">Try a different search or add a new client</p>
        </div>
      )}

      {/* Add Client Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-slideDown">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold">New Client</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Client name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddClient()}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 mb-4"
            />
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400">Color:</span>
              <div
                className="w-6 h-6 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: getNextColor(clients) }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClient}
                disabled={!newName.trim()}
                className="px-5 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-all"
              >
                Add Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slideDown">
            <h2 className="font-display text-lg font-semibold mb-2">Delete Client?</h2>
            <p className="text-sm text-gray-500 mb-5">
              This will remove the client and all their tasks. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteClient(confirmDelete)}
                className="px-5 py-2 bg-danger text-white rounded-xl text-sm font-medium hover:bg-red-400 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
