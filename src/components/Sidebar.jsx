import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, Settings } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
];

export default function Sidebar() {
  const { settings } = useSettings();
  const accent = settings.accent_color || '#667EEA';

  const navLinkClass = ({ isActive }) =>
    `w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
      isActive ? '' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
    }`;

  const navLinkStyle = ({ isActive }) =>
    isActive ? { backgroundColor: `${accent}15`, color: accent } : {};

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[72px] bg-white border-r border-gray-100 flex flex-col items-center z-10">
      {/* Logo */}
      <div className="pt-5 pb-4">
        {settings.logo ? (
          <img
            src={settings.logo}
            alt="Logo"
            className="w-10 h-10 rounded-xl object-cover"
          />
        ) : (
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
            <span className="text-white font-display font-bold text-sm">W</span>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 flex flex-col items-center gap-2 pt-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            className={navLinkClass}
            style={navLinkStyle}
          >
            <Icon size={20} />
          </NavLink>
        ))}
      </nav>

      {/* Settings at bottom, separated */}
      <div className="pb-5 pt-3 border-t border-gray-100 flex flex-col items-center">
        <NavLink
          to="/settings"
          title="Settings"
          className={navLinkClass}
          style={navLinkStyle}
        >
          <Settings size={20} />
        </NavLink>
      </div>
    </aside>
  );
}
