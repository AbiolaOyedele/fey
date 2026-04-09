import { useState } from 'react';
import { Trash2, Check } from 'lucide-react';

export default function TaskItem({ task, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [deleting, setDeleting] = useState(false);
  const [bouncing, setBouncing] = useState(false);

  const handleDone = () => {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 200);
    const newDone = !task.done;
    onUpdate({ ...task, done: newDone, paid: newDone ? task.paid : false });
  };

  const handlePaid = () => {
    if (!task.done) return;
    onUpdate({ ...task, paid: !task.paid });
  };

  const handleTitleBlur = () => {
    setEditing(false);
    if (title.trim() && title !== task.title) {
      onUpdate({ ...task, title: title.trim() });
    } else {
      setTitle(task.title);
    }
  };

  const handleAmount = (e) => {
    const val = parseInt(e.target.value) || 0;
    onUpdate({ ...task, amount: val });
  };

  const handleDelete = () => {
    setDeleting(true);
    setTimeout(() => onDelete(task.id), 200);
  };

  return (
    <div
      className={`group flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-gray-50 transition-all duration-150 ${
        deleting ? 'animate-fadeOut' : 'animate-fadeIn'
      }`}
    >
      {/* Done checkbox */}
      <button
        onClick={handleDone}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 flex-shrink-0 ${
          bouncing ? 'animate-scaleBounce' : ''
        } ${
          task.done
            ? 'bg-success border-success text-white'
            : 'border-gray-300 hover:border-primary'
        }`}
      >
        {task.done && <Check size={12} strokeWidth={3} />}
      </button>

      {/* Title */}
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
          className="flex-1 bg-transparent border-b border-primary/30 outline-none text-sm py-0.5 font-medium"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 text-sm font-medium cursor-text ${
            task.done ? 'line-through text-gray-400' : 'text-gray-800'
          }`}
        >
          {task.title}
        </span>
      )}

      {/* Paid dot indicator */}
      {task.paid && (
        <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
      )}

      {/* Amount */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-gray-400">NGN</span>
        <input
          type="number"
          value={task.amount || ''}
          onChange={handleAmount}
          placeholder="0"
          className="w-20 text-right text-sm font-mono bg-transparent outline-none text-gray-700 placeholder:text-gray-300"
        />
      </div>

      {/* Paid toggle */}
      <button
        onClick={handlePaid}
        disabled={!task.done}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 flex-shrink-0 ${
          task.paid
            ? 'bg-success text-white'
            : task.done
            ? 'bg-gray-100 text-gray-500 hover:bg-pending/20 hover:text-pending'
            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
        }`}
      >
        {task.paid ? 'Paid' : 'Unpaid'}
      </button>

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-danger transition-all duration-150 flex-shrink-0"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
