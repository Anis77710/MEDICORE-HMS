import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Stethoscope,
  Pill,
  FolderOpen,
  FlaskConical,
  UserCircle,
  Settings,
  LogOut,
  X,
  AlertTriangle,
  PauseCircle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../ui'
import { MedicoreLogo } from '../ui/MedicoreLogo'
import { getDoctorProfile } from '../../api/services/doctorPortal'
import type { Doctor } from '../../types'

const NAV_ITEMS: { to: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; end?: boolean }[] = [
  { to: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/doctor/appointments', label: 'My Appointments', icon: CalendarDays },
  { to: '/doctor/patients', label: 'My Patients', icon: Users },
  { to: '/doctor/consultations', label: 'Consultations', icon: Stethoscope },
  { to: '/doctor/prescriptions', label: 'Prescriptions', icon: Pill },
  { to: '/doctor/medical-records', label: 'Medical Records', icon: FolderOpen },
  { to: '/doctor/lab', label: 'Lab & Investigations', icon: FlaskConical },
  { to: '/doctor/profile', label: 'My Profile', icon: UserCircle },
  { to: '/doctor/settings', label: 'Settings', icon: Settings },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <MedicoreLogo size={32} />
        </div>
        <div>
          <h1>Medicore HMS</h1>
          <p>Doctor Portal</p>
        </div>
        <button className="sidebar-mobile-close" onClick={onNavigate} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            data-testid={`nav-${item.label.toLowerCase()}`}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <Avatar name={user?.name ?? 'Doctor'} size="md" />
          <div className="sidebar-user-info">
            <strong>{user?.name}</strong>
            <span>{user?.department ?? 'Medicore HMS'}</span>
          </div>
          <button className="sidebar-logout" onClick={() => void logout()} title="Log out" data-testid="logout-btn">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  )
}

export function DoctorPortalLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    getDoctorProfile()
      .then((d) => {
        if (!cancelled) setDoctor(d)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  const restricted = doctor && doctor.status !== 'Active'

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${mobileOpen ? 'visible' : ''}`} onClick={() => setMobileOpen(false)} />
      <div className={`sidebar-wrap ${mobileOpen ? 'open' : ''}`}>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </div>

      <div className="app-main">
        <header className="topbar">
          <button className="topbar-burger" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="topbar-search">
            <span className="muted text-sm">Clinical workspace</span>
          </div>
          <div className="topbar-right">
            <div className="topbar-avatar">
              <Avatar name={user?.name ?? 'Doctor'} size="md" />
            </div>
          </div>
        </header>
        <main className="app-content">
          {restricted && (
            <div
              className={`dp-status-banner ${
                doctor!.status === 'Unavailable' ? 'dp-status-banner-unavailable' : 'dp-status-banner-on-leave'
              }`}
              role="alert"
            >
              {doctor!.status === 'Unavailable' ? <PauseCircle size={18} /> : <AlertTriangle size={18} />}
              <span>
                Your profile is marked <strong>{doctor!.status}</strong>. You can view data, but confirming
                appointments, starting consultations and issuing prescriptions are disabled until an
                administrator updates your status.
              </span>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
