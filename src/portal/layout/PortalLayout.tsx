import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Stethoscope,
  CalendarPlus,
  CalendarDays,
  FileText,
  Pill,
  Bell,
  UserCircle,
  Star,
  Receipt,
  Activity,
  Search,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ShieldCheck,
  HeartPulse,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getUnreadCount } from '../../api/services/portal'

const NAV_ITEMS = [
  { to: '/portal', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/portal/doctors', label: 'Find Doctors', icon: Stethoscope },
  { to: '/portal/book', label: 'Book Appointment', icon: CalendarPlus },
  { to: '/portal/appointments', label: 'My Appointments', icon: CalendarDays },
  { to: '/portal/records', label: 'Medical Records', icon: FileText },
  { to: '/portal/prescriptions', label: 'Prescriptions', icon: Pill },
  { to: '/portal/billing', label: 'Billing & Payments', icon: Receipt },
  { to: '/portal/timeline', label: 'Health Timeline', icon: Activity },
  { to: '/portal/reviews', label: 'My Reviews', icon: Star },
  { to: '/portal/notifications', label: 'Notifications', icon: Bell },
  { to: '/portal/profile', label: 'My Profile', icon: UserCircle },
]

const DARK_KEY = 'healsync_portal_dark'

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem(DARK_KEY) === '1')
  useEffect(() => {
    localStorage.setItem(DARK_KEY, dark ? '1' : '0')
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}

function SidebarContent({
  onNavigate,
  unread,
}: {
  onNavigate?: () => void
  unread: number
}) {
  return (
    <div className="flex h-full flex-col">
      <Link
        to="/portal"
        onClick={onNavigate}
        className="flex items-center gap-3 px-5 pt-6 pb-7"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-teal-700 text-white shadow-md">
          <HeartPulse size={22} />
        </div>
        <div>
          <div className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            HealSync
          </div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
            Patient Portal
          </div>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {label === 'Notifications' && unread > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
        <div className="rounded-2xl bg-gradient-to-br from-cyan-50 to-teal-50 p-4 dark:from-slate-800 dark:to-slate-900 border border-cyan-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-800 dark:text-cyan-300">
            <ShieldCheck size={14} /> Secure & Confidential
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Your medical data is encrypted and accessible only to your care team.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PortalLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { dark, toggle } = useDarkMode()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    getUnreadCount().then(setUnread).catch(() => setUnread(0))
    const t = setInterval(() => getUnreadCount().then(setUnread).catch(() => {}), 30000)
    return () => clearInterval(t)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const firstName = (user?.name ?? 'Patient').split(' ')[0]

  return (
    <div className="portal-root dark:bg-[#0b1220]">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block dark:bg-slate-950 dark:border-slate-800">
          <div className="sticky top-0 h-screen">
            <SidebarContent unread={unread} />
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="p-slide-in absolute left-0 top-0 h-full w-72 bg-white shadow-2xl dark:bg-slate-950">
              <button
                className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
              <SidebarContent unread={unread} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6 dark:bg-slate-950/90 dark:border-slate-800">
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <Link
              to="/portal/search"
              className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-400 transition-colors hover:border-cyan-400 max-w-xl dark:border-slate-800 dark:bg-slate-900"
            >
              <Search size={16} />
              <span>Search doctors, appointments, prescriptions…</span>
            </Link>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={toggle}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Toggle dark mode"
                title="Toggle dark mode"
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              <Link
                to="/portal/notifications"
                className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Notifications"
              >
                <Bell size={17} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </Link>

              <Link
                to="/portal/profile"
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 py-1.5 pl-1.5 pr-3.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/70"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 text-xs font-bold text-white">
                  {firstName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {user?.name}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">
                    Patient
                  </div>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={17} />
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet context={{ refreshUnread: () => getUnreadCount().then(setUnread) }} />
          </main>

          <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
            HealSync Patient Portal · Secure online healthcare at your fingertips
          </footer>
        </div>
      </div>
    </div>
  )
}
