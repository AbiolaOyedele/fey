import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ClientCard({ client, onDelete, viewMode = 'grid' }) {
  const totalTasks = client.tasks.length;
  const doneTasks = client.tasks.filter((t) => t.done).length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(client.id);
  };

  if (viewMode === 'list') {
    return (
      <Link
        to={`/clients/${client.id}`}
        className="group flex items-center gap-4 bg-white rounded-2xl px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
      >
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: client.color }}
        />
        <span className="font-display font-semibold text-gray-900 w-40 truncate">
          {client.name}
        </span>
        <span className="text-sm text-gray-500 w-24">
          {totalTasks} task{totalTasks !== 1 ? 's' : ''}
        </span>
        <div className="flex-1 max-w-xs">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#48BB78' : '#ED64A6' }}
            />
          </div>
        </div>
        <span className="text-sm font-mono text-gray-400 w-12 text-right">{pct}%</span>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-danger transition-all duration-150 ml-2"
        >
          <Trash2 size={16} />
        </button>
      </Link>
    );
  }

  return (
    <Link
      to={`/clients/${client.id}`}
      className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 block relative overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl"
        style={{ backgroundColor: client.color }}
      />
      <div className="flex items-start justify-between mt-1">
        <h3 className="font-display font-semibold text-lg text-gray-900">{client.name}</h3>
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-danger transition-all duration-150"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <p className="text-sm text-gray-500 mt-2">
        {doneTasks}/{totalTasks} task{totalTasks !== 1 ? 's' : ''} done
      </p>
      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#48BB78' : '#ED64A6' }}
        />
      </div>
      <span className="text-xs font-mono text-gray-400 mt-1.5 inline-block">{pct}%</span>
    </Link>
  );
}
