import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  XCircle,
  PlayCircle,
  Eye,
  CalendarDays,
  Clock,
  Info,
  CalendarRange,
  ListFilter,
  Tag,
  X,
} from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import {
  getDoctorProfile,
  getMyAppointments,
  confirmAppointment,
  cancelAppointment,
  listConsultations,
} from '../../api/services/doctorPortal'
import type { Appointment, AppointmentStatus, AppointmentType, Consultation, Doctor } from '../../types'
import {
  Card,
  Spinner,
  EmptyState,
  StatusBadge,
  Button,
  ConfirmDialog,
  PageHeader,
  Avatar,
} from '../../components/ui'
import { fmtDate, fmtTime, todayLocal } from './utils'

const TYPES: AppointmentType[] = ['Checkup', 'Consultation', 'Follow-up', 'Emergency', 'Procedure']
const STATUSES: AppointmentStatus[] = ['Pending', 'Confirmed', 'Completed', 'Cancelled']

type View = 'pending' | 'today' | 'upcoming' | 'past' | 'all'

function relativeLabel(date: string, today: string): string | null {
  if (date === today) return 'Today'
  const d = new Date(`${date}T00:00:00`)
  const t = new Date(`${today}T00:00:00`)
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return null
}

export default function MyAppointments() {
  const [params, setParams] = useSearchParams()
  const { push } = useToast()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)

  const viewParam = params.get('view')
  const view: View =
    viewParam === 'pending' ||
    viewParam === 'today' ||
    viewParam === 'upcoming' ||
    viewParam === 'past' ||
    viewParam === 'all'
      ? viewParam
      : 'all'

  const dateFilter = params.get('date') ?? ''
  const statusFilter = params.get('status') ?? 'All'
  const typeFilter = params.get('type') ?? 'All'

  useEffect(() => {
    let cancelled = false
    Promise.all([getMyAppointments(), listConsultations(), getDoctorProfile()])
      .then(([appts, consults, d]) => {
        if (cancelled) return
        setAppointments(appts)
        setConsultations(consults)
        setDoctor(d)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load appointments')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const today = todayLocal()

  const visible = useMemo(() => {
    let list = [...appointments]
    if (view === 'pending') list = list.filter((a) => a.status === 'Pending')
    if (view === 'today') list = list.filter((a) => a.date === today)
    if (view === 'upcoming') list = list.filter((a) => a.date > today && a.status !== 'Cancelled')
    if (view === 'past') list = list.filter((a) => a.date < today)
    if (statusFilter !== 'All') list = list.filter((a) => a.status === statusFilter)
    if (typeFilter !== 'All') list = list.filter((a) => a.type === typeFilter)
    if (dateFilter) list = list.filter((a) => a.date === dateFilter)
    return list.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  }, [appointments, view, statusFilter, typeFilter, dateFilter, today])

  const pastAppointments = useMemo(() => {
    let list = appointments.filter((a) => a.date < today)
    if (statusFilter !== 'All') list = list.filter((a) => a.status === statusFilter)
    if (typeFilter !== 'All') list = list.filter((a) => a.type === typeFilter)
    return list.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  }, [appointments, today, statusFilter, typeFilter])

  const pendingCount = useMemo(
    () => appointments.filter((a) => a.status === 'Pending').length,
    [appointments],
  )

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  async function onConfirm(a: Appointment) {
    setBusyId(a.id)
    try {
      const updated = await confirmAppointment(a.id)
      setAppointments((prev) => prev.map((x) => (x.id === a.id ? updated : x)))
      push(`Appointment confirmed for ${a.patientName}`)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to confirm appointment', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function onCancelConfirmed() {
    if (!cancelTarget) return
    const target = cancelTarget
    setCancelTarget(null)
    setBusyId(target.id)
    try {
      const updated = await cancelAppointment(target.id)
      setAppointments((prev) => prev.map((x) => (x.id === target.id ? updated : x)))
      push('Appointment cancelled')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to cancel appointment', 'error')
    } finally {
      setBusyId(null)
    }
  }

  function consultationFor(a: Appointment): Consultation | undefined {
    return consultations.find((c) => c.appointmentId === a.id)
  }

  if (loading) return <Spinner label="Loading appointments…" />
  if (error) return <div className="auth-error">{error}</div>

  return (
    <>
      <PageHeader
        title="My Appointments"
        subtitle="Confirm pending requests, then start and complete consultations from your schedule."
        actions={
          <Link to="/doctor/patients" className="btn btn-outline">
            <CalendarDays size={16} /> View Patients
          </Link>
        }
      />

      <div className="dp-filter-bar mb-3">
        <div className="dp-filter-group">
          <span className="dp-filter-label">
            <CalendarRange size={14} /> Date
          </span>
          <label className="dp-date-input">
            <CalendarDays size={15} />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setFilter('date', e.target.value)}
              aria-label="Filter by date"
            />
            {dateFilter && (
              <button
                type="button"
                className="dp-date-clear"
                onClick={() => setFilter('date', '')}
                aria-label="Clear date filter"
              >
                <X size={13} />
              </button>
            )}
          </label>
        </div>

        <div className="dp-filter-group">
          <span className="dp-filter-label">
            <ListFilter size={14} /> Status
          </span>
          <div className="dp-chips">
            {['All', ...STATUSES].map((s) => (
              <button
                key={s}
                type="button"
                className={`dp-chip ${statusFilter === s ? 'dp-chip-active' : ''}`}
                onClick={() => setFilter('status', s === 'All' ? '' : s)}
              >
                {s}
                {s !== 'All' && s === 'Pending' && pendingCount > 0 && (
                  <span className="dp-chip-count">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="dp-filter-group">
          <span className="dp-filter-label">
            <Tag size={14} /> Type
          </span>
          <div className="dp-chips">
            {['All', ...TYPES].map((t) => (
              <button
                key={t}
                type="button"
                className={`dp-chip ${typeFilter === t ? 'dp-chip-active' : ''}`}
                onClick={() => setFilter('type', t === 'All' ? '' : t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {(dateFilter || statusFilter !== 'All' || typeFilter !== 'All') && (
          <button
            type="button"
            className="dp-filter-clear"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
          >
            <X size={14} /> Clear all
          </button>
        )}
      </div>

      {view === 'upcoming' && visible.length === 0 && pastAppointments.length > 0 ? (
        <>
          <div className="notice notice-info mb-3">
            No upcoming appointments scheduled. Showing your past appointments instead.
          </div>
          <div className="dp-appt-grid">
            {pastAppointments.map((a) => (
              <AppointmentCard
                key={a.id}
                appointment={a}
                today={today}
                busy={busyId === a.id}
                restricted={!!doctor && doctor.status !== 'Active'}
                onConfirm={() => void onConfirm(a)}
                onCancel={() => setCancelTarget(a)}
                consultation={consultationFor(a)}
              />
            ))}
          </div>
        </>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            title={view === 'pending' ? 'No pending requests' : 'No appointments found'}
            hint={
              view === 'today'
                ? 'No appointments scheduled for today.'
                : view === 'pending'
                  ? 'All appointment requests have been handled. You are all caught up!'
                  : 'Try a different view or filter.'
            }
          />
        </Card>
      ) : (
        <div className="dp-appt-grid">
          {visible.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              today={today}
              busy={busyId === a.id}
              restricted={!!doctor && doctor.status !== 'Active'}
              onConfirm={() => void onConfirm(a)}
              onCancel={() => setCancelTarget(a)}
              consultation={consultationFor(a)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title={cancelTarget?.status === 'Pending' ? 'Decline request?' : 'Cancel appointment?'}
        message={`${cancelTarget?.status === 'Pending' ? 'Decline the' : 'Cancel the'} ${fmtTime(cancelTarget?.time ?? '')} appointment with ${cancelTarget?.patientName ?? ''}? This cannot be undone.`}
        confirmLabel={cancelTarget?.status === 'Pending' ? 'Decline request' : 'Cancel appointment'}
        onConfirm={onCancelConfirmed}
        onCancel={() => setCancelTarget(null)}
      />
    </>
  )
}

function AppointmentCard({
  appointment: a,
  today,
  busy,
  restricted,
  onConfirm,
  onCancel,
  consultation,
}: {
  appointment: Appointment
  today: string
  busy: boolean
  restricted: boolean
  onConfirm: () => void
  onCancel: () => void
  consultation?: Consultation
}) {
  const rel = relativeLabel(a.date, today)
  const isPast = a.date < today
  return (
    <div
      className={`dp-appt-card ${
        a.status === 'Pending' ? 'dp-appt-card-pending' : ''
      } ${isPast && a.status !== 'Completed' ? 'dp-appt-card-past' : ''}`}
    >
      <div className="dp-appt-head">
        <div className="dp-appt-date">
          <span className="dp-appt-date-day">{a.date.slice(8, 10)}</span>
          <span className="dp-appt-date-month">{fmtDate(a.date).split(' ')[0]}</span>
          {rel && <span className={`dp-appt-rel ${rel === 'Today' ? 'dp-appt-rel-today' : ''}`}>{rel}</span>}
        </div>
        <StatusBadge status={a.status} />
      </div>

      <div className="dp-appt-time-row">
        <span className="dp-appt-time">{fmtTime(a.time)}</span>
        <span className="muted text-xs">
          <Clock size={12} style={{ verticalAlign: 'middle' }} /> {a.durationMin} min
        </span>
      </div>

      <div className="dp-appt-patient">
        <Avatar name={a.patientName} size="lg" />
        <div className="flex-column" style={{ gap: 1, minWidth: 0 }}>
          <strong>{a.patientName}</strong>
          <span className="muted text-sm">{a.type} · {a.department}</span>
        </div>
      </div>

      {a.reason && (
        <p className="dp-appt-reason">
          <Info size={13} style={{ verticalAlign: 'middle' }} /> {a.reason}
        </p>
      )}

      <div className="dp-appt-actions">
        {a.status === 'Pending' && (
          <div className="dp-appt-action-row">
            {restricted ? (
              <Button size="sm" variant="primary" block disabled title="Your profile must be Active to confirm appointments">
                <CheckCircle2 size={15} /> Confirm Appointment
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                block
                loading={busy}
                onClick={onConfirm}
              >
                <CheckCircle2 size={15} /> Confirm Appointment
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              title="Decline appointment"
              aria-label="Decline appointment"
            >
              <XCircle size={16} />
            </Button>
          </div>
        )}
        {a.status === 'Confirmed' && (
          <div className="dp-appt-action-row">
            {restricted ? (
              <Button
                size="sm"
                variant="primary"
                block
                disabled
                title="Your profile must be Active to start consultations"
                style={{ flex: 1 }}
              >
                <PlayCircle size={15} /> Start Consultation
              </Button>
            ) : (
              <Link
                to={`/doctor/consultations/new?appointmentId=${a.id}&patientId=${a.patientId}`}
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}
              >
                <PlayCircle size={15} /> Start Consultation
              </Link>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              title="Cancel appointment"
              aria-label="Cancel appointment"
            >
              <XCircle size={16} />
            </Button>
          </div>
        )}
        {a.status === 'Completed' &&
          (consultation ? (
            <Link
              to={`/doctor/consultations/${consultation.id}`}
              className="btn btn-outline btn-sm btn-block"
            >
              <Eye size={15} /> View Consultation
            </Link>
          ) : (
            <Link
              to={`/doctor/patients/${a.patientId}`}
              className="btn btn-outline btn-sm btn-block"
            >
              <Eye size={15} /> View Patient
            </Link>
          ))}
        {a.status === 'Cancelled' && (
          <Link to={`/doctor/patients/${a.patientId}`} className="btn btn-outline btn-sm btn-block">
            <Eye size={15} /> View Patient
          </Link>
        )}
      </div>
    </div>
  )
}
