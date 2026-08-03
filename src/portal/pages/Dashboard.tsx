import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Pill,
  FileText,
  Bell,
  ChevronRight,
  CalendarPlus,
  Stethoscope,
  Clock,
} from 'lucide-react'
import { getMyPatient } from '../../api/services/portal/me'
import { listMyAppointments } from '../../api/services/portal/appointments'
import { listMyPrescriptions } from '../../api/services/portal/prescriptions'
import { listMedicalRecords } from '../../api/services/portal/records'
import { listNotifications } from '../../api/services/portal/notifications'
import type { Patient } from '../../types'
import type { Appointment } from '../../types'
import type { PortalNotification } from '../../types/portal'
import { StatCard, Skeleton, EmptyState, StatusPill, DoctorAvatar } from '../components'

const today = () => new Date().toISOString().slice(0, 10)

export default function PortalDashboard() {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [upcoming, setUpcoming] = useState(0)
  const [completed, setCompleted] = useState(0)
  const [rxCount, setRxCount] = useState(0)
  const [recCount, setRecCount] = useState(0)
  const [nextAppt, setNextAppt] = useState<{ date: string; time: string; doctorName: string; type: string } | null>(null)
  const [recentAppts, setRecentAppts] = useState<Appointment[]>([])
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [notifs, setNotifs] = useState<PortalNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await getMyPatient()
        if (cancelled) return
        const [appts, rxs, recs, notifAll] = await Promise.all([
          listMyAppointments(me.id, {}),
          listMyPrescriptions(me.id),
          listMedicalRecords(me.id),
          listNotifications(),
        ])
        if (cancelled) return
        setPatient(me)
        setUpcoming(appts.filter((a) => (a.status === 'Confirmed' || a.status === 'Pending') && a.date >= today()).length)
        setCompleted(appts.filter((a) => a.status === 'Completed').length)
        setRxCount(rxs.length)
        setRecCount(recs.length)
        const upcomingSorted = appts
          .filter((a) => (a.status === 'Confirmed' || a.status === 'Pending') && a.date >= today())
          .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        setNextAppt(upcomingSorted[0] ?? null)
        setRecentAppts(upcomingSorted.slice(0, 3))
        setUnreadNotifs(notifAll.filter((n) => !n.read).length)
        setNotifs(notifAll.slice(0, 4))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const firstName = (patient?.firstName ?? 'there').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-16 text-center">
        <div className="text-3xl">⚠️</div>
        <h3 className="font-bold text-red-700">Failed to load your dashboard</h3>
        <p className="text-sm text-red-600/80">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Here's what's happening with your health today.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/portal/doctors" className="p-btn p-btn-outline">
            <Stethoscope size={16} /> Find Doctor
          </Link>
          <Link to="/portal/book" className="p-btn p-btn-primary">
            <CalendarPlus size={16} /> Book Appointment
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Upcoming" value={upcoming} tone="cyan" sub="appointments" />
        <StatCard icon={CheckCircle2} label="Completed" value={completed} tone="green" sub="appointments" />
        <StatCard icon={Pill} label="Prescriptions" value={rxCount} tone="purple" sub="active & past" />
        <StatCard icon={FileText} label="Medical Records" value={recCount} tone="blue" sub="reports & history" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Next appointment */}
        <div className="p-card p-card-hover p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">
              Next Appointment
            </h3>
            <Link to="/portal/appointments" className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
              View all
            </Link>
          </div>
          {nextAppt ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <DoctorAvatar name={nextAppt.doctorName} size="lg" />
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">{nextAppt.doctorName}</div>
                  <div className="text-sm text-slate-400">{nextAppt.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-cyan-50 p-3 text-sm font-semibold text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-300">
                <Clock size={16} />
                {formatDate(nextAppt.date)} · {nextAppt.time}
              </div>
              <Link to="/portal/appointments" className="p-btn p-btn-outline w-full">
                Manage appointment <ChevronRight size={15} />
              </Link>
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming appointments"
              hint="Book a consultation with a specialist."
              action={
                <Link to="/portal/book" className="p-btn p-btn-primary">
                  <CalendarPlus size={16} /> Book now
                </Link>
              }
            />
          )}
        </div>

        {/* Recent activity / appointments */}
        <div className="p-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">
              Upcoming Schedule
            </h3>
          </div>
          {recentAppts.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No appointments scheduled" />
          ) : (
            <div className="space-y-3">
              {recentAppts.map((a) => (
                <Link
                  key={a.id}
                  to="/portal/appointments"
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-cyan-300 hover:bg-cyan-50/50 dark:border-slate-800 dark:hover:border-cyan-700 dark:hover:bg-cyan-500/5"
                >
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-500/10">
                    <span className="text-sm font-extrabold text-cyan-700 dark:text-cyan-300">
                      {a.date.slice(8, 10)}
                    </span>
                    <span className="text-[9px] font-semibold uppercase text-cyan-500">
                      {monthName(a.date)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {a.doctorName}
                    </div>
                    <div className="truncate text-xs text-slate-400">{a.type} · {a.time}</div>
                  </div>
                  <StatusPill status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="p-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">Notifications</h3>
            <Link to="/portal/notifications" className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
              {unreadNotifs > 0 ? `${unreadNotifs} unread` : 'View all'}
            </Link>
          </div>
          {notifs.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" />
          ) : (
            <div className="space-y-2.5">
              {notifs.map((n) => (
                <Link
                  key={n.id}
                  to={n.link ?? '/portal/notifications'}
                  className={`block rounded-xl border p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${n.read ? 'border-slate-100 dark:border-slate-800' : 'border-cyan-200 bg-cyan-50/60 dark:border-cyan-800 dark:bg-cyan-500/10'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-500" />}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {n.title}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
                        {n.message}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function monthName(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short' })
}
