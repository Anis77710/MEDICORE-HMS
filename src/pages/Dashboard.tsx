import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, CalendarDays, BedDouble, DollarSign, FileText } from 'lucide-react'
import { getDashboardStats } from '../api/services/misc'
import type { DashboardStats } from '../types'
import { useAuth } from '../context/AuthContext'
import { Card, StatCard, Spinner, Avatar, StatusBadge } from '../components/ui'
import { AreaChart, BarChart, DonutChart, Sparkline } from '../components/charts'

const TONE_ICON = {
  admission: { bg: 'var(--primary-soft)', color: 'var(--primary)' },
  discharge: { bg: 'var(--success-bg)', color: 'var(--success)' },
  lab: { bg: 'var(--info-bg)', color: 'var(--info)' },
  prescription: { bg: 'var(--purple-bg)', color: 'var(--purple)' },
  payment: { bg: 'var(--success-bg)', color: 'var(--success)' },
  appointment: { bg: 'var(--amber-bg)', color: 'var(--amber)' },
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getDashboardStats()
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <div className="auth-error">{error}</div>
  if (!stats) return <Spinner label="Loading dashboard…" />

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Good morning, {user?.name ?? 'Administrator'}</h1>
          <p className="page-subtitle">{today}</p>
        </div>
        <div className="page-actions">
          <Link to="/reports" className="btn btn-outline">
            <FileText size={16} /> Reports
          </Link>
          <Link to="/appointments" className="btn btn-primary">
            <CalendarDays size={16} /> Book Appointment
          </Link>
        </div>
      </div>

      <div className="grid-stats mb-4">
        <StatCard
          label="Total Patients"
          value={stats.totalPatients.toLocaleString()}
          change={stats.patientsChange}
          icon={<Users size={20} />}
          tone="teal"
          footer={<Sparkline values={[42, 48, 45, 58, 62, 66, 74, 70, 82, 88]} />}
        />
        <StatCard
          label="Appointments Today"
          value={stats.appointmentsToday.toLocaleString()}
          change={stats.appointmentsChange}
          icon={<CalendarDays size={20} />}
          tone="amber"
          footer={<Sparkline values={[20, 34, 28, 44, 52, 48, 60, 66, 71, 78]} color="#d97706" />}
        />
        <StatCard
          label="Bed Occupancy"
          value={`${stats.bedOccupancy}%`}
          change={stats.bedOccupancyChange}
          icon={<BedDouble size={20} />}
          tone="indigo"
          footer={<Sparkline values={[64, 68, 62, 70, 74, 71, 76, 78, 75, 78]} color="#4f46e5" />}
        />
        <StatCard
          label="Revenue This Month"
          value={`$${(stats.revenueMonth / 1_000_000).toFixed(1)}M`}
          change={stats.revenueChange}
          icon={<DollarSign size={20} />}
          tone="green"
          footer={<Sparkline values={[30, 42, 38, 55, 50, 64, 70, 66, 82, 94]} color="#059669" />}
        />
      </div>

      <div className="grid-2 mb-4">
        <Card padded>
          <div className="card-header" style={{ padding: 0, marginBottom: 12, border: 'none' }}>
            <div>
              <h3 className="card-title">Patient Admissions</h3>
              <p className="card-subtitle">Admissions vs discharges, 2026</p>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="dot-legend" style={{ background: 'var(--primary)' }} /> Admissions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="dot-legend" style={{ background: 'var(--border-strong)' }} /> Discharges
              </span>
            </div>
          </div>
          <AreaChart
            data={stats.admissionsTrend.map((m) => ({ label: m.month, value: m.admissions }))}
          />
          <AreaChart
            data={stats.admissionsTrend.map((m) => ({ label: m.month, value: m.discharges }))}
            color="#94a3b8"
          />
        </Card>

        <Card padded>
          <div className="card-header" style={{ padding: 0, marginBottom: 12, border: 'none' }}>
            <div>
              <h3 className="card-title">Department Workload</h3>
              <p className="card-subtitle">Active patients per department</p>
            </div>
          </div>
          <BarChart data={stats.departmentWorkload.map((d) => ({ label: d.department, value: d.patients }))} />
        </Card>
      </div>

      <div className="grid-3 mb-4">
        <Card padded>
          <div className="card-header" style={{ padding: 0, marginBottom: 14, border: 'none' }}>
            <div>
              <h3 className="card-title">Appointment Status</h3>
              <p className="card-subtitle">All-time distribution</p>
            </div>
          </div>
          <DonutChart
            data={stats.appointmentStatus.map((s) => ({ label: s.status, value: s.count }))}
            centerValue="2,808"
            centerLabel="Appointments"
          />
        </Card>

        <Card padded>
          <div className="card-header" style={{ padding: 0, marginBottom: 14, border: 'none' }}>
            <div>
              <h3 className="card-title">Today's Appointments</h3>
              <p className="card-subtitle">Next up on the schedule</p>
            </div>
            <Link to="/appointments" className="text-sm font-semibold">
              View all
            </Link>
          </div>
          <div className="appt-mini-list">
            {stats.upcomingAppointments.slice(0, 5).map((a) => (
              <div key={a.id} className="appt-mini">
                <Avatar name={a.patientName} size="md" />
                <div className="appt-mini-main">
                  <strong>{a.patientName}</strong>
                  <span className="muted text-xs">
                    {a.time} · {a.doctorName}
                  </span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card padded>
          <div className="card-header" style={{ padding: 0, marginBottom: 14, border: 'none' }}>
            <div>
              <h3 className="card-title">Recent Activity</h3>
              <p className="card-subtitle">Latest hospital events</p>
            </div>
          </div>
          <div className="timeline">
            {stats.recentActivity.map((ev) => {
              const tone = TONE_ICON[ev.type] ?? TONE_ICON.appointment
              return (
                <div key={ev.id} className="timeline-item">
                  <span
                    className="timeline-dot"
                    style={{ background: tone.color, boxShadow: `0 0 0 2px ${tone.bg}` }}
                  />
                  <div className="timeline-item-title">{ev.message}</div>
                  <div className="timeline-item-time">
                    {ev.time} · {ev.actor}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card padded>
        <div className="card-header" style={{ padding: 0, marginBottom: 16, border: 'none' }}>
          <div>
            <h3 className="card-title">Department Bed Occupancy</h3>
            <p className="card-subtitle">Current utilization vs capacity</p>
          </div>
        </div>
        <div className="dept-occ-grid">
          {stats.departmentOccupancy.map((d) => {
            const pct = Math.round((d.occupied / d.capacity) * 100)
            const color =
              pct >= 90 ? 'var(--danger)' : pct >= 75 ? 'var(--warning)' : 'var(--primary)'
            return (
              <div key={d.department} className="dept-occ">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold text-sm">{d.department}</span>
                  <span className="text-sm muted">
                    {d.occupied}/{d.capacity} beds
                  </span>
                </div>
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}
