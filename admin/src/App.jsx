import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/layout/AdminLayout.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import SuperadminRoute from './components/layout/SuperadminRoute.jsx';

import SignIn from './pages/auth/SignIn.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import VerifyOtp from './pages/auth/VerifyOtp.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';
import ResetSuccess from './pages/auth/ResetSuccess.jsx';

import Dashboard from './pages/dashboard/Dashboard.jsx';
import SuperadminDashboard from './pages/superadmin/SuperadminDashboard.jsx';

import RoutesList from './pages/routes/RoutesList.jsx';
import AddRoute from './pages/routes/AddRoute.jsx';
import EditRoute from './pages/routes/EditRoute.jsx';

import DriversList from './pages/drivers/DriversList.jsx';
import DriverProfile from './pages/drivers/DriverProfile.jsx';
import AddDriver from './pages/drivers/AddDriver.jsx';
import EditDriver from './pages/drivers/EditDriver.jsx';

import StudentsList from './pages/students/StudentsList.jsx';
import StudentProfile from './pages/students/StudentProfile.jsx';
import AddStudent from './pages/students/AddStudent.jsx';
import EditStudent from './pages/students/EditStudent.jsx';

import BusesList from './pages/buses/BusesList.jsx';
import RegisterBus from './pages/buses/RegisterBus.jsx';
import BusProfile from './pages/buses/BusProfile.jsx';
import EditBus from './pages/buses/EditBus.jsx';

import TripHistory from './pages/trips/TripHistory.jsx';
import TripDetails from './pages/trips/TripDetails.jsx';

import LiveTracking from './pages/tracking/LiveTracking.jsx';
import LiveTripDetail from './pages/tracking/LiveTripDetail.jsx';

import MyProfile from './pages/account/MyProfile.jsx';
import AccountSettings from './pages/account/AccountSettings.jsx';
import HelpGuide from './pages/help/HelpGuide.jsx';
import Notifications from './pages/notifications/Notifications.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-success" element={<ResetSuccess />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Dashboard />} />

          <Route path="/account" element={<Navigate to="/account/profile" replace />} />
          <Route path="/account/profile" element={<MyProfile />} />
          <Route path="/account/settings" element={<AccountSettings />} />

          <Route element={<SuperadminRoute />}>
            <Route path="/platform" element={<SuperadminDashboard />} />
          </Route>

          <Route path="/routes" element={<RoutesList />} />
          <Route path="/routes/new" element={<AddRoute />} />
          <Route path="/routes/:id/edit" element={<EditRoute />} />

          <Route path="/drivers" element={<DriversList />} />
          <Route path="/drivers/new" element={<AddDriver />} />
          <Route path="/drivers/:id" element={<DriverProfile />} />
          <Route path="/drivers/:id/edit" element={<EditDriver />} />

          <Route path="/students" element={<StudentsList />} />
          <Route path="/students/new" element={<AddStudent />} />
          <Route path="/students/:id" element={<StudentProfile />} />
          <Route path="/students/:id/edit" element={<EditStudent />} />

          <Route path="/buses" element={<BusesList />} />
          <Route path="/buses/new" element={<RegisterBus />} />
          <Route path="/buses/:id" element={<BusProfile />} />
          <Route path="/buses/:id/edit" element={<EditBus />} />

          <Route path="/trip-history" element={<TripHistory />} />
          <Route path="/trip-history/:id" element={<TripDetails />} />

          <Route path="/live-tracking" element={<LiveTracking />} />
          <Route path="/live-tracking/:tripId" element={<LiveTripDetail />} />

          <Route path="/notifications" element={<Notifications />} />
          <Route path="/help" element={<HelpGuide />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}