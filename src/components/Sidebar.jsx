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
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[72px] bg-white border-r border-gray-100 flex-col items-center z-10">
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
              className="relative flex items-center justify-center w-12 h-12"
            >
              {/* Rotating seal shape */}
              <svg
                viewBox="0 0 295 295"
                className="absolute inset-0 w-full h-full animate-slow-rotate"
                style={{ fill: 'var(--accent, #667EEA)' }}
              >
                <path d="M280.977,118.478c-13.619-10.807-20.563-27.57-18.574-44.845c1.3-11.3-2.566-22.393-10.607-30.432
                  c-8.044-8.043-19.136-11.909-30.434-10.607c-17.281,1.986-34.037-4.954-44.844-18.573C169.449,5.11,158.872,0,147.499,0
                  c-11.374,0-21.951,5.11-29.021,14.02c-10.807,13.618-27.564,20.56-44.841,18.575c-11.3-1.305-22.393,2.563-30.435,10.605
                  c-8.043,8.04-11.909,19.133-10.609,30.435c1.989,17.272-4.954,34.035-18.576,44.844C5.11,125.549,0,136.126,0,147.498
                  s5.109,21.949,14.019,29.021c13.62,10.808,20.563,27.57,18.574,44.845c-1.3,11.3,2.566,22.393,10.607,30.432
                  c8.044,8.043,19.145,11.911,30.434,10.607c17.274-1.988,34.037,4.954,44.844,18.573c7.069,8.91,17.646,14.021,29.021,14.021
                  c11.373,0,21.95-5.11,29.02-14.02c10.808-13.618,27.565-20.559,44.841-18.575c11.301,1.299,22.393-2.563,30.435-10.605
                  c8.043-8.04,11.909-19.133,10.609-30.434c-1.989-17.273,4.955-34.037,18.576-44.845c8.907-7.07,14.017-17.647,14.017-29.02
                  S289.886,125.549,280.977,118.478z"/>
              </svg>
              {/* Fixed text on top */}
              <span className="relative z-10 text-white font-bold text-center whitespace-nowrap text-[10px]">
                New
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* Bottom nav — mobile/tablet only */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center justify-around z-20 lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '4rem' }}
      >
        <NavLink to="/" end
          className={({ isActive }) => `flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${isActive ? '' : 'text-gray-400'}`}
          style={({ isActive }) => isActive ? { color: accent } : {}}
        >
          <LayoutDashboard size={22} />
        </NavLink>

        {appMode !== 'tasks' && (
          <NavLink
            to="/clients"
            className={({ isActive }) => `flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${isActive ? '' : 'text-gray-400'}`}
            style={({ isActive }) => isActive ? { color: accent } : {}}
          >
            <Users size={22} />
          </NavLink>
        )}

        {appMode !== 'clients' && (
          <NavLink to="/tasks"
            className={({ isActive }) => `flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${isActive ? '' : 'text-gray-400'}`}
            style={({ isActive }) => isActive ? { color: accent } : {}}
          >
            <ListTodo size={22} />
          </NavLink>
        )}

        <NavLink to="/payments"
          className={({ isActive }) => `flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${isActive ? '' : 'text-gray-400'}`}
          style={({ isActive }) => isActive ? { color: accent } : {}}
        >
          <CreditCard size={22} />
        </NavLink>

        <NavLink to="/settings"
          className={({ isActive }) => `relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 ${isActive ? '' : 'text-gray-400'}`}
          style={({ isActive }) => isActive ? { color: accent } : {}}
        >
          <Settings size={22} />
          {showBadge && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: accent }}
            />
          )}
        </NavLink>
      </nav>

      {whatsNewOpen && (
        <WhatsNewPopup open={whatsNewOpen} onClose={handlePopupClose} />
      )}
    </>
  );
}
