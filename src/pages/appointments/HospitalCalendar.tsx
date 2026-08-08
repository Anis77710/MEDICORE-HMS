import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { listAppointments } from '../../api/services/appointments'
import { listDoctors } from '../../api/services/doctors'
import type { Appointment, Doctor } from '../../types'
import { PageHeader, Card, Spinner, Badge, EmptyState, Avatar } from '../../components/ui'
import { isWorkingDay } from '../../api/availability'

function dateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function HospitalCalendar() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    const day = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - day)
    return dateOnly(d)
  })
  const [selectedDoctor, setSelectedDoctor] = useState<string>('All')

  useEffect(() => {
    let cancelled = false
    Promise.all([listDoctors(), listAppointments()])
      .then(([docs, appts]) => {
        if (cancelled) return
        setDoctors(docs)
        setAppointments(appts)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const weekDays = useMemo(() => {
    const days: string[] = []
    const start = new Date(`${weekStart}T00:00:00`)
    for (let i = 0; i < 7; i++) {
      days.push(dateOnly(new Date(start.getTime() + i * 86400000)))
    }
    return days
  }, [weekStart])

  const visibleDoctors = useMemo(
    () => doctors.filter((d) => selectedDoctor === 'All' || d.id === selectedDoctor),
    [doctors, selectedDoctor],
  )

  const cellFor = (doctorId: string, date: string) => {
    const dayAppts = appointments.filter((a) => a.doctorId === doctorId && a.date === date)
    const active = dayAppts.filter((a) => a.status !== 'Cancelled')
    const pending = active.filter((a) => a.status === 'Pending')
    return { count: active.length, pending: pending.length, items: dayAppts }
  }

  if (loading) return <Spinner label="Loading hospital calendar…" />

  const totalBooked = appointments.filter((a) => a.status !== 'Cancelled').length

  return (
    <>
      <PageHeader
        title="Doctor Calendar"
        subtitle={`Hospital-wide availability · ${fmtShort(weekStart)} – ${fmtShort(dateOnly(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 6 * 86400000)))} · ${totalBooked} active bookings`}
        actions={
          <div className="flex gap-2">
            <Link to="/appointments" className="btn btn-outline">
              <ArrowLeft size={16} /> Appointments
            </Link>
            <button className="btn btn-outline" onClick={() => setWeekStart(dateOnly(new Date(new Date(`${weekStart}T00:00:00`).getTime() - 7 * 86400000)))}>‹ Prev</button>
            <button className="btn btn-outline" onClick={() => setWeekStart(dateOnly(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 7 * 86400000)))}>Next ›</button>
          </div>
        }
      />

      <Card>
        <div className="table-toolbar">
          <div className="chips">
            <button
              className={`chip ${selectedDoctor === 'All' ? 'chip-active' : ''}`}
              onClick={() => setSelectedDoctor('All')}
            >
              All doctors
            </button>
            {doctors.map((d) => (
              <button
                key={d.id}
                className={`chip ${selectedDoctor === d.id ? 'chip-active' : ''}`}
                onClick={() => setSelectedDoctor(d.id)}
              >
                {d.name.replace(/^Dr\.?\s*/i, '')}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ minWidth: 190 }}>Doctor</th>
                {weekDays.map((day) => (
                  <th key={day}>{fmtShort(day)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleDoctors.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="cell-person">
                      <Avatar name={d.name} size="sm" />
                      <div className="min-w-0">
                        <Link to={`/doctors/${d.id}`} className="font-semibold">
                          {d.name}
                        </Link>
                        <div className="muted text-xs">
                          {d.department} · <Badge tone={d.status === 'Active' ? 'green' : d.status === 'On Leave' ? 'amber' : 'gray'}>{d.status}</Badge>
                        </div>
                      </div>
                    </div>
                  </td>
                  {weekDays.map((day) => {
                    const cell = cellFor(d.id, day)
                    const working = isWorkingDay(d, day)
                    return (
                      <td key={day}>
                        {!working ? (
                          <span className="muted text-xs">—</span>
                        ) : cell.count === 0 ? (
                          <Badge tone="green">Free</Badge>
                        ) : (
                          <div className="flex-column gap-1">
                            <Badge tone={cell.pending > 0 ? 'amber' : 'teal'}>
                              {cell.count} booked{cell.pending > 0 ? ` · ${cell.pending} pending` : ''}
                            </Badge>
                            {cell.items.slice(0, 2).map((a) => (
                              <span key={a.id} className="muted text-xs" title={a.patientName}>
                                {a.time} {a.patientName}
                              </span>
                            ))}
                            {cell.items.length > 2 && (
                              <span className="muted text-xs">+{cell.items.length - 2} more</span>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleDoctors.length === 0 && <EmptyState title="No doctors to show" />}
      </Card>
    </>
  )
}
