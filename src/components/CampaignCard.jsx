import { Link } from 'react-router-dom';
import { Layers, AlertTriangle } from 'lucide-react';
import { getContrastColor } from '../utils/colorContrast';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Campaign card — each campaign has its own independently chosen color.
 * Matches the client card design: colored background, progress bar, stats.
 */
export default function CampaignCard({ campaign, clientId }) {
  const { formatMoney, convertAmount } = useSettings();

  // Use the campaign's own color — NOT the client's color
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

  return (
    <Link
      to={`/clients/${clientId}/campaigns/${campaign.id}`}
      className="group rounded-2xl p-4 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden block"
      style={{ backgroundColor: bg }}
    >
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
        {campaign.logo ? (
          <img src={campaign.logo} alt={campaign.name} className="w-6 h-6 rounded-lg object-contain bg-white/70 p-0.5 flex-shrink-0" />
        ) : null}
        <h3 className="font-display text-lg font-bold leading-snug" style={{ color: textColor }}>
          {campaign.name}
        </h3>
      </div>
      <p className="text-sm mb-4 opacity-70" style={{ color: textColor }}>
        {done} completed · {total - done} pending
      </p>

      {/* Progress bar + avatar */}
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <div className="h-1.5 bg-white/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: textColor, opacity: 0.5 }}
            />
          </div>
        </div>
        {campaign.logo ? (
          <img src={campaign.logo} alt={campaign.name} className="w-8 h-8 rounded-full object-contain bg-white/70 p-0.5 flex-shrink-0" />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-white/50 flex-shrink-0"
            style={{ color: textColor }}
          >
            <Layers size={14} />
          </div>
        )}
      </div>
    </Link>
  );
}
