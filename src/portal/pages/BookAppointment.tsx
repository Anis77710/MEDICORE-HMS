import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  Stethoscope,
  CalendarDays,
  Clock,
  CheckCircle2,
  Video,
  UserRound,
  Loader2,
} from 'lucide-react'
import { listPortalDoctors, getDoctorAvailability } from '../../api/services/portal/doctors'
import { getMyPatient } from '../../api/services/portal/me'
import { bookAppointment } from '../../api/services/portal/appointments'
import type { PortalDoctor } from '../../api/services/portal/doctors'
import type { DoctorAvailability } from '../../types/portal'
import { PageHeader, Skeleton, EmptyState, DoctorAvatar, Modal } from '../components'
import { useToast } from '../../context/ToastContext'

const APPT_TYPES = ['Checkup', 'Consultation', 'Follow-up'] as const

export default function BookAppointment() {
  const [params] = useSearchParams()
  const { push } = useToast()

  const [doctors, setDoctors] = useState<PortalDoctor[]>([])
  const [doctorId, setDoctorId] = useState(params.get('doctor') ?? '')
  const [availability, setAvailability] = useState<DoctorAvailability[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [type, setType] = useState<(typeof APPT_TYPES)[number]>('Consultation')
  const [mode, setMode] = useState<'In-person' | 'Video'>('In-person')
  const [reason, setReason] = useState('')
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState<{ id: string; date: string; time: string; doctorName: string; mode?: string; meetingUrl?: string } | null>(null)

  useEffect(() => {
    listPortalDoctors({ availableOnly: true })
      .then(setDoctors)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load doctors'))
      .finally(() => setLoadingDoctors(false))
  }, [])

  useEffect(() => {
    if (!doctorId) {
      setAvailability([])
      setSelectedDate('')
      setSelectedTime('')
      return
    }
    let cancelled = false
    setLoadingSlots(true)
    setSelectedDate('')
    setSelectedTime('')
    getDoctorAvailability(doctorId)
      .then((a) => {
        if (cancelled) return
        setAvailability(a)
        const firstOpen = a.find((d) => d.slots.some((s) => s.available))
        if (firstOpen) setSelectedDate(firstOpen.date)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => {
      cancelled = true
    }
  }, [doctorId])

  const selectedDay = useMemo(
    () => availability.find((d) => d.date === selectedDate) ?? null,
    [availability, selectedDate],
  )
  const selectedDoctor = doctors.find((d) => d.id === doctorId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!doctorId || !selectedDate || !selectedTime) {
      push('Please select a doctor, date and time slot', 'error')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const me = await getMyPatient()
      const appt = await bookAppointment(me.id, {
        doctorId,
        type,
        date: selectedDate,
        time: selectedTime,
        durationMin: 30,
        reason: reason.trim() || `${type} appointment`,
        mode,
      })
      push('Appointment booked successfully', 'success')
      setConfirmed({
        id: appt.id,
        date: appt.date,
        time: appt.time,
        doctorName: appt.doctorName,
        mode: appt.mode,
        meetingUrl: appt.meetingUrl,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed')
      push(err instanceof Error ? err.message : 'Booking failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-fade-in">
      <PageHeader
        title="Book Appointment"
        subtitle="Choose a specialist, pick a date and time slot — instant confirmation."
      />

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3">
        {/* Step 1: doctor */}
        <div className="p-card p-5 lg:col-span-1">
          <h2 className="mb-4 flex items-center gap-2 font-display font-bold text-slate-800 dark:text-slate-100">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">1</span>
            Select Doctor
          </h2>
          {loadingDoctors ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {doctors.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => setDoctorId(d.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150 ${
                    doctorId === d.id
                      ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/30 dark:bg-cyan-500/10'
                      : 'border-slate-200 hover:border-cyan-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <DoctorAvatar name={d.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">{d.name}</div>
                    <div className="truncate text-xs text-slate-400">{d.specialty} · ${d.consultationFee}</div>
                  </div>
                  {doctorId === d.id && <CheckCircle2 size={18} className="shrink-0 text-cyan-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: date & time */}
        <div className="p-card p-5 lg:col-span-1">
          <h2 className="mb-4 flex items-center gap-2 font-display font-bold text-slate-800 dark:text-slate-100">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">2</span>
            Date & Time
          </h2>

          {!doctorId ? (
            <EmptyState icon={Stethoscope} title="Select a doctor first" hint="Choose a specialist to see their availability." />
          ) : loadingSlots ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
              </div>
            </div>
          ) : availability.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No availability" hint="This doctor has no upcoming slots." />
          ) : (
            <>
              {/* Date picker */}
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {availability.slice(0, 10).map((d) => {
                  const hasSlots = d.slots.some((s) => s.available)
                  return (
                    <button
                      type="button"
                      key={d.date}
                      disabled={!hasSlots}
                      onClick={() => {
                        setSelectedDate(d.date)
                        setSelectedTime('')
                      }}
                      className={`flex min-w-[64px] flex-col items-center rounded-xl border px-3 py-2.5 transition-all duration-150 ${
                        selectedDate === d.date
                          ? 'border-cyan-500 bg-cyan-600 text-white shadow-md'
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

              {/* Time slots */}
              {selectedDay && (
                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Available times — {selectedDay.day}, {selectedDay.date}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedDay.slots.map((s) => (
                      <button
                        type="button"
                        key={s.time}
                        disabled={!s.available}
                        onClick={() => setSelectedTime(s.time)}
                        className={`rounded-lg border py-2 text-sm font-semibold transition-all duration-150 ${
                          selectedTime === s.time
                            ? 'border-cyan-600 bg-cyan-600 text-white shadow-md'
                            : s.available
                              ? 'border-slate-200 text-slate-600 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-300'
                              : 'cursor-not-allowed border-slate-100 text-slate-300 line-through dark:border-slate-800 dark:text-slate-600'
                        }`}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Step 3: details */}
        <div className="p-card p-5 lg:col-span-1">
          <h2 className="mb-4 flex items-center gap-2 font-display font-bold text-slate-800 dark:text-slate-100">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">3</span>
            Appointment Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="p-label">Appointment type</label>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="p-input">
                {APPT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="p-label">Consultation mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('In-person')}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                    mode === 'In-person'
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300'
                      : 'border-slate-200 text-slate-500 hover:border-cyan-300 dark:border-slate-700'
                  }`}
                >
                  <UserRound size={20} />
                  <span className="text-xs font-semibold">In-person</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('Video')}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                    mode === 'Video'
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300'
                      : 'border-slate-200 text-slate-500 hover:border-cyan-300 dark:border-slate-700'
                  }`}
                >
                  <Video size={20} />
                  <span className="text-xs font-semibold">Video</span>
                </button>
              </div>
            </div>

            <div>
              <label className="p-label">Reason for visit</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Briefly describe your symptoms or reason…"
                className="p-input resize-none"
              />
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-slate-50 p-3.5 text-sm dark:bg-slate-800/50">
              <div className="flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300">
                <Clock size={14} className="text-cyan-600" />
                {selectedDoctor ? `${selectedDoctor.name} · ${selectedDoctor.department}` : 'No doctor selected'}
              </div>
              {selectedDate && selectedTime && (
                <div className="mt-1.5 text-xs text-slate-400">
                  {selectedDay?.day}, {selectedDate} at {selectedTime} · {mode}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !doctorId || !selectedDate || !selectedTime}
              className="p-btn p-btn-primary w-full py-3"
            >
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              {submitting ? 'Booking…' : 'Confirm Appointment'}
            </button>
            <p className="text-center text-[11px] text-slate-400">
              Double-booking is prevented automatically — your slot is reserved for you.
            </p>
          </div>
        </div>
      </form>

      {/* Confirmation modal */}
      <Modal open={!!confirmed} title="Appointment Confirmed" onClose={() => setConfirmed(null)}>
        {confirmed && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-50 py-6 dark:bg-emerald-500/10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                <CheckCircle2 size={28} />
              </div>
              <div className="text-center">
                <div className="font-display text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                  You're all set!
                </div>
                <div className="text-sm text-emerald-600/80 dark:text-emerald-400/70">
                  Your booking reference: <span className="font-bold">{confirmed.id}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
              <div className="flex justify-between"><span className="text-slate-400">Doctor</span><span className="font-semibold text-slate-700 dark:text-slate-200">{confirmed.doctorName}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Date</span><span className="font-semibold text-slate-700 dark:text-slate-200">{confirmed.date}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Time</span><span className="font-semibold text-slate-700 dark:text-slate-200">{confirmed.time}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Mode</span><span className="font-semibold text-slate-700 dark:text-slate-200">{confirmed.mode ?? 'In-person'}</span></div>
            </div>
            {confirmed.meetingUrl && (
              <a href={confirmed.meetingUrl} target="_blank" rel="noreferrer" className="p-btn p-btn-outline w-full">
                <Video size={16} /> Join online consultation
              </a>
            )}
            <div className="flex gap-2">
              <button onClick={() => setConfirmed(null)} className="p-btn p-btn-ghost flex-1">Close</button>
              <Link to="/portal/appointments" className="p-btn p-btn-primary flex-1 text-center">View appointments</Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
