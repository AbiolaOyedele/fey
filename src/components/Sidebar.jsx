import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, CreditCard, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[72px] bg-white border-r border-gray-100 flex flex-col items-center z-10">
      <div className="pt-5 pb-4">
        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
          <span className="text-white font-display font-bold text-sm">W</span>
        </div>
      </div>

      <nav className="flex-1 flex flex-col items-center gap-2 pt-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            className={({ isActive }) =>
              `w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`
            }
          >
            <Icon size={20} />
          </NavLink>
        ))}
      </nav>

      <div className="pb-5 flex flex-col items-center gap-3">
        <button className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all">
          <Settings size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-purple-400 flex items-center justify-center text-white text-xs font-semibold">
          A
        </div>
      </div>
    </aside>
  );
}
