import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, Settings, ListTodo } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import WhatsNewPopup from './WhatsNewPopup';

export default function Sidebar() {
  const { settings } = useSettings();
  const accent = settings.accent_color || '#667EEA';
  const appMode = settings.app_mode || 'dual';

  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  // Badge visibility: active in settings, not yet dismissed, not expired after 24h
  useEffect(() => {
    const isActive = settings.whats_new_active === 'true';
    const currentVersion = settings.whats_new_version || '';
    if (!isActive || !currentVersion) { setShowBadge(false); return; }

    const dismissed = localStorage.getItem('whats_new_dismissed_version');
    if (dismissed === currentVersion) { setShowBadge(false); return; }

    const shownAt = localStorage.getItem('whats_new_shown_at');
    const now = Date.now();
    if (shownAt) {
      const elapsed = now - parseInt(shownAt, 10);
      if (elapsed > 24 * 60 * 60 * 1000) { setShowBadge(false); return; }
    } else {
      localStorage.setItem('whats_new_shown_at', String(now));
    }

    setShowBadge(true);
  }, [settings.whats_new_active, settings.whats_new_version]);

  const handlePopupClose = () => {
    setWhatsNewOpen(false);
    setShowBadge(false);
  };

  const navLinkClass = ({ isActive }) =>
    `w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
      isActive ? '' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
    }`;

  const navLinkStyle = ({ isActive }) =>
    isActive ? { backgroundColor: `${accent}15`, color: accent } : {};

  return (
    <>
      <aside className="fixed left-0 top-0 bottom-0 w-[72px] bg-white border-r border-gray-100 flex flex-col items-center z-10">
        {/* Logo */}
        <div className="pt-5 pb-4 cursor-pointer" onClick={() => window.location.reload()}>
          {settings.logo ? (
            <img src={settings.logo} alt="Logo" className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-white font-display font-bold text-sm">W</span>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 flex flex-col items-center gap-2 pt-2">
          <NavLink to="/" end title="Dashboard" className={navLinkClass} style={navLinkStyle}>
            <LayoutDashboard size={20} />
          </NavLink>

          {appMode !== 'tasks' && (
            <NavLink
              to="/clients"
              title={settings.clients_label || 'Clients'}
              className={navLinkClass}
              style={navLinkStyle}
            >
              <Users size={20} />
            </NavLink>
          )}

          {appMode !== 'clients' && (
            <NavLink to="/tasks" title="Tasks" className={navLinkClass} style={navLinkStyle}>
              <ListTodo size={20} />
            </NavLink>
          )}

          <NavLink to="/payments" title="Payments" className={navLinkClass} style={navLinkStyle}>
            <CreditCard size={20} />
          </NavLink>
        </nav>

        {/* Settings + What's New badge at bottom */}
        <div className="pb-5 pt-3 border-t border-gray-100 flex flex-col items-center gap-3">
          <NavLink to="/settings" title="Settings" className={navLinkClass} style={navLinkStyle}>
            <Settings size={20} />
          </NavLink>

          {showBadge && (
            <button
              onClick={() => setWhatsNewOpen(true)}
              title="What's New"
              className="flex items-center justify-center"
            >
              <span
                className="block text-[8px] font-bold text-white rounded-full leading-tight animate-slow-rotate px-1.5 py-0.5 text-center whitespace-nowrap"
                style={{ backgroundColor: 'var(--accent, #667EEA)', transformOrigin: 'center' }}
              >
                What's New
              </span>
            </button>
          )}
        </div>
      </aside>

      {whatsNewOpen && (
        <WhatsNewPopup open={whatsNewOpen} onClose={handlePopupClose} />
      )}
    </>
  );
}
