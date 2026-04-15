import { useState, useRef } from 'react';
import { Trash2, Check, Calendar, GripVertical } from 'lucide-react';

function formatDeadline(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const toSentenceCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export default function SimpleTaskItem({ task, onUpdate, onDelete, dragListeners, dragAttributes }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [deleting, setDeleting] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const dateInputRef = useRef(null);

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();
  const isOverdue = task.deadline && !task.done && task.deadline < todayStr;
  const isToday = task.deadline && task.deadline === todayStr;

  const handleDone = () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 200);
    onUpdate({ ...task, done: !task.done });
  };

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

  const handleDeadlineChange = (e) => {
    onUpdate({ ...task, deadline: e.target.value || null });
  };

  const handleDelete = () => {
    setDeleting(true);
    setTimeout(() => onDelete(task.id), 200);
  };

  return (
    <div
      className={`group flex items-center gap-2.5 py-2.5 px-3 rounded-xl transition-all duration-150 hover:bg-gray-50 ${
        deleting ? 'animate-fadeOut opacity-0' : ''
      }`}
    >
      {/* Overdue left accent */}
      {isOverdue && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-red-400" />
      )}

      {/* Checkbox */}
      <button
        onClick={handleDone}
        className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
          bouncing ? 'animate-scaleBounce' : ''
        } ${task.done ? 'text-white' : 'border-gray-200'}`}
        style={
          task.done
            ? { backgroundColor: 'var(--accent, #667EEA)', borderColor: 'var(--accent, #667EEA)' }
            : {}
        }
        onMouseEnter={(e) => { if (!task.done) e.currentTarget.style.borderColor = 'var(--accent, #667EEA)'; }}
        onMouseLeave={(e) => { if (!task.done) e.currentTarget.style.borderColor = ''; }}
      >
        {task.done && <Check size={10} strokeWidth={3} />}
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
            className="w-full bg-transparent outline-none text-sm border-b border-gray-200 pb-px"
          />
        ) : (
          <p
            onClick={() => setEditing(true)}
            className={`text-sm cursor-text truncate leading-snug ${
              task.done ? 'line-through text-gray-400' : 'text-gray-700'
            }`}
          >
            {task.title}
          </p>
        )}
      </div>

      {/* Deadline badge */}
      {task.deadline && (
        <span
          className={`flex-shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-md leading-none ${
            isOverdue
              ? 'bg-red-50 text-red-500'
              : isToday
              ? 'bg-amber-50 text-amber-600'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {formatDeadline(task.deadline)}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Calendar */}
        <div className="relative">
          <button
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
              isOverdue
                ? 'text-red-400 hover:bg-red-50'
                : task.deadline
                ? 'text-amber-400 hover:bg-amber-50'
                : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:bg-gray-100 hover:text-gray-500'
            }`}
            title={task.deadline ? `Due: ${formatDeadline(task.deadline)}` : 'Set deadline'}
          >
            <Calendar size={13} />
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
          className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-300 hover:bg-red-50 hover:text-red-400 transition-all"
        >
          <Trash2 size={13} />
        </button>

        {/* Drag handle */}
        {dragListeners && (
          <button
            {...dragListeners}
            {...dragAttributes}
            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing touch-none text-gray-300 transition-opacity"
            tabIndex={-1}
          >
            <GripVertical size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
