import { useEffect, useState } from 'react'
import {
  Users,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getDashboardStats } from '../api/services/misc'
import type { DashboardStats } from '../types'
import { ROLE_META } from '../rbac/roles'
import { Card, StatCard, Spinner } from '../components/ui'

export default function StaffRoleDashboard() {
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load overview')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const role = user?.role ?? 'STAFF'
  const meta = ROLE_META[role]
  const firstName = (user?.name ?? 'there').replace(/^(Dr\.?|Nurse|Mr\.?|Mrs\.?|Ms\.?)\s*/i, '').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting}, {firstName}
          </h1>
          <p className="page-subtitle">
            {user?.department ? `${user.department} · ` : ''}
            {meta.title}
          </p>
        </div>
      </div>

      {error ? (
        <div className="auth-error">{error}</div>
      ) : !stats ? (
        <Spinner label="Loading overview…" />
      ) : (
        <>
          <div className="grid-stats mb-4">
            <StatCard
              label="Appointments Today"
              value={stats.appointmentsToday.toLocaleString()}
              change={stats.appointmentsChange}
              icon={<CalendarDays size={20} />}
              tone="amber"
            />
            <StatCard
              label="Total Patients"
              value={stats.totalPatients.toLocaleString()}
              change={stats.patientsChange}
              icon={<Users size={20} />}
              tone="teal"
            />
            <StatCard
              label="Bed Occupancy"
              value={`${stats.bedOccupancy}%`}
              change={stats.bedOccupancyChange}
              icon={<Building2 size={20} />}
              tone="indigo"
            />
          </div>

          <Card padded>
            <div className="card-header" style={{ padding: 0, marginBottom: 14, border: 'none' }}>
              <div>
                <h3 className="card-title">Responsibilities & Duties</h3>
                <p className="card-subtitle">{meta.short}</p>
              </div>
              <ClipboardList size={20} className="muted" />
            </div>
            <ul className="duty-list">
              {meta.duties.map((d) => (
                <li key={d}>
                  <CheckCircle2 size={16} className="duty-check" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  )
}
