import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  Milestone,
  Bus as BusIcon,
  Users,
  GraduationCap,
  Navigation,
  History,
  Moon,
  Sun,
  LogOut,
  X,
  Building2,
  BookOpen,
  Wrench,
} from 'lucide-react';
import { useUiStore } from '../../store/uiStore.js';
import { useAuthStore } from '../../store/authStore.js';
import useConfirmSignOut from './useConfirmSignOut.jsx';
import { API_URL } from '../../api/client.js';
import { cn } from '../../lib/utils.js';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/routes', label: 'Routes', icon: Milestone },
  { to: '/buses', label: 'Buses', icon: BusIcon },
  { to: '/drivers', label: 'Drivers', icon: Users },
  { to: '/students', label: 'Students', icon: GraduationCap },
  { to: '/live-tracking', label: 'Live Tracking', icon: Navigation },
  { to: '/trip-history', label: 'Trip History', icon: History },
  { to: '/help', label: 'Help & Guide', icon: BookOpen },
];

const SUPERADMIN_NAV_ITEM = { to: '/platform', label: 'Platform', icon: Building2, end: true };
const SYSTEM_NAV_ITEM = { to: '/system', label: 'System', icon: Wrench };

export default function Sidebar() {
  const { darkMode, toggleDarkMode } = useUiStore();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const closeSidebar = useUiStore((s) => s.closeSidebar);
  const admin = useAuthStore((s) => s.admin);
  const [requestSignOut, signOutDialog] = useConfirmSignOut();

  // Superadmins are the developers: they get the System page instead of Help & Guide.
  const navItems =
    admin?.role === 'superadmin'
      ? [SUPERADMIN_NAV_ITEM, ...NAV_ITEMS.filter((i) => i.to !== '/help'), SYSTEM_NAV_ITEM]
      : NAV_ITEMS;

  return (
    <>
      {/* Backdrop, mobile only, shown when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy px-4 py-6',
          'transition-transform duration-300 ease-in-out',
          'lg:translate-x-0 lg:z-30',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="mb-8 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <img 
            src="/awabus1.png" 
            alt="AWABUS Logo" 
            className="w-50 h-auto"
          />
          </div>

          {/* Close button, mobile only */}
          <button
            onClick={closeSidebar}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeSidebar}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between px-1">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Moon className="h-4 w-4" /> Dark mode
            </span>
            <button
              onClick={toggleDarkMode}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                darkMode ? 'bg-brand-600' : 'bg-slate-600'
              )}
              aria-label="Toggle dark mode"
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  darkMode ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
          <button
            onClick={requestSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          {import.meta.env.DEV && (
            // Development only: which server this portal talks to, so it can be
            // matched with the driver app's EXPO_PUBLIC_API_URL.
            <p className="mt-3 truncate text-center text-[11px] text-white/50" title={API_URL}>
              Server: {API_URL.startsWith('/') ? 'this Codespace / computer' : API_URL.replace(/^https?:\/\//, '').replace(/\/api$/, '')}
            </p>
          )}
        </div>
      </aside>
      {signOutDialog}
    </>
  );
}