import { useNavigate } from 'react-router-dom';
import { Layers, AlertTriangle, GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getContrastColor } from '../utils/colorContrast';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Draggable + deletable campaign card — mirrors client card behaviour.
 * Each campaign has its own independently chosen color (not the client's).
 */
export default function CampaignCard({ campaign, clientId, onDelete, isDraggingRef }) {
  const navigate = useNavigate();
  const { formatMoney, convertAmount } = useSettings();

  const bg        = campaign.color || '#E9D5FF';
  const textColor = getContrastColor(bg);

  const tasks      = campaign.tasks || [];
  const done       = tasks.filter((t) => t.done).length;
  const total      = tasks.length;
  const pct        = total > 0 ? Math.round((done / total) * 100) : 0;
  const hasOverdue = tasks.some((t) => !t.done && t.deadline && t.deadline < new Date().toISOString().slice(0, 10));
  const earned     = tasks
    .filter((t) => t.paid)
    .reduce((s, t) => s + convertAmount(t.amount || 0, t.currency || 'NGN'), 0);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: campaign.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCardClick = () => {
    if (isDraggingRef?.current) return;
    navigate(`/clients/${clientId}/campaigns/${campaign.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group rounded-2xl p-4 sm:p-5 transition-shadow duration-150 hover:shadow-lg relative overflow-hidden cursor-pointer"
      onClick={handleCardClick}
      aria-label={campaign.name}
    >
      {/* Colored background */}
      <div className="absolute inset-0 rounded-2xl" style={{ backgroundColor: bg }} />
      <div className="relative">

        {/* Top row: task count + badges */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/60 backdrop-blur-sm"
            style={{ color: textColor }}
          >
            <Layers size={11} />
            {done}/{total} tasks
          </span>
          <div className="flex items-center gap-1.5">
            {hasOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-red-100/80 text-red-600">
                <AlertTriangle size={10} />
                Overdue
              </span>
            )}
            {earned > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-white/70 text-green-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {formatMoney(earned)}
              </span>
            )}
          </div>
        </div>

        {/* Campaign name */}
        <div className="flex items-center gap-2 mb-1">
          {campaign.logo && (
            <img src={campaign.logo} alt={campaign.name} className="w-6 h-6 rounded-lg object-contain bg-white/70 p-0.5 flex-shrink-0" />
          )}
          <h3 className="font-display text-lg font-bold leading-snug truncate" style={{ color: textColor }}>
            {campaign.name}
          </h3>
        </div>
        <p className="text-sm mb-4 opacity-70" style={{ color: textColor }}>
          {done} completed · {total - done} pending
        </p>

        {/* Progress bar + drag handle + delete */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <div className="h-1.5 bg-white/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: textColor, opacity: 0.5 }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Drag handle */}
            <button
              {...listeners}
              {...attributes}
              onClick={(e) => e.stopPropagation()}
              className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/50 hover:bg-white/80 transition-all cursor-grab active:cursor-grabbing touch-none"
              style={{ color: textColor }}
            >
              <GripVertical size={12} />
            </button>
            {/* Delete */}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(campaign.id); }}
                className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/50 hover:bg-white/80 transition-all"
                style={{ color: textColor }}
              >
                <Trash2 size={12} />
              </button>
            )}
            {/* Logo or Layers icon */}
            {campaign.logo ? (
              <img src={campaign.logo} alt={campaign.name} className="w-7 h-7 rounded-full object-contain bg-white/70 p-0.5 flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/50 flex-shrink-0" style={{ color: textColor }}>
                <Layers size={13} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
