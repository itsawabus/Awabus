import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import UndoToasts from './UndoToasts.jsx';
import ChooseSchool from './ChooseSchool.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { useViewSchoolStore } from '../../store/viewSchoolStore.js';

// Pages that are not about one school, so a superadmin can open them without
// choosing a school first.
const PLATFORM_PATHS = ['/platform', '/account', '/help', '/notifications'];

export default function AdminLayout() {
  const admin = useAuthStore((s) => s.admin);
  const school = useViewSchoolStore((s) => s.school);
  const { pathname } = useLocation();
  const isSuperadmin = admin?.role === 'superadmin';
  const schoolPage = !PLATFORM_PATHS.some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-navy-dark">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        {/* Keyed by the viewed school so switching schools starts every page afresh. */}
        <main key={isSuperadmin ? school?.id || 'none' : 'own-school'} className="p-4 sm:p-6">
          {isSuperadmin && schoolPage && school && (
            <p className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
              Platform view: you are looking at <span className="font-semibold">{school.name}</span>. Changes you make here apply to this school.
            </p>
          )}
          {isSuperadmin && schoolPage && !school ? <ChooseSchool /> : <Outlet />}
        </main>
      </div>
      <UndoToasts />
    </div>
  );
}
