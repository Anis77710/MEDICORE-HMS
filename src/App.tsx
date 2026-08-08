import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider, ToastViewport } from './context/ToastContext'
import { AppLayout } from './components/layout/AppLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
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
import StaffRoleDashboard from './pages/StaffRoleDashboard'
import LandingPage from './pages/landing/LandingPage'
import BookAppointmentPage from './pages/landing/BookAppointmentPage'
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
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
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

  if (user?.role === 'ADMIN') {
    return <Dashboard />
  }

  return <StaffRoleDashboard />
}

// Show landing for guests, redirect authenticated users to /dashboard
function LandingRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <LandingPage />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingRoute />} />
      <Route path="/book-appointment" element={<PublicOnly><BookAppointmentPage /></PublicOnly>} />

      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/verify-otp" element={<PublicOnly><VerifyOtp /></PublicOnly>} />

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<RoleHome />} />
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

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <ScrollToTop />
            <AppRoutes />
            <ToastViewport />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
