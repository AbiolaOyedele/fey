import { Info } from 'lucide-react';

/**
 * DemoBanner — a thin bar shown at the very top of the app in demo mode.
 * Uses the accent color as background. Sits above both the sidebar and the
 * main content area without interfering with the existing layout.
 */
export default function DemoBanner() {
  return (
    <div
      className="w-full flex items-center justify-center gap-2 px-4 text-white text-xs font-medium z-50 flex-shrink-0"
      style={{ backgroundColor: 'var(--accent, #667EEA)', minHeight: '2rem' }}
    >
      <Info size={13} className="flex-shrink-0" />
      <span>You are using a demo version of WorkBoard. Data resets on refresh.</span>
    </div>
  );
}
