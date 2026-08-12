import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { MasterAuthProvider, useMasterAuth } from './context/MasterAuthContext'
import { ToastProvider, ToastViewport } from './context/ToastContext'
import { AppLayout } from './components/layout/AppLayout'
import { DoctorPortalLayout } from './components/layout/DoctorPortalLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './pages/auth/Login'
import ForgotPassword from './pages/auth/ForgotPassword'
import VerifyOtp from './pages/auth/VerifyOtp'
import Dashboard from './pages/Dashboard'
import Patients from './pages/patients/Patients'
import PatientDetail from './pages/patients/PatientDetail'
import Doctors from './pages/doctors/Doctors'
import DoctorDetail from './pages/doctors/DoctorDetail'
import Appointments from './pages/appointments/Appointments'
import Departments from './pages/departments/Departments'
import Pharmacy from './pages/pharmacy/Pharmacy'
import Billing from './pages/billing/Billing'
import Staff from './pages/staff/Staff'
import Reports from './pages/reports/Reports'
import Settings from './pages/settings/Settings'
import AdminConsultations from './pages/consultations/Consultations'
import HospitalCalendar from './pages/appointments/HospitalCalendar'
import NotFound from './pages/NotFound'
import StaffRoleDashboard from './pages/StaffRoleDashboard'
import LandingPage from './pages/landing/LandingPage'
import BookAppointmentPage from './pages/landing/BookAppointmentPage'
import { canAccessModule, type AdminModule } from './rbac/roles'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import MyAppointments from './pages/doctor/MyAppointments'
import MyPatients from './pages/doctor/MyPatients'
import PatientWorkspace from './pages/doctor/PatientWorkspace'
import Consultations from './pages/doctor/Consultations'
import ConsultationDetail from './pages/doctor/ConsultationDetail'
import ConsultationPage from './pages/doctor/ConsultationPage'
import DoctorPrescriptions from './pages/doctor/Prescriptions'
import DoctorMedicalRecords from './pages/doctor/MedicalRecords'
import LabPage from './pages/doctor/LabPage'
import ProfilePage from './pages/doctor/ProfilePage'
import DoctorSettings from './pages/doctor/SettingsPage'
import MasterLogin from './pages/master/MasterLogin'
import RegisterHospital from './pages/master/RegisterHospital'
import RegisterStatus from './pages/master/RegisterStatus'
import { MasterLayout } from './pages/master/MasterLayout'
import MasterDashboard from './pages/master/MasterDashboard'
import MasterHospitals from './pages/master/MasterHospitals'
import MasterRequests from './pages/master/MasterRequests'
import MasterReceipts from './pages/master/MasterReceipts'
import MasterSettings from './pages/master/MasterSettings'

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

function RequireDoctor({ children }: { children: React.ReactNode }) {
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

  if (user!.role !== 'DOCTOR') {
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

  if (user?.role === 'DOCTOR') {
    return <Navigate to="/doctor/dashboard" replace />
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

function MasterProtected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useMasterAuth()

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/master/login" replace />
  }

  return <>{children}</>
}

function MasterPublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useMasterAuth()
  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/master" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingRoute />} />
      <Route path="/book-appointment" element={<PublicOnly><BookAppointmentPage /></PublicOnly>} />

      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<Navigate to="/master/register" replace />} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/verify-otp" element={<PublicOnly><VerifyOtp /></PublicOnly>} />

      {/* Master platform */}
      <Route path="/master/login" element={<MasterPublicOnly><MasterLogin /></MasterPublicOnly>} />
      <Route path="/master/register" element={<RegisterHospital />} />
      <Route path="/master/register/status" element={<RegisterStatus />} />
      <Route path="/master" element={<MasterProtected><MasterLayout /></MasterProtected>}>
        <Route index element={<MasterDashboard />} />
        <Route path="hospitals" element={<MasterHospitals />} />
        <Route path="requests" element={<MasterRequests />} />
        <Route path="receipts" element={<MasterReceipts />} />
        <Route path="settings" element={<MasterSettings />} />
      </Route>

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<RoleHome />} />
        <Route path="/patients" element={<RequireModule module="patients"><Patients /></RequireModule>} />
        <Route path="/patients/:id" element={<RequireModule module="patients"><PatientDetail /></RequireModule>} />
        <Route path="/doctors" element={<RequireModule module="doctors"><Doctors /></RequireModule>} />
        <Route path="/doctors/:id" element={<RequireModule module="doctors"><DoctorDetail /></RequireModule>} />
        <Route path="/appointments" element={<RequireModule module="appointments"><Appointments /></RequireModule>} />
        <Route path="/appointments/calendar" element={<RequireModule module="appointments"><HospitalCalendar /></RequireModule>} />
        <Route path="/departments" element={<RequireModule module="departments"><Departments /></RequireModule>} />
        <Route path="/pharmacy" element={<RequireModule module="pharmacy"><Pharmacy /></RequireModule>} />
        <Route path="/billing" element={<RequireModule module="billing"><Billing /></RequireModule>} />
        <Route path="/staff" element={<RequireModule module="staff"><Staff /></RequireModule>} />
        <Route path="/reports" element={<RequireModule module="reports"><Reports /></RequireModule>} />
        <Route path="/consultations" element={<RequireModule module="consultations"><AdminConsultations /></RequireModule>} />
        <Route path="/settings" element={<RequireModule module="settings"><Settings /></RequireModule>} />
      </Route>

      {/* Doctor Portal */}
      <Route path="/doctor" element={<RequireDoctor><DoctorPortalLayout /></RequireDoctor>}>
        <Route path="dashboard" element={<DoctorDashboard />} />
        <Route path="appointments" element={<MyAppointments />} />
        <Route path="patients" element={<MyPatients />} />
        <Route path="patients/:patientId" element={<PatientWorkspace />} />
        <Route path="consultations" element={<Consultations />} />
        <Route path="consultations/new" element={<ConsultationPage />} />
        <Route path="consultations/:consultationId" element={<ConsultationDetail />} />
        <Route path="prescriptions" element={<DoctorPrescriptions />} />
        <Route path="medical-records" element={<DoctorMedicalRecords />} />
        <Route path="lab" element={<LabPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<DoctorSettings />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <MasterAuthProvider>
          <AuthProvider>
            <ToastProvider>
              <ScrollToTop />
              <AppRoutes />
              <ToastViewport />
            </ToastProvider>
          </AuthProvider>
        </MasterAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
