/**
 * WelcomeGuide — a non-intrusive floating tip card shown to first-time users.
 * Walks through the 6 main areas of WorkBoard, one tip at a time.
 * Dismissed state is stored in localStorage so it never reappears.
 */
import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, LayoutDashboard, Users, CheckSquare, CreditCard, Settings, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to WorkBoard 👋',
    body: 'A quick tour to help you get started. You can dismiss this at any time — it won\'t appear again.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    body: 'Your home base. See total earnings, task progress, and upcoming deadlines at a glance. Filter between Active, Overdue, and Unpaid work.',
  },
  {
    icon: Users,
    title: 'Clients',
    body: 'Add a client for every person or business you work with. Each client has their own workspace with tasks, deadlines, and payment tracking.',
  },
  {
    icon: CheckSquare,
    title: 'Tasks',
    body: 'Use Task Groups to organise personal to-dos that aren\'t tied to a client — think project phases, admin work, or recurring items.',
  },
  {
    icon: CreditCard,
    title: 'Payments',
    body: 'A monthly breakdown of everything you\'ve earned and what\'s still pending. Mark tasks and retainers as paid as money comes in.',
  },
  {
    icon: Settings,
    title: 'Settings',
    body: 'Customise your accent colour, fonts, currency, and dashboard heading. You can also rename "Clients" to whatever fits your workflow.',
  },
];

const STORAGE_KEY = (userId) => `wb:guide_seen:${userId}`;

export default function WelcomeGuide() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    // Only show after onboarding is complete and guide hasn't been dismissed
    if (settings.onboarding_complete !== 'true') return;
    // Always show for preview — remove this line after testing
    localStorage.removeItem(STORAGE_KEY(user.id));
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [user?.id, settings.onboarding_complete]);

  const dismiss = () => {
    if (user?.id) localStorage.setItem(STORAGE_KEY(user.id), 'true');
    setVisible(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed bottom-24 lg:bottom-6 right-4 lg:right-20 z-50 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
      style={{ animation: 'slideUp 0.3s ease-out' }}
    >
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full transition-all duration-300 rounded-full"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%`, backgroundColor: 'var(--accent, #ED64A6)' }}
        />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--accent, #ED64A6) 12%, white)' }}>
              <Icon size={16} style={{ color: 'var(--accent, #ED64A6)' }} />
            </div>
            <p className="text-sm font-semibold text-gray-800">{current.title}</p>
          </div>
          <button
            onClick={dismiss}
            className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5"
            title="Dismiss guide"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{current.body}</p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {/* Dots */}
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                onClick={() => setStep(i)}
                className="rounded-full transition-all duration-200 cursor-pointer flex-shrink-0"
                style={{
                  display: 'block',
                  width: i === step ? '14px' : '5px',
                  height: '5px',
                  backgroundColor: i === step ? 'var(--accent, #ED64A6)' : '#D1D5DB',
                }}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                onClick={prev}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={13} />
                Back
              </button>
            )}
            <button
              onClick={next}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent, #ED64A6)' }}
            >
              {isLast ? 'Done' : 'Next'}
              {!isLast && <ChevronRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
