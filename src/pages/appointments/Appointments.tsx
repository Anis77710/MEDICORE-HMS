import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, CalendarDays, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { listAppointments, updateAppointmentStatus } from '../../api/services/appointments'
import type { Appointment, AppointmentStatus } from '../../types'
import {
  PageHeader,
  Card,
  StatCard,
  Button,
  Avatar,
  StatusBadge,
  Tabs,
  Spinner,
  EmptyState,
  ConfirmDialog,
  Modal,
} from '../../components/ui'
import { BookAppointment } from './BookAppointment'
import { useToast } from '../../context/ToastContext'
import { usePermissions } from '../../rbac/usePermissions'

type TabKey = 'Upcoming' | 'Completed' | 'Cancelled'

const DEPT_COLORS: Record<string, string> = {
  Cardiology: '#2563eb',
  Neurology: '#7c3aed',
  Pediatrics: '#ea580c',
  'General Medicine': '#0e7490',
  Orthopedics: '#059669',
  Dermatology: '#d97706',
  Oncology: '#dc2626',
  Gynecology: '#db2777',
}

function nextDays(n: number): string[] {
  const days: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export default function Appointments() {
  const { push } = useToast()
  const { can } = usePermissions()
  const [items, setItems] = useState<Appointment[]>([])
  const [tab, setTab] = useState<TabKey>('Upcoming')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [bookOpen, setBookOpen] = useState(false)
  const [cancelling, setCancelling] = useState<Appointment | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listAppointments()
      .then((res) => {
        if (!cancelled) setItems(res)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const stats = useMemo(() => {
    const confirmed = items.filter((a) => a.status === 'Confirmed').length
    const pending = items.filter((a) => a.status === 'Pending').length
    const completed = items.filter((a) => a.status === 'Completed').length
    const cancelled = items.filter((a) => a.status === 'Cancelled').length
    return { total: items.length, confirmed, pending, completed, cancelled }
  }, [items])

  const shown = useMemo(() => {
    if (tab === 'Upcoming')
      return items.filter((a) => a.status !== 'Completed' && a.status !== 'Cancelled')
    return items.filter((a) => a.status === tab)
  }, [items, tab])

  const weekDays = useMemo(() => nextDays(7), [])
  const dayAppts = shown.filter((a) => a.date === selectedDate)

  const changeStatus = async (a: Appointment, status: AppointmentStatus) => {
    await updateAppointmentStatus(a.id, status)
    setRefreshKey((k) => k + 1)
    push(`Appointment marked as ${status.toLowerCase()}`)
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={`${stats.total} total appointments`}
        actions={
          <div className="flex gap-2">
            {can('appointments', 'view') && (
              <Link to="/appointments/calendar" className="btn btn-outline">
                <CalendarDays size={16} /> Doctor Calendar
              </Link>
            )}
            {can('appointments', 'create') ? (
              <Button onClick={() => setBookOpen(true)}>
                <CalendarPlus size={16} /> Book Appointment
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid-stats mb-4">
        <StatCard
          label="Total Appointments"
          value={stats.total.toLocaleString()}
          icon={<CalendarDays size={20} />}
          tone="teal"
        />
        <StatCard
          label="Confirmed"
          value={stats.confirmed.toLocaleString()}
          icon={<CheckCircle2 size={20} />}
          tone="green"
        />
        <StatCard
          label="Pending"
          value={stats.pending.toLocaleString()}
          icon={<Clock size={20} />}
          tone="amber"
        />
        <StatCard
          label="Cancelled"
          value={stats.cancelled.toLocaleString()}
          icon={<XCircle size={20} />}
          tone="red"
        />
      </div>

      <div className="mb-4">
        <Tabs
          tabs={[
            { value: 'Upcoming', label: 'Upcoming', count: items.length - stats.completed - stats.cancelled },
            { value: 'Completed', label: 'Completed', count: stats.completed },
            { value: 'Cancelled', label: 'Cancelled', count: stats.cancelled },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="date-strip">
        {weekDays.map((d) => {
          const date = new Date(d)
          const isToday = d === new Date().toISOString().slice(0, 10)
          const count = items.filter((a) => a.date === d && a.status !== 'Cancelled').length
          return (
            <button
              key={d}
              className={`date-chip ${selectedDate === d ? 'date-chip-active' : ''}`}
              onClick={() => setSelectedDate(d)}
            >
              <span className="date-chip-weekday">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className="date-chip-day">{date.getDate()}</span>
              <span className="date-chip-month">{date.toLocaleDateString('en-US', { month: 'short' })}</span>
              {count > 0 && <span className="date-chip-count">{count}</span>}
              {isToday && <span className="date-chip-today">Today</span>}
            </button>
          )
        })}
      </div>

      <div className="grid-2">
        <Card>
          <div className="card-header">
            <div>
              <h3 className="card-title">Weekly Calendar</h3>
              <p className="card-subtitle">Appointments by department</p>
            </div>
          </div>
          {loading ? (
            <Spinner label="Loading calendar…" />
          ) : (
            <div className="cal-wrap">
              <div className="cal-grid">
                {weekDays.map((d) => {
                  const dayAppts = items.filter(
                    (a) => a.date === d && a.status !== 'Cancelled',
                  )
                  const date = new Date(d)
                  return (
                    <div key={d} className="cal-day">
                      <div className="cal-day-head">
                        <strong>{date.toLocaleDateString('en-US', { weekday: 'short' })}</strong>
                        <span>{date.getDate()}</span>
                      </div>
                      <div className="cal-slots">
                        {dayAppts.length === 0 && <div className="cal-empty">·</div>}
                        {dayAppts.slice(0, 4).map((a) => (
                          <div
                            key={a.id}
                            className="cal-block"
                            style={{
                              background: `${DEPT_COLORS[a.department] ?? '#0e7490'}16`,
                              borderLeft: `3px solid ${DEPT_COLORS[a.department] ?? '#0e7490'}`,
                            }}
                          >
                            <strong className="cal-block-time">{a.time}</strong>
                            <span className="cal-block-name">{a.patientName}</span>
                            <span className="cal-block-dept">{a.department}</span>
                          </div>
                        ))}
                        {dayAppts.length > 4 && (
                          <div className="cal-more">+{dayAppts.length - 4} more</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="card-header">
            <div>
              <h3 className="card-title">Schedule for {selectedDate}</h3>
              <p className="card-subtitle">
                {dayAppts.length} appointment{dayAppts.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          {loading ? (
            <Spinner label="Loading schedule…" />
          ) : dayAppts.length === 0 ? (
            <EmptyState title="No appointments" hint="Nothing scheduled for this day." />
          ) : (
            <div className="appt-list">
              {dayAppts.map((a) => (
                <div key={a.id} className="appt-row">
                  <Avatar name={a.patientName} size="md" />
                  <div className="appt-row-main">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong>{a.patientName}</strong>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="muted text-xs">
                      {a.time} · {a.durationMin} min · {a.doctorName} · {a.type}
                    </div>
                    <div className="muted text-xs">{a.reason}</div>
                  </div>
                  <div className="appt-row-actions">
                    {a.status === 'Pending' && (
                      <Button size="sm" onClick={() => void changeStatus(a, 'Confirmed')}>
                        Confirm
                      </Button>
                    )}
                    {a.status === 'Confirmed' && (
                      <Button size="sm" variant="secondary" onClick={() => void changeStatus(a, 'Completed')}>
                        Complete
                      </Button>
                    )}
                    {a.status !== 'Cancelled' && a.status !== 'Completed' && (
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelling(a)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <div className="card-header">
            <div>
              <h3 className="card-title">{tab} Appointments</h3>
              <p className="card-subtitle">All {tab.toLowerCase()} records</p>
            </div>
          </div>
          {loading ? (
            <Spinner />
          ) : shown.length === 0 ? (
            <EmptyState title={`No ${tab.toLowerCase()} appointments`} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Doctor</th>
                    <th>Department</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className="cell-person">
                          <Avatar name={a.patientName} size="sm" />
                          <strong>{a.patientName}</strong>
                        </div>
                      </td>
                      <td>{a.date}</td>
                      <td>
                        {a.time} <span className="muted text-xs">({a.durationMin}m)</span>
                      </td>
                      <td>{a.doctorName}</td>
                      <td>{a.department}</td>
                      <td>{a.type}</td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={bookOpen}
        title="Book Appointment"
        size="md"
        onClose={() => setBookOpen(false)}
      >
        <BookAppointment
          defaultDate={selectedDate}
          onDone={(ok) => {
            setBookOpen(false)
            if (ok) {
              setRefreshKey((k) => k + 1)
              push('Appointment booked')
            }
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel Appointment"
        message={`Cancel the appointment for ${cancelling?.patientName} on ${cancelling?.date} at ${cancelling?.time}?`}
        confirmLabel="Cancel Appointment"
        onCancel={() => setCancelling(null)}
        onConfirm={async () => {
          if (!cancelling) return
          await changeStatus(cancelling, 'Cancelled')
          setCancelling(null)
        }}
      />
    </>
  )
}
