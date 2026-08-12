import { useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { useMasterAuth } from '../../context/MasterAuthContext'
import { Avatar } from '../../components/ui'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Receipt,
  Settings,
  LogOut,
  X,
} from 'lucide-react'

const NAV_ITEMS: { to: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; end?: boolean }[] = [
  { to: '/master', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/master/hospitals', label: 'Hospitals', icon: Building2 },
  { to: '/master/requests', label: 'Requests', icon: ClipboardList },
  { to: '/master/receipts', label: 'Receipts', icon: Receipt },
  { to: '/master/settings', label: 'Platform Settings', icon: Settings },
]

function MasterSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { admin, logout } = useMasterAuth()
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div
          className="sidebar-logo"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        >
          <MedicoreLogo size={32} />
        </div>
        <div>
          <h1>Medicore HMS</h1>
          <p>Platform Admin</p>
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
            data-testid={`master-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
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
          <Avatar name={admin?.name ?? 'Admin'} size="md" />
          <div className="sidebar-user-info">
            <strong>{admin?.name}</strong>
            <span>{admin?.email ?? 'Platform administrator'}</span>
          </div>
          <button className="sidebar-logout" onClick={() => void logout()} title="Log out" data-testid="master-logout-btn">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  )
}

export function MasterLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${mobileOpen ? 'visible' : ''}`} onClick={() => setMobileOpen(false)} />
      <div className={`sidebar-wrap ${mobileOpen ? 'open' : ''}`}>
        <MasterSidebar onNavigate={() => setMobileOpen(false)} />
      </div>

      <div className="app-main">
        <header className="topbar">
          <button className="topbar-burger" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="topbar-title">
            <Link to="/" className="topbar-title-link">View public site</Link>
          </div>
          <div className="topbar-right">
            <div className="topbar-avatar">
              <Avatar name="Admin" size="md" />
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
