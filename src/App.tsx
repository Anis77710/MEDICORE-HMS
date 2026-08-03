import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider, ToastViewport } from './context/ToastContext'
import { AppLayout } from './components/layout/AppLayout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import VerifyOtp from './pages/auth/VerifyOtp'
import Dashboard from './pages/Dashboard'
import Patients from './pages/patients/Patients'
import PatientDetail from './pages/patients/PatientDetail'
import Doctors from './pages/doctors/Doctors'
import Appointments from './pages/appointments/Appointments'
import Departments from './pages/departments/Departments'
import Pharmacy from './pages/pharmacy/Pharmacy'
import Billing from './pages/billing/Billing'
import Staff from './pages/staff/Staff'
import Reports from './pages/reports/Reports'
import Settings from './pages/settings/Settings'
import NotFound from './pages/NotFound'
import PortalLayout from './portal/layout/PortalLayout'
import PortalDashboard from './portal/pages/Dashboard'
import PortalDoctors from './portal/pages/Doctors'
import DoctorProfile from './portal/pages/DoctorProfile'
import BookAppointment from './portal/pages/BookAppointment'
import MyAppointments from './portal/pages/Appointments'
import MedicalRecords from './portal/pages/Records'
import Prescriptions from './portal/pages/Prescriptions'
import Notifications from './portal/pages/Notifications'
import PortalProfile from './portal/pages/Profile'
import MyReviews from './portal/pages/Reviews'
import BillingPage from './portal/pages/Billing'
import HealthTimeline from './portal/pages/Timeline'
import SearchPage from './portal/pages/SearchPage'
import StaffRoleDashboard from './pages/StaffRoleDashboard'
import { canAccessModule, type AdminModule } from './rbac/roles'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AppLayout />
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function PortalProtected() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'PATIENT') {
    return <Navigate to="/" replace />
  }

  return <PortalLayout />
}

function RequireModule({ module, children }: { module: AdminModule; children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!canAccessModule(user!.role, module)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function RoleHome() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role === 'PATIENT') {
    return <Navigate to="/portal" replace />
  }

  if (user?.role === 'ADMIN') {
    return <Dashboard />
  }

  return <StaffRoleDashboard />
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <Register />
          </PublicOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPassword />
          </PublicOnly>
        }
      />
      <Route
        path="/verify-otp"
        element={
          <PublicOnly>
            <VerifyOtp />
          </PublicOnly>
        }
      />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<RoleHome />} />
        <Route path="/patients" element={<RequireModule module="patients"><Patients /></RequireModule>} />
        <Route path="/patients/:id" element={<RequireModule module="patients"><PatientDetail /></RequireModule>} />
        <Route path="/doctors" element={<RequireModule module="doctors"><Doctors /></RequireModule>} />
        <Route path="/appointments" element={<RequireModule module="appointments"><Appointments /></RequireModule>} />
        <Route path="/departments" element={<RequireModule module="departments"><Departments /></RequireModule>} />
        <Route path="/pharmacy" element={<RequireModule module="pharmacy"><Pharmacy /></RequireModule>} />
        <Route path="/billing" element={<RequireModule module="billing"><Billing /></RequireModule>} />
        <Route path="/staff" element={<RequireModule module="staff"><Staff /></RequireModule>} />
        <Route path="/reports" element={<RequireModule module="reports"><Reports /></RequireModule>} />
        <Route path="/settings" element={<RequireModule module="settings"><Settings /></RequireModule>} />
      </Route>

      <Route path="/portal" element={<PortalProtected />}>
        <Route index element={<PortalDashboard />} />
        <Route path="doctors" element={<PortalDoctors />} />
        <Route path="doctors/:id" element={<DoctorProfile />} />
        <Route path="book" element={<BookAppointment />} />
        <Route path="appointments" element={<MyAppointments />} />
        <Route path="records" element={<MedicalRecords />} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="timeline" element={<HealthTimeline />} />
        <Route path="reviews" element={<MyReviews />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<PortalProfile />} />
        <Route path="search" element={<SearchPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ScrollToTop />
          <AppRoutes />
          <ToastViewport />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
