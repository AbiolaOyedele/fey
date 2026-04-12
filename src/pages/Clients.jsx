import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, LayoutGrid, List, X, Trash2, Users, Edit2, Upload, Image, AlertTriangle } from 'lucide-react';
import { getNextColor, PALETTE } from '../data/defaultClients';
import { useSettings } from '../contexts/SettingsContext';
import EditClientModal from '../components/EditClientModal';

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

const CARD_COLS = {
  small: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4',
  medium: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  large: 'grid-cols-1 lg:grid-cols-2',
};

const normalizeHex = (val) => {
  const trimmed = val.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};
const isValidHex = (val) => /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(val));

export default function Clients({ clients, actions }) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [customHex, setCustomHex] = useState('');
  const [newLogo, setNewLogo] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [editingClient, setEditingClient] = useState(null);
  const logoInputRef = useRef(null);
  const { settings, formatMoney } = useSettings();

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const filtered = clients
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'tasks') return b.tasks.length - a.tasks.length;
      return a.name.localeCompare(b.name);
    });

  const openModal = () => {
    const nextColor = getNextColor(clients);
    setSelectedColor(nextColor);
    setCustomHex('');
    setNewName('');
    setNewLogo('');
    setShowModal(true);
  };

  const handleAddClient = async () => {
    if (!newName.trim()) return;
    const color = selectedColor || getNextColor(clients);
    await actions.addClient(newName.trim(), color, newLogo);
    setNewName('');
    setCustomHex('');
    setNewLogo('');
    setShowModal(false);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) return;
    const reader = new FileReader();
    reader.onloadend = () => setNewLogo(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCustomHexChange = (val) => {
    setCustomHex(val);
    if (isValidHex(val)) {
      setSelectedColor(normalizeHex(val));
    }
  };

  const handleDeleteClient = async (id) => {
    await actions.deleteClient(id);
  };

  const gridCols = CARD_COLS[settings.card_size] || CARD_COLS.medium;

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
            className="w-full pl-9 pr-4 py-2.5 bg-white rounded-full border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-all"
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
          onClick={openModal}
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--accent, #667EEA)' }}
        >
          <Plus size={16} />
          Add Client
        </button>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className={`grid ${gridCols} gap-4`}>
          {filtered.map((client) => {
            const totalTasks = client.tasks.length;
            const doneTasks = client.tasks.filter((t) => t.done).length;
            const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            const paidAmount = client.tasks.filter((t) => t.paid).reduce((s, t) => s + t.amount, 0);
            const textColor = ACCENT_TEXT[client.color] || '#374151';
            const hasOverdue = client.tasks.some((t) => !t.done && t.deadline && t.deadline < todayStr);

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

                {/* Progress + avatar + actions */}
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
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingClient(client); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/50 hover:bg-white/80 transition-all"
                      style={{ color: textColor }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClient(client.id); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/50 hover:bg-white/80 transition-all"
                      style={{ color: textColor }}
                    >
                      <Trash2 size={12} />
                    </button>
                    {client.logo ? (
                      <img src={client.logo} alt={client.name} className="w-8 h-8 rounded-full object-cover bg-white/50" />
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
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => {
            const totalTasks = client.tasks.length;
            const doneTasks = client.tasks.filter((t) => t.done).length;
            const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            const textColor = ACCENT_TEXT[client.color] || '#374151';
            const hasOverdue = client.tasks.some((t) => !t.done && t.deadline && t.deadline < todayStr);

            return (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                style={{ backgroundColor: client.color }}
              >
                {client.logo ? (
                  <img src={client.logo} alt={client.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 bg-white/50" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 bg-white/50"
                    style={{ color: textColor }}
                  >
                    {client.name.charAt(0)}
                  </div>
                )}
                <span className="font-display font-semibold w-40 truncate" style={{ color: textColor }}>
                  {client.name}
                </span>
                {hasOverdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-100/80 text-red-600 flex-shrink-0">
                    <AlertTriangle size={10} />
                    Overdue
                  </span>
                )}
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
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingClient(client); }}
                  className="opacity-0 group-hover:opacity-100 transition-all"
                  style={{ color: textColor }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClient(client.id); }}
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

      {/* Edit Client Modal */}
      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSave={async (updates) => {
            await actions.updateClient(editingClient.id, updates);
            setEditingClient(null);
          }}
        />
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
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary/10 mb-4"
            />

            {/* Logo upload */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Client Logo</p>
              <div className="flex items-center gap-3">
                {newLogo ? (
                  <div className="relative group">
                    <img src={newLogo} alt="Logo" className="w-10 h-10 rounded-xl object-cover border border-gray-200" />
                    <button
                      onClick={() => setNewLogo('')}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 border border-dashed border-gray-300">
                    <Image size={16} />
                  </div>
                )}
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Upload size={12} />
                  Upload
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <span className="text-xs text-gray-400">PNG/JPG, max 500KB</span>
              </div>
            </div>

            {/* Color picker */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Color</p>
              {/* Palette swatches */}
              <div className="flex gap-2 flex-wrap mb-3">
                {PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => { setSelectedColor(color); setCustomHex(''); }}
                    className="w-8 h-8 rounded-full transition-all duration-150 hover:scale-105"
                    style={{
                      backgroundColor: color,
                      outline: selectedColor === color ? `3px solid #6B7280` : '3px solid transparent',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              {/* Custom hex input */}
              <div className="flex items-center gap-2">
                {customHex && isValidHex(customHex) && (
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 border border-gray-200"
                    style={{ backgroundColor: normalizeHex(customHex) }}
                  />
                )}
                <input
                  type="text"
                  placeholder="#hex color"
                  value={customHex}
                  onChange={(e) => handleCustomHexChange(e.target.value)}
                  maxLength={7}
                  className="w-32 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:border-gray-400 transition-all"
                />
                {customHex && !isValidHex(customHex) && (
                  <span className="text-xs text-danger">Invalid hex</span>
                )}
              </div>
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
                className="px-5 py-2 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ backgroundColor: 'var(--accent, #667EEA)' }}
              >
                Add Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
