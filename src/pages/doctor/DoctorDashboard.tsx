import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  CalendarDays,
  Hourglass,
  ClipboardCheck,
  Stethoscope,
  ArrowRight,
  PlayCircle,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  getDoctorProfile,
  getMyAppointments,
  getMyPatients,
  listConsultations,
} from '../../api/services/doctorPortal'
import type { Appointment, Consultation, Doctor, Patient } from '../../types'
import { Card, StatCard, Spinner, Avatar, StatusBadge, EmptyState, PageHeader } from '../../components/ui'
import { DonutChart } from '../../components/charts'
import { fmtTime, todayLocal } from './utils'

export default function DoctorDashboard() {
  const { user } = useAuth()
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getDoctorProfile(), getMyAppointments(), listConsultations(), getMyPatients()])
      .then(([d, appts, consults, pats]) => {
        if (cancelled) return
        setDoctor(d)
        setAppointments(appts)
        setConsultations(consults)
        setPatients(pats)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const today = todayLocal()

  const { todaysAppointments, todaysPatients, pendingCount, statusSummary } = useMemo(() => {
    const todays = appointments
      .filter((a) => a.date === today)
      .sort((a, b) => a.time.localeCompare(b.time))
    const unique = new Set(todays.map((a) => a.patientId))
    const statuses: Record<string, number> = { Pending: 0, Confirmed: 0, Completed: 0, Cancelled: 0 }
    for (const a of appointments) statuses[a.status] = (statuses[a.status] ?? 0) + 1
    return {
      todaysAppointments: todays,
      todaysPatients: unique.size,
      pendingCount: statuses['Pending'] ?? 0,
      statusSummary: Object.entries(statuses).map(([status, count]) => ({ status, count })),
    }
  }, [appointments, today])

  const recentPatients = useMemo(() => {
    const seen = new Set<string>()
    const list: { patient: Patient; consultation?: Consultation }[] = []
    for (const c of [...consultations].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      if (seen.has(c.patientId)) continue
      seen.add(c.patientId)
      const patient = patients.find((p) => p.id === c.patientId)
      if (patient) list.push({ patient, consultation: c })
    }
    return list.slice(0, 5)
  }, [consultations, patients])

  if (loading) return <Spinner label="Loading your dashboard…" />
  if (error) return <div className="auth-error">{error}</div>

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = (user?.name ?? 'Doctor').replace(/^Dr\.?\s*/i, '').split(' ')[0]
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const nextActionable =
    todaysAppointments.find((a) => a.status === 'Confirmed' || a.status === 'Pending') ??
    undefined

  return (
    <>
      <PageHeader
        title={`${greeting}, Dr. ${firstName}`}
        subtitle={`${dateLabel} · ${doctor?.department ?? ''}${doctor?.specialty ? ` · ${doctor.specialty}` : ''}`}
        actions={
          doctor && doctor.status !== 'Active' ? (
            <button className="btn btn-primary" disabled title="Profile must be Active to start consultations">
              <PlayCircle size={16} /> Start Consultation
            </button>
          ) : (
            <Link
              to={
                nextActionable
                  ? `/doctor/consultations/new?appointmentId=${nextActionable.id}&patientId=${nextActionable.patientId}`
                  : '/doctor/appointments'
              }
              className="btn btn-primary"
            >
              <PlayCircle size={16} /> Start Consultation
            </Link>
          )
        }
      />

      <div className="grid-stats mb-4">
        <StatCard
          label="Today's Patients"
          value={String(todaysPatients)}
          icon={<Users size={20} />}
          tone="teal"
        />
        <StatCard
          label="Today's Appointments"
          value={String(todaysAppointments.length)}
          icon={<CalendarDays size={20} />}
          tone="indigo"
        />
        <StatCard
          label="Pending Appointments"
          value={String(pendingCount)}
          icon={<Hourglass size={20} />}
          tone="amber"
        />
        <StatCard
          label="Completed Consultations"
          value={String(consultations.length)}
          icon={<ClipboardCheck size={20} />}
          tone="green"
        />
      </div>

      <div className="grid-2 mb-4">
        <Card padded>
          <div className="card-header" style={{ padding: 0, marginBottom: 14, border: 'none' }}>
            <div>
              <h3 className="card-title">Today's Schedule</h3>
              <p className="card-subtitle">Chronological appointments for today</p>
            </div>
            <Link to="/doctor/appointments?view=today" className="text-sm font-semibold">
              View all
            </Link>
          </div>
          {todaysAppointments.length === 0 ? (
            <EmptyState title="No appointments today" hint="You are free for today." />
          ) : (
            <div className="dp-schedule-list">
              {todaysAppointments.map((a) => (
                <div key={a.id} className="dp-schedule-row">
                  <div className="dp-schedule-time">
                    <strong>{fmtTime(a.time)}</strong>
                    <span className="muted text-xs">{a.durationMin} min</span>
                  </div>
                  <Avatar name={a.patientName} size="md" />
                  <div className="dp-schedule-main">
                    <strong>{a.patientName}</strong>
                    <span className="muted text-xs">
                      {a.type} · {a.department}
                    </span>
                    <span className="muted text-xs">{a.reason}</span>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid-stats" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
          <Card padded>
            <div className="card-header" style={{ padding: 0, marginBottom: 10, border: 'none' }}>
              <div>
                <h3 className="card-title">Appointment Status</h3>
                <p className="card-subtitle">Your appointments by status</p>
              </div>
            </div>
            <DonutChart
              data={statusSummary.map((s) => ({ label: s.status, value: s.count }))}
              centerValue={String(appointments.length)}
              centerLabel="Appointments"
              size={170}
            />
          </Card>

          <Card padded>
            <div className="card-header" style={{ padding: 0, marginBottom: 10, border: 'none' }}>
              <div>
                <h3 className="card-title">Quick Actions</h3>
                <p className="card-subtitle">Jump straight into your workflow</p>
              </div>
            </div>
            <div className="dp-quick-actions">
              <Link to="/doctor/appointments?view=today" className="btn btn-outline btn-block">
                <CalendarDays size={16} /> View Today's Appointments
              </Link>
              <Link to="/doctor/patients" className="btn btn-outline btn-block">
                <Users size={16} /> View My Patients
              </Link>
              <Link
                to={
                  nextActionable
                    ? `/doctor/consultations/new?appointmentId=${nextActionable.id}&patientId=${nextActionable.patientId}`
                    : '/doctor/appointments'
                }
                className="btn btn-primary btn-block"
              >
                <Stethoscope size={16} /> Start Consultation
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <Card padded>
        <div className="card-header" style={{ padding: 0, marginBottom: 14, border: 'none' }}>
          <div>
            <h3 className="card-title">Recent Patients</h3>
            <p className="card-subtitle">Patients from your latest consultations</p>
          </div>
          <Link to="/doctor/patients" className="text-sm font-semibold">
            View all <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
          </Link>
        </div>
        {recentPatients.length === 0 ? (
          <EmptyState title="No recent patients" hint="Completed consultations will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Patient ID</th>
                  <th>Last Consultation</th>
                  <th>Diagnosis</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentPatients.map(({ patient, consultation }) => (
                  <tr key={patient.id}>
                    <td>
                      <div className="cell-person">
                        <Avatar name={`${patient.firstName} ${patient.lastName}`} size="sm" />
                        <strong>{patient.firstName} {patient.lastName}</strong>
                      </div>
                    </td>
                    <td className="muted">{patient.patientId}</td>
                    <td className="muted">
                      {consultation ? new Date(consultation.createdAt).toLocaleDateString() : patient.lastVisit}
                    </td>
                    <td className="font-semibold">{consultation?.diagnosis.primary ?? '—'}</td>
                    <td>
                      <StatusBadge status={patient.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/doctor/patients/${patient.id}`} className="btn btn-outline btn-sm">
                        Open Record
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
