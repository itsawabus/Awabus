import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import UndoToasts from './UndoToasts.jsx';

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-navy-dark">
      <Sidebar />
      <div className="lg:pl-64">
        <Topbar />
        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      <UndoToasts />
    </div>
  );
}