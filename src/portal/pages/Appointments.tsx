import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Video,
  Clock,
  Stethoscope,
  CalendarPlus,
  X,
  Loader2,
  MapPin,
} from 'lucide-react'
import { getMyPatient } from '../../api/services/portal/me'
import {
  listMyAppointments,
  cancelAppointment,
  rescheduleAppointment,
} from '../../api/services/portal/appointments'
import { getDoctorAvailability } from '../../api/services/portal/doctors'
import type { Appointment } from '../../types'
import type { DoctorAvailability } from '../../types/portal'
import { PageHeader, Skeleton, ErrorState, EmptyState, StatusPill, DoctorAvatar, Modal, ConfirmDialog } from '../components'
import { useToast } from '../../context/ToastContext'

const TABS = ['All', 'Upcoming', 'Completed', 'Cancelled'] as const
type Tab = (typeof TABS)[number]

export default function MyAppointments() {
  const { push } = useToast()
  const [appts, setAppts] = useState<(Appointment & { meetingUrl?: string; mode?: string })[]>([])
  const [tab, setTab] = useState<Tab>('Upcoming')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<(Appointment & { meetingUrl?: string }) | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [rescheduleFor, setRescheduleFor] = useState<(Appointment & { meetingUrl?: string }) | null>(null)
  const [slots, setSlots] = useState<DoctorAvailability[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')
  const [rescheduleBusy, setRescheduleBusy] = useState(false)

  const todayStr = new Date().toISOString().slice(0, 10)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const me = await getMyPatient()
      const list = await listMyAppointments(me.id, {})
      setAppts(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (tab === 'All') return appts
    if (tab === 'Upcoming')
      return appts.filter((a) => (a.status === 'Confirmed' || a.status === 'Pending') && a.date >= todayStr)
    return appts.filter((a) => a.status === tab)
  }, [appts, tab, todayStr])

  const counts = useMemo(() => {
    const upcoming = appts.filter((a) => (a.status === 'Confirmed' || a.status === 'Pending') && a.date >= todayStr).length
    const completed = appts.filter((a) => a.status === 'Completed').length
    const cancelled = appts.filter((a) => a.status === 'Cancelled').length
    return { all: appts.length, upcoming, completed, cancelled }
  }, [appts, todayStr])

  const openReschedule = async (a: Appointment) => {
    setRescheduleFor(a as Appointment & { meetingUrl?: string })
    setNewDate('')
    setNewTime('')
    setSlotsLoading(true)
    try {
      const avail = await getDoctorAvailability(a.doctorId)
      setSlots(avail)
    } catch {
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  const doReschedule = async () => {
    if (!rescheduleFor || !newDate || !newTime) return
    setRescheduleBusy(true)
    try {
      await rescheduleAppointment(rescheduleFor.id, { date: newDate, time: newTime })
      push('Appointment rescheduled', 'success')
      setRescheduleFor(null)
      await load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Reschedule failed', 'error')
    } finally {
      setRescheduleBusy(false)
    }
  }

  const doCancel = async () => {
    if (!cancelling) return
    setCancelBusy(true)
    try {
      await cancelAppointment(cancelling.id)
      push('Appointment cancelled', 'success')
      setCancelling(null)
      await load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Cancel failed', 'error')
    } finally {
      setCancelBusy(false)
    }
  }

  const canCancel = (a: Appointment) => (a.status === 'Confirmed' || a.status === 'Pending') && a.date >= todayStr
  const canReschedule = (a: Appointment) => (a.status === 'Confirmed' || a.status === 'Pending') && a.date >= todayStr

  return (
    <div className="p-fade-in">
      <PageHeader
        title="My Appointments"
        subtitle="Track, reschedule or cancel your visits."
        actions={
          <Link to="/portal/book" className="p-btn p-btn-primary">
            <CalendarPlus size={16} /> Book new
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`p-chip ${tab === t ? 'p-chip-active' : 'p-chip-idle'}`}
          >
            {t}
            <span className={tab === t ? 'text-white/80' : 'text-slate-400'}>
              {counts[t === 'All' ? 'all' : t.toLowerCase() as 'upcoming' | 'completed' | 'cancelled']}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-card p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={tab === 'Upcoming' ? 'No upcoming appointments' : `No ${tab.toLowerCase()} appointments`}
          hint="When you book a consultation it will appear here."
          action={
            <Link to="/portal/book" className="p-btn p-btn-primary">
              <CalendarPlus size={16} /> Book an appointment
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="p-card p-5">
              <div className="flex flex-wrap items-center gap-4">
                <DoctorAvatar name={a.doctorName} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">
                      {a.doctorName}
                    </h3>
                    <StatusPill status={a.status} />
                    {a.mode === 'Video' && (
                      <span className="p-badge bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">
                        <Video size={11} /> Online
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                    <span className="flex items-center gap-1"><Stethoscope size={13} />{a.department}</span>
                    <span className="flex items-center gap-1"><Clock size={13} />{a.type}</span>
                    <span className="flex items-center gap-1"><MapPin size={13} />{a.mode === 'Video' ? 'Video consultation' : 'HealSync Hospital'}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{formatDate(a.date)}</span>
                    <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{a.time} ({a.durationMin} min)</span>
                  </div>
                  {a.reason && (
                    <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                      "{a.reason}"
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {a.mode === 'Video' && (a.status === 'Confirmed' || a.status === 'Pending') && (
                    <a
                      href={a.meetingUrl ?? `https://meet.healsync.health/${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-btn p-btn-primary"
                    >
                      <Video size={15} /> Join
                    </a>
                  )}
                  {canReschedule(a) && (
                    <button onClick={() => openReschedule(a)} className="p-btn p-btn-outline">
                      <Clock size={15} /> Reschedule
                    </button>
                  )}
                  {canCancel(a) && (
                    <button onClick={() => setCancelling(a as Appointment & { meetingUrl?: string })} className="p-btn p-btn-danger">
                      <X size={15} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reschedule modal */}
      <Modal open={!!rescheduleFor} title="Reschedule Appointment" onClose={() => setRescheduleFor(null)} wide>
        {rescheduleFor && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3.5 text-sm dark:bg-slate-800/50">
              <div className="font-bold text-slate-700 dark:text-slate-200">{rescheduleFor.doctorName}</div>
              <div className="text-xs text-slate-400">
                Currently: {formatDate(rescheduleFor.date)} at {rescheduleFor.time}
              </div>
            </div>

            {slotsLoading ? (
              <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : slots.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No slots available" />
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {slots.slice(0, 10).map((d) => {
                    const hasSlots = d.slots.some((s) => s.available)
                    return (
                      <button
                        key={d.date}
                        disabled={!hasSlots}
                        onClick={() => { setNewDate(d.date); setNewTime('') }}
                        className={`flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2.5 transition-all ${
                          newDate === d.date
                            ? 'border-cyan-500 bg-cyan-600 text-white'
                            : hasSlots
                              ? 'border-slate-200 text-slate-600 hover:border-cyan-400 dark:border-slate-700 dark:text-slate-300'
                              : 'border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase">{d.day}</span>
                        <span className="font-display text-sm font-extrabold">{d.date.slice(8, 10)}</span>
                      </button>
                    )
                  })}
                </div>
                {newDate && (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.find((d) => d.date === newDate)?.slots.map((s) => (
                      <button
                        key={s.time}
                        disabled={!s.available}
                        onClick={() => setNewTime(s.time)}
                        className={`rounded-lg border py-2 text-sm font-semibold transition-all ${
                          newTime === s.time
                            ? 'border-cyan-600 bg-cyan-600 text-white'
                            : s.available
                              ? 'border-slate-200 text-slate-600 hover:border-cyan-400 dark:border-slate-700 dark:text-slate-300'
                              : 'cursor-not-allowed border-slate-100 text-slate-300 line-through dark:border-slate-800 dark:text-slate-600'
                        }`}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setRescheduleFor(null)} className="p-btn p-btn-ghost">Cancel</button>
              <button
                onClick={doReschedule}
                disabled={!newDate || !newTime || rescheduleBusy}
                className="p-btn p-btn-primary"
              >
                {rescheduleBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                Confirm reschedule
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel appointment?"
        message={`Cancel your appointment with ${cancelling?.doctorName} on ${cancelling ? formatDate(cancelling.date) : ''}? This can be rebooked anytime.`}
        confirmLabel="Cancel appointment"
        busy={cancelBusy}
        onCancel={() => setCancelling(null)}
        onConfirm={doCancel}
      />
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
