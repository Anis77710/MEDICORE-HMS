import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarDays,
  Building2,
  Pill,
  Receipt,
  UserCog,
  BarChart3,
  ClipboardList,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { userCanAccessModule, type AdminModule } from '../../rbac/roles'
import { Avatar } from '../ui'
import { MedicoreLogo } from '../ui/MedicoreLogo'

const NAV_ITEMS: { to: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; end?: boolean; module: AdminModule }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true, module: 'dashboard' },
  { to: '/patients', label: 'Patients', icon: Users, module: 'patients' },
  { to: '/doctors', label: 'Doctors', icon: Stethoscope, module: 'doctors' },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, module: 'appointments' },
  { to: '/departments', label: 'Departments', icon: Building2, module: 'departments' },
  { to: '/pharmacy', label: 'Pharmacy', icon: Pill, module: 'pharmacy' },
  { to: '/billing', label: 'Billing', icon: Receipt, module: 'billing' },
  { to: '/staff', label: 'Staff', icon: UserCog, module: 'staff' },
  { to: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' },
  { to: '/consultations', label: 'Consultations', icon: ClipboardList, module: 'consultations' },
  { to: '/settings', label: 'Settings', icon: Settings, module: 'settings' },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const visible = NAV_ITEMS.filter((item) =>
    userCanAccessModule({ role: user?.role ?? 'STAFF', department: user?.department }, item.module),
  )
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo" style={{display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
          <MedicoreLogo size={32} />
        </div>
        <div>
          <h1>Medicore HMS</h1>
          <p>HMS Admin</p>
        </div>
        <button className="sidebar-mobile-close" onClick={onNavigate} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {visible.map((item) => (
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
          <Avatar name={user?.name ?? 'User'} size="md" />
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

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()

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
            <input placeholder="Search patients, doctors, appointments…" aria-label="Global search" />
          </div>
          <div className="topbar-right">
            <div className="topbar-avatar">
              <Avatar name={user?.name ?? 'User'} size="md" />
            </div>
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
