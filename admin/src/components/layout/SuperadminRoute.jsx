import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';

export default function SuperadminRoute() {
  const admin = useAuthStore((s) => s.admin);
  if (admin?.role !== 'superadmin') return <Navigate to="/" replace />;
  return <Outlet />;
}