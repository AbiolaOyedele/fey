import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, LayoutGrid, List, X, Trash2, Users, Upload, Image, AlertTriangle, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getNextColor, PALETTE } from '../data/defaultClients';
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
  '#E0F2FE': '#0C4A6E',
  '#F5F3FF': '#4C1D95',
  '#FFF1F2': '#9F1239',
  '#ECFEFF': '#164E63',
  '#FEFCE8': '#713F12',
  '#F7FEE7': '#365314',
  '#FDF4FF': '#701A75',
  '#F0F9FF': '#0C4A6E',
  '#E6FFFA': '#134E4A',
  '#EEF2FF': '#312E81',
  '#FFF9F0': '#7C2D12',
};

const CARD_COLS = {
  small: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  medium: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  large: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2',
};

const normalizeHex = (val) => {
  const trimmed = val.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};
const isValidHex = (val) => /^#[0-9A-Fa-f]{6}$/.test(normalizeHex(val));

function SortableGridCard({ client, isDraggingRef, onDelete, formatMoney, convertAmount, todayStr }) {
  const navigate = useNavigate();
  const textColor = ACCENT_TEXT[client.color] || '#374151';
  const totalTasks = client.tasks.length;
  const doneTasks = client.tasks.filter((t) => t.done).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const paidAmount = client.tasks.filter((t) => t.paid).reduce((s, t) => s + convertAmount(t.amount, t.currency), 0);
  const hasOverdue = client.tasks.some((t) => !t.done && t.deadline && t.deadline < todayStr);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: client.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: client.color,
  };

  const handleCardClick = () => {
    if (isDraggingRef.current) return;
    navigate(`/clients/${client.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-2xl p-4 sm:p-5 transition-shadow duration-150 hover:shadow-lg relative overflow-hidden cursor-pointer"
      onClick={handleCardClick}
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
      <h3 className="font-display text-xl font-bold mb-1" style={{ color: textColor }}>
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
              style={{ width: `${pct}%`, backgroundColor: textColor, opacity: 0.5 }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/50 hover:bg-white/80 transition-all cursor-grab active:cursor-grabbing touch-none"
            style={{ color: textColor }}
          >
            <GripVertical size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(client.id); }}
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
    </div>
  );
}

function SortableListRow({ client, isDraggingRef, onDelete, todayStr }) {
  const navigate = useNavigate();
  const textColor = ACCENT_TEXT[client.color] || '#374151';
  const totalTasks = client.tasks.length;
  const doneTasks = client.tasks.filter((t) => t.done).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const hasOverdue = client.tasks.some((t) => !t.done && t.deadline && t.deadline < todayStr);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: client.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: client.color,
  };

  const handleRowClick = () => {
    if (isDraggingRef.current) return;
    navigate(`/clients/${client.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-4 rounded-2xl px-3 py-3 md:px-5 md:py-4 transition-shadow duration-150 hover:shadow-md cursor-pointer"
      onClick={handleRowClick}
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
      <span className="font-display font-semibold flex-1 min-w-0 truncate" style={{ color: textColor }}>
        {client.name}
      </span>
      {hasOverdue && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-100/80 text-red-600 flex-shrink-0">
          <AlertTriangle size={10} />
          Overdue
        </span>
      )}
      <span className="text-sm opacity-70 hidden sm:block flex-shrink-0" style={{ color: textColor }}>
        {totalTasks} task{totalTasks !== 1 ? 's' : ''}
      </span>
      <div className="flex-1 max-w-xs hidden sm:block">
        <div className="h-1.5 bg-white/40 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: textColor, opacity: 0.5 }}
          />
        </div>
      </div>
      <span className="text-sm font-mono opacity-60 flex-shrink-0 text-right" style={{ color: textColor }}>
        {pct}%
      </span>
      <button
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-50 transition-opacity cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        style={{ color: textColor }}
      >
        <GripVertical size={14} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(client.id); }}
        className="opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
        style={{ color: textColor }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function Clients({ clients, actions }) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [customHex, setCustomHex] = useState('');
  const [newLogo, setNewLogo] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const logoInputRef = useRef(null);
  const isDraggingRef = useRef(false);
  const { settings, formatMoney, convertAmount } = useSettings();

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const dndEnabled = search === '';

  const filtered = dndEnabled
    ? clients
    : clients
        .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
          if (sortBy === 'tasks') return b.tasks.length - a.tasks.length;
          return a.name.localeCompare(b.name);
        });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setTimeout(() => { isDraggingRef.current = false; }, 500);
    if (!over || active.id === over.id) return;
    const oldIndex = clients.findIndex((c) => c.id === active.id);
    const newIndex = clients.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(clients, oldIndex, newIndex);
    actions.saveClientOrder(newOrder.map((c) => c.id));
  }, [clients, actions]);

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
    const name = newName.trim();
    const color = selectedColor || getNextColor(clients);
    const logo = newLogo;
    // Close modal immediately to prevent double submission
    setNewName('');
    setCustomHex('');
    setNewLogo('');
    setShowModal(false);
    await actions.addClient(name, color, logo);
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

  // Palette for Add Client modal: hide used colors (show all if all used)
  const usedColors = new Set(clients.map((c) => c.color));
  const availablePalette = PALETTE.filter((c) => !usedColors.has(c));
  const paletteToShow = availablePalette.length > 0 ? availablePalette : PALETTE;

  return (
    <div className="p-4 md:p-6 lg:p-8 page-enter overflow-x-hidden">
      <h1 className="font-display text-2xl md:text-3xl lg:text-[2.75rem] leading-tight font-bold text-gray-900 mb-6 lg:mb-8">
        {settings.clients_label || 'Clients'}
      </h1>

      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="relative w-full md:flex-1 md:min-w-[200px] md:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${(settings.clients_label || 'Clients').toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white rounded-full border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
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
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
            style={{ backgroundColor: 'var(--accent, #667EEA)' }}
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <DndContext
          sensors={dndEnabled ? sensors : []}
          collisionDetection={closestCenter}
          onDragStart={dndEnabled ? handleDragStart : undefined}
          onDragEnd={dndEnabled ? handleDragEnd : undefined}
        >
          <SortableContext items={filtered.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className={`grid ${gridCols} gap-4`}>
              {filtered.map((client) => (
                <SortableGridCard
                  key={client.id}
                  client={client}
                  isDraggingRef={isDraggingRef}
                  onDelete={handleDeleteClient}
                  formatMoney={formatMoney}
                  convertAmount={convertAmount}
                  todayStr={todayStr}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <DndContext
          sensors={dndEnabled ? sensors : []}
          collisionDetection={closestCenter}
          onDragStart={dndEnabled ? handleDragStart : undefined}
          onDragEnd={dndEnabled ? handleDragEnd : undefined}
        >
          <SortableContext items={filtered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {filtered.map((client) => (
                <SortableListRow
                  key={client.id}
                  client={client}
                  isDraggingRef={isDraggingRef}
                  onDelete={handleDeleteClient}
                  todayStr={todayStr}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No clients found</p>
          <p className="text-sm mt-1">Try a different search or add a new client</p>
        </div>
      )}

      {/* Add Client Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-50 animate-fadeIn">
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full md:max-w-md shadow-xl animate-slideUp md:animate-slideDown max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {/* Drag handle — mobile only */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-1 mb-3 md:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold">New Client</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder={`${settings.clients_label || 'Client'} name`}
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
              <div className="flex gap-2 flex-wrap mb-3">
                {paletteToShow.map((color) => (
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
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
