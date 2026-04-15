import { useState, useEffect, useRef } from 'react';
import { Trash2, Check, Calendar, GripVertical } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

function formatWithCommas(val) {
  const num = parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num) || num === 0) return '';
  const rounded = Math.round(num * 100) / 100;
  const parts = rounded.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

function formatDeadline(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TaskItem({ task, onUpdate, onDelete, dragListeners, dragAttributes, noMoney = false }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [deleting, setDeleting] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [amountEditing, setAmountEditing] = useState(false);
  const dateInputRef = useRef(null);
  const { settings, convertAmount } = useSettings();

  const currencyLabel = settings.currency === 'USD' ? 'USD' : 'NGN';

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();
  const isOverdue = task.deadline && !task.done && task.deadline < todayStr;
  const isToday = task.deadline && task.deadline === todayStr;

  // Sync display amount when task amount/currency or viewing currency changes
  useEffect(() => {
    if (!amountEditing) {
      const converted = convertAmount(task.amount, task.currency);
      setAmountInput(converted > 0 ? formatWithCommas(converted) : '');
    }
  }, [task.amount, task.currency, settings.currency, settings.exchange_rate, amountEditing]); // eslint-disable-line

  const handleDone = () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 200);
    const newDone = !task.done;
    onUpdate({ ...task, done: newDone, paid: newDone ? task.paid : false });
  };

  const handlePaid = () => {
    onUpdate({ ...task, paid: !task.paid });
  };

  const toSentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  const handleTitleBlur = () => {
    setEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) {
      const cased = toSentenceCase(trimmed);
      setTitle(cased);
      onUpdate({ ...task, title: cased });
    } else {
      setTitle(task.title);
    }
  };

  const handleAmountChange = (e) => {
    const raw = e.target.value.replace(/,/g, '');
    if (!/^\d*\.?\d*$/.test(raw)) return;
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setAmountInput(parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0]);
  };

  const handleAmountBlur = () => {
    setAmountEditing(false);
    const raw = parseFloat(amountInput.replace(/,/g, '')) || 0;
    onUpdate({ ...task, amount: raw, currency: settings.currency });
    setAmountInput(raw > 0 ? formatWithCommas(raw) : '');
  };

  const handleDeadlineChange = (e) => {
    onUpdate({ ...task, deadline: e.target.value || null });
  };

  const handleDelete = () => {
    setDeleting(true);
    setTimeout(() => onDelete(task.id), 200);
  };

  return (
    <div
      className={`group flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-gray-50 transition-all duration-150 ${
        deleting ? 'animate-fadeOut' : 'animate-fadeIn'
      } ${isOverdue ? 'border-l-2 border-red-400 pl-3' : ''}`}
    >
      {/* Done checkbox */}
      <button
        onClick={handleDone}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
          bouncing ? 'animate-scaleBounce' : ''
        } ${task.done ? 'text-white' : 'border-gray-300'}`}
        style={task.done
          ? { backgroundColor: 'var(--accent, #667EEA)', borderColor: 'var(--accent, #667EEA)' }
          : {}}
        onMouseEnter={e => { if (!task.done) e.currentTarget.style.borderColor = 'var(--accent, #667EEA)'; }}
        onMouseLeave={e => { if (!task.done) e.currentTarget.style.borderColor = ''; }}
      >
        {task.done && <Check size={12} strokeWidth={3} />}
      </button>

      {/* Title + deadline label */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
            className="w-full bg-transparent border-b border-primary/30 outline-none text-sm py-0.5 font-medium"
          />
        ) : (
          <span
            onClick={() => setEditing(true)}
            className={`block text-sm font-medium cursor-text break-words whitespace-normal min-w-0 ${
              task.done ? 'line-through text-gray-400' : 'text-gray-800'
            }`}
          >
            {task.title}
          </span>
        )}
        {task.deadline && (
          <span className={`text-xs ${
            isOverdue ? 'text-red-500 font-medium' : isToday ? 'text-amber-500 font-medium' : 'text-gray-400'
          }`}>
            Due: {formatDeadline(task.deadline)}
          </span>
        )}
      </div>

      {/* Paid dot indicator */}
      {!noMoney && task.paid && <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />}

      {/* Amount */}
      {!noMoney && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-gray-400">{currencyLabel}</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={handleAmountChange}
            onFocus={() => setAmountEditing(true)}
            onBlur={handleAmountBlur}
            placeholder="0"
            className="w-16 sm:w-24 text-right text-sm font-mono bg-transparent outline-none text-gray-700 placeholder:text-gray-300"
          />
        </div>
      )}

      {/* Paid toggle */}
      {!noMoney && (
        <button
          onClick={handlePaid}
          className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 flex-shrink-0 ${
            task.paid
              ? 'bg-success text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-pending/20 hover:text-pending'
          }`}
        >
          {task.paid ? 'Paid' : 'Unpaid'}
        </button>
      )}

      {/* Trailing icons — calendar, delete, drag — all baseline-aligned */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Deadline calendar button */}
        <div className="relative">
          <button
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
            className={`flex items-center justify-center w-6 h-6 transition-colors ${
              isOverdue
                ? 'text-red-400 hover:text-red-600'
                : task.deadline
                ? 'text-amber-400 hover:text-amber-600'
                : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500'
            }`}
            title={task.deadline ? `Due: ${formatDeadline(task.deadline)}` : 'Set deadline'}
          >
            <Calendar size={14} />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={task.deadline || ''}
            onChange={handleDeadlineChange}
            className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
            tabIndex={-1}
          />
        </div>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="flex items-center justify-center w-6 h-6 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-danger transition-all duration-150"
        >
          <Trash2 size={14} />
        </button>

        {/* Drag handle */}
        {dragListeners && (
          <button
            {...dragListeners}
            {...dragAttributes}
            className="flex items-center justify-center w-6 h-6 opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity cursor-grab active:cursor-grabbing touch-none text-gray-400"
            tabIndex={-1}
          >
            <GripVertical size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
