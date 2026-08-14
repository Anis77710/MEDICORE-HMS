import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, CreditCard, ChevronLeft, ChevronRight,
  Mail, MapPin, Phone, ShieldCheck, XCircle,
} from 'lucide-react'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'
import { listPublicDoctors, getPublicMonthAvailability, initiateBookingPayment, reconcileBookingPayment, type PublicDoctor, type DayAvailability } from '../../api/services/public'
import { masterApi, type PublicHospital } from '../../api/services/master'
import { dayOfWeek } from '../../api/availability'
import type { AppointmentType } from '../../types'
import './landing.css'

const TYPES: AppointmentType[] = ['Checkup', 'Consultation', 'Follow-up', 'Emergency', 'Procedure']

const GENDERS = ['Male', 'Female', 'Other'] as const

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function toIso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function nextWorkingDay(from: string, schedule: string[]): string {
  const d = new Date(`${from}T12:00:00`)
  for (let i = 0; i < 14; i++) {
    if (schedule.includes(DAY_NAMES[d.getDay()] ?? '')) return toIso(d)
    d.setDate(d.getDate() + 1)
  }
  return from
}

const TODAY = toIso(new Date())

function monthOf(date: string): Date {
  const [y, m] = date.split('-').map(Number)
  return new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function calendarDays(month: Date): (string | null)[] {
  const days: (string | null)[] = []
  for (let i = 0; i < month.getDay(); i++) days.push(null)
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  for (let d = 1; d <= count; d++) {
    days.push(toIso(new Date(month.getFullYear(), month.getMonth(), d)))
  }
  return days
}

function isDateAvailable(date: string, doctor: PublicDoctor | undefined): boolean {
  return date >= TODAY && (!doctor || doctor.schedule.includes(dayOfWeek(date)))
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatNpr(amount: number): string {
  return `NPR ${amount.toLocaleString('en-US')}`
}

export default function BookAppointmentPage() {
  const [params] = useSearchParams()
  const payment = params.get('payment')
  const ref = params.get('ref') ?? ''
  const paidDoctor = params.get('doctor') ?? ''
  const paidDate = params.get('date') ?? ''
  const paidTime = params.get('time') ?? ''

  const [hospitals, setHospitals] = useState<PublicHospital[]>([])
  const [hospitalSlug, setHospitalSlug] = useState('')
  const [doctors, setDoctors] = useState<PublicDoctor[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dateMsg, setDateMsg] = useState('')
  const [sent, setSent] = useState(false)
  const [recovering, setRecovering] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem('medicore_pay_attempt'))
    } catch {
      return false
    }
  })
  const [recoveredRef, setRecoveredRef] = useState('')
  const [calMonth, setCalMonth] = useState(() => monthOf(new Date().toISOString().slice(0, 10)))
  const [monthAvail, setMonthAvail] = useState<Record<string, DayAvailability>>({})
  const [form, setForm] = useState({
    hospital: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    gender: 'Male',
    age: '',
    address: '',
    doctorId: '',
    type: 'Consultation' as AppointmentType,
    date: new Date().toISOString().slice(0, 10),
    time: '09:00',
    durationMin: 30,
    reason: '',
  })

  useEffect(() => {
    let cancelled = false
    Promise.all([masterApi.publicHospitals(), masterApi.publicPlatform()])
      .then(([list]) => {
        if (cancelled) return
        setHospitals(list)
        const initial = params.get('hospital') ?? list[0]?.slug ?? ''
        setHospitalSlug(initial)
        setForm((f) => ({ ...f, hospital: initial }))
      })
      .catch(() => {
        /* booking stays available with no hospital picker on failure */
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hospitalSlug) {
      setDoctors([])
      setForm((f) => ({ ...f, doctorId: '' }))
      return
    }
    let cancelled = false
    setDoctors([])
    setForm((f) => ({ ...f, doctorId: '' }))
    listPublicDoctors(hospitalSlug)
      .then((list) => {
        if (!cancelled) setDoctors(list)
      })
      .catch(() => {
        if (!cancelled) setDoctors([])
      })
    return () => {
      cancelled = true
    }
  }, [hospitalSlug])

  // When the user lands back without a confirmed callback (payment=failed or
  // any other non-success state), reconcile the stored attempt against eSewa's
  // status API — if the payment actually completed, show the success card.
  // eSewa's status API can lag behind the actual charge, so keep retrying for
  // a few seconds before giving up.
  useEffect(() => {
    if (payment === 'success') {
      sessionStorage.removeItem('medicore_pay_attempt')
      setRecovering(false)
      return
    }
    if (!payment || payment === 'conflict') return
    let cancelled = false
    let timer: number | undefined
    let attemptId = ''
    let hospital: string | undefined
    try {
      const raw = sessionStorage.getItem('medicore_pay_attempt')
      if (raw) {
        const stored = JSON.parse(raw) as { attemptId?: string; hospital?: string }
        attemptId = stored?.attemptId ?? ''
        hospital = stored.hospital
      }
    } catch {
      /* malformed stored attempt — ignore */
    }
    if (!attemptId) {
      setRecovering(false)
      return
    }
    let tries = 0
    const check = () => {
      reconcileBookingPayment({ attemptId, hospital })
        .then((result) => {
          if (cancelled) return
          if (result.status === 'success') {
            setRecoveredRef(result.appointmentNo ?? '')
            sessionStorage.removeItem('medicore_pay_attempt')
            setRecovering(false)
            return
          }
          if (tries < 4) {
            tries += 1
            timer = window.setTimeout(check, 3000)
          } else {
            setRecovering(false)
          }
        })
        .catch(() => {
          if (cancelled) return
          if (tries < 4) {
            tries += 1
            timer = window.setTimeout(check, 3000)
          } else {
            setRecovering(false)
          }
        })
    }
    check()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment])

  const pickHospital = (slug: string) => {
    setHospitalSlug(slug)
    setForm((f) => ({ ...f, hospital: slug }))
  }

  const selectedDoctor = doctors.find((d) => d.id === form.doctorId)

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Keep the chosen date valid: never in the past, and always one of the
  // doctor's working days. Runs when the doctor (or hospital) changes.
  useEffect(() => {
    if (!selectedDoctor) {
      if (form.date < TODAY) setForm((f) => ({ ...f, date: TODAY }))
      setDateMsg('')
      return
    }
    const snapped = nextWorkingDay(form.date < TODAY ? TODAY : form.date, selectedDoctor.schedule)
    if (snapped !== form.date) {
      setForm((f) => ({ ...f, date: snapped }))
      setDateMsg(`${selectedDoctor.name} does not work on ${dayOfWeek(form.date)} — the date was moved to ${snapped}. Working days: ${selectedDoctor.schedule.join(', ')}.`)
    } else {
      setDateMsg('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.doctorId, hospitalSlug])

  const pickDate = (date: string) => {
    setForm((f) => ({ ...f, date }))
    setDateMsg('')
  }

  // Keep the calendar on the month of the chosen date (e.g. after the doctor
  // snaps the date to their next working day).
  useEffect(() => {
    setCalMonth(monthOf(form.date))
  }, [form.date])

  const calMonthKey = monthKey(calMonth)

  // Load per-day availability for the visible month: days that are fully
  // booked are marked "booked" and hidden from the available choices.
  useEffect(() => {
    if (!form.doctorId) {
      setMonthAvail({})
      return
    }
    let cancelled = false
    setMonthAvail({})
    getPublicMonthAvailability(form.doctorId, calMonthKey, form.hospital)
      .then((res) => {
        if (!cancelled) setMonthAvail(res.days)
      })
      .catch(() => {
        if (!cancelled) setMonthAvail({})
      })
    return () => {
      cancelled = true
    }
  }, [form.doctorId, calMonthKey, form.hospital])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^\d{10}$/.test(form.phone.trim())) {
      setError('Phone number must be exactly 10 digits')
      setBusy(false)
      return
    }
    const age = Number(form.age)
    if (!Number.isInteger(age) || age < 0 || age > 120) {
      setError('Please enter a valid age (0–120)')
      setBusy(false)
      return
    }
    if (form.date < TODAY) {
      setError('Please choose a future date')
      setBusy(false)
      return
    }
    if (selectedDoctor && !selectedDoctor.schedule.includes(dayOfWeek(form.date))) {
      setError(`${selectedDoctor.name} does not work on ${dayOfWeek(form.date)} — pick one of their working days: ${selectedDoctor.schedule.join(', ')}`)
      setBusy(false)
      return
    }
    setBusy(true)
    try {
      const pay = await initiateBookingPayment({
        hospital: form.hospital,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        dob: `${new Date().getFullYear() - age}-01-01`,
        gender: form.gender as (typeof GENDERS)[number],
        address: form.address,
        doctorId: form.doctorId,
        type: form.type,
        date: form.date,
        time: form.time,
        durationMin: form.durationMin,
        reason: form.reason,
      })
      if (!pay.formUrl) {
        // No gateway (mock mode) — booked without a payment hop.
        setSent(true)
        return
      }
      // Remember the attempt so the landing page can reconcile the payment
      // against eSewa's status API if the callback redirect is ever lost.
      sessionStorage.setItem(
        'medicore_pay_attempt',
        JSON.stringify({ attemptId: pay.attemptId, hospital: form.hospital }),
      )
      // Auto-submit the hidden form to eSewa; the browser leaves this page
      // and comes back to /book-appointment?payment=... after the payment.
      const gateForm = document.createElement('form')
      gateForm.method = 'POST'
      gateForm.action = pay.formUrl
      for (const [name, value] of Object.entries(pay.fields)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = value
        gateForm.appendChild(input)
      }
      document.body.appendChild(gateForm)
      gateForm.submit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment')
    } finally {
      setBusy(false)
    }
  }

  const successCard = (icon: React.ReactElement, tone: string, title: string, body: React.ReactNode, cta: React.ReactElement) => (
    <div className="lp-book-card lp-form-success">
      <div className={`lp-form-success-icon tone-${tone}`}>{icon}</div>
      <div className="lp-form-success-title">{title}</div>
      <div className="lp-form-success-sub">{body}</div>
      {cta}
    </div>
  )

  return (
    <div className="lp-book">
      <nav className="lp-book-nav">
        <div className="lp-container lp-book-nav-inner">
          <Link to="/" className="lp-book-brand">
            <MedicoreLogo size={30} />
            Medicore HMS
          </Link>
          <Link to="/" className="lp-book-back">
            <ArrowLeft size={16} /> Back to home
          </Link>
        </div>
      </nav>

      <div className="lp-book-glow" aria-hidden="true" />

      <main className="lp-book-main">
        <div className="lp-container">
          <header className="lp-book-head">
            <h1>Book your visit in under a minute</h1>
            <p>
              Pick a doctor, choose a time that suits you, and secure your slot with a
              quick eSewa payment — we'll email the confirmation right away.
            </p>
          </header>

          {payment ? (
            <>
              {recovering && !recoveredRef && payment !== 'success' && (
                <div className="lp-book-card lp-form-success">
                  <div className="lp-form-success-icon tone-info">
                    <span className="lp-spinner" aria-hidden="true" />
                  </div>
                  <div className="lp-form-success-title">Confirming your payment…</div>
                  <div className="lp-form-success-sub">
                    Please wait a moment while we verify your payment. This usually takes a few
                    seconds — your appointment will appear right here once it is confirmed.
                  </div>
                </div>
              )}
              {!recovering && (payment === 'success' || recoveredRef) && successCard(
                <CheckCircle2 size={32} />,
                'success',
                recoveredRef ? 'Payment confirmed — appointment requested!' : 'Payment successful — appointment requested!',
                <>
                  {recoveredRef
                    ? 'We checked eSewa and confirmed your payment. Your appointment request'
                    : 'Your eSewa payment went through and your appointment request'}
                  {' '}(ref <strong>{recoveredRef || ref || 'sent to your email'}</strong>) has been received by{' '}
                  <strong>{paidDoctor || 'our team'}</strong>
                  {paidDate && paidTime ? (
                    <> for{' '}
                      {new Date(`${paidDate}T${paidTime}`).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </>
                  ) : null}
                  . A receipt and a confirmation email are on their way to{' '}
                  <strong>{form.email || 'your email'}</strong> — you'll be notified there when
                  the request is approved.
                </>,
                <Link to="/" className="lp-btn lp-btn-primary" style={{ marginTop: 8 }}>
                  Back to home
                </Link>,
              )}
              {!recovering && payment === 'failed' && !recoveredRef && successCard(
                <XCircle size={32} />,
                'error',
                'Payment was not completed',
                'No charge was made and no appointment was booked. You can try again with the same details or choose another time.',
                <Link to="/book-appointment" className="lp-btn lp-btn-primary" style={{ marginTop: 8 }}>
                  Try again
                </Link>,
              )}
              {!recovering && payment === 'conflict' && successCard(
                <XCircle size={32} />,
                'warn',
                'That slot was just taken',
                'Your payment went through, but another patient booked the same time first. We will contact you by email about your refund and you can pick a different slot below.',
                <Link to="/book-appointment" className="lp-btn lp-btn-primary" style={{ marginTop: 8 }}>
                  Book another time
                </Link>,
              )}
              {!recovering && payment !== 'success' && payment !== 'failed' && payment !== 'conflict' && !recoveredRef && successCard(
                <XCircle size={32} />,
                'error',
                'Something went wrong',
                'We could not confirm your payment. If any money was charged, it will be refunded — please contact the hospital front desk. No appointment was booked.',
                <Link to="/book-appointment" className="lp-btn lp-btn-primary" style={{ marginTop: 8 }}>
                  Try again
                </Link>,
              )}
            </>
          ) : sent ? (
            <div className="lp-book-card lp-form-success">
              <div className="lp-form-success-icon tone-success">
                <CheckCircle2 size={32} />
              </div>
              <div className="lp-form-success-title">Appointment requested!</div>
              <div className="lp-form-success-sub">
                {selectedDoctor?.name ?? 'Our team'} will confirm your booking for{' '}
                {new Date(`${form.date}T${form.time}`).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                . A confirmation email has been sent to <strong>{form.email || 'your email'}</strong> — you'll be
                notified there when it's approved, rescheduled or cancelled.
              </div>
              <Link to="/" className="lp-btn lp-btn-primary" style={{ marginTop: 8 }}>
                Back to home
              </Link>
            </div>
          ) : (
            <div className="lp-book-grid">
              <aside className="lp-book-aside">
                <div className="lp-book-aside-card">
                  <div className="lp-book-aside-title">What happens next?</div>
                  <ul className="lp-book-steps">
                    <li><span>1</span> Fill in your details and pick a doctor and time.</li>
                    <li><span>2</span> Pay the consultation fee securely via eSewa.</li>
                    <li><span>3</span> We confirm your slot and email you the details.</li>
                  </ul>
                </div>

                <div className="lp-book-aside-card">
                  <div className="lp-book-aside-title">Contact</div>
                  <div className="lp-book-contact">
                    <div><MapPin size={16} /> Itahari, Nepal</div>
                    <div><Phone size={16} /> 9862962969</div>
                    <div><Mail size={16} /> medocorehms@gmail.com</div>
                  </div>
                </div>

                <div className="lp-book-note">
                  <ShieldCheck size={18} />
                  Your information is kept private and used only to schedule your visit.
                </div>
              </aside>

              <form className="lp-book-card" onSubmit={submit}>
                <div className="lp-form-title"><span className="lp-form-num">1</span> Your details</div>
                <div className="lp-field">
                  <label className="lp-label">Hospital</label>
                  <select
                    className="lp-input"
                    value={form.hospital}
                    onChange={(e) => pickHospital(e.target.value)}
                    required
                  >
                    {hospitals.length === 0 && <option value="">Select a hospital…</option>}
                    {hospitals.map((h) => (
                      <option key={h.slug} value={h.slug}>{h.name}</option>
                    ))}
                  </select>
                  {hospitals.length === 0 && (
                    <span className="lp-book-hint">No hospitals listed yet — please try again later.</span>
                  )}
                </div>
                <div className="lp-form-row">
                  <div className="lp-field">
                    <label className="lp-label">First name</label>
                    <input className="lp-input" value={form.firstName} onChange={set('firstName')} placeholder="Jane" required />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Last name</label>
                    <input className="lp-input" value={form.lastName} onChange={set('lastName')} placeholder="Doe" required />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Phone</label>
                    <input
                      className="lp-input"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="98XXXXXXXX"
                      required
                    />
                    <span className="lp-book-hint">10-digit mobile number</span>
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Email</label>
                    <input className="lp-input" type="email" value={form.email} onChange={set('email')} placeholder="you@email.com" required />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Age</label>
                    <input
                      className="lp-input"
                      type="number"
                      min={0}
                      max={120}
                      inputMode="numeric"
                      value={form.age}
                      onChange={set('age')}
                      placeholder="e.g. 30"
                      required
                    />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Gender</label>
                    <select className="lp-input" value={form.gender} onChange={set('gender')}>
                      {GENDERS.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="lp-field">
                  <label className="lp-label">Address</label>
                  <input className="lp-input" value={form.address} onChange={set('address')} placeholder="City, district" />
                </div>

                <div className="lp-form-row">
                  <div className="lp-field">
                    <label className="lp-label">Doctor</label>
                    <select className="lp-input" value={form.doctorId} onChange={set('doctorId')} required>
                      <option value="">Select a doctor…</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} · {d.department}
                          {d.consultationFee > 0 ? ` · ${formatNpr(d.consultationFee)}` : ''}
                        </option>
                      ))}
                    </select>
                    {doctors.length === 0 && (
                      <span className="lp-book-hint">No available doctors right now. Please try again later.</span>
                    )}
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Appointment type</label>
                    <select className="lp-input" value={form.type} onChange={set('type')}>
                      {TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Date</label>
                    <div className="lp-cal">
                      <div className="lp-cal-head">
                        <button
                          type="button"
                          className="lp-cal-nav"
                          aria-label="Previous month"
                          disabled={calMonth.getTime() <= monthOf(TODAY).getTime()}
                          onClick={() => setCalMonth(addMonths(calMonth, -1))}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <div className="lp-cal-month">
                          {calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                          type="button"
                          className="lp-cal-nav"
                          aria-label="Next month"
                          disabled={calMonth.getTime() >= addMonths(monthOf(TODAY), 3).getTime()}
                          onClick={() => setCalMonth(addMonths(calMonth, 1))}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className="lp-cal-grid">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                          <div key={d} className="lp-cal-dow">{d}</div>
                        ))}
                        {calendarDays(calMonth).map((date, i) => {
                          if (!date) return <div key={`b${i}`} className="lp-cal-day lp-cal-day--blank" />
                          const state = form.doctorId ? monthAvail[date] : undefined
                          const booked = state === 'booked'
                          const available = isDateAvailable(date, selectedDoctor) && state !== 'booked' && state !== 'off'
                          return (
                            <button
                              key={date}
                              type="button"
                              className={`lp-cal-day${date === form.date ? ' lp-cal-day--selected' : ''}${booked ? ' lp-cal-day--booked' : ''}`}
                              disabled={!available}
                              onClick={() => pickDate(date)}
                            >
                              {Number(date.slice(8, 10))}
                              {booked && <span className="lp-cal-booked-tag">Full</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {selectedDoctor && selectedDoctor.schedule.length > 0 && (
                      <span className="lp-book-hint">Available days: {selectedDoctor.schedule.join(', ')}</span>
                    )}
                    {dateMsg && <span className="lp-book-hint lp-book-hint-error">{dateMsg}</span>}
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Time</label>
                    <input className="lp-input" type="time" value={form.time} onChange={set('time')} required />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Duration</label>
                    <select
                      className="lp-input"
                      value={form.durationMin}
                      onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) }))}
                    >
                      {[15, 30, 45, 60, 90].map((m) => (
                        <option key={m} value={m}>{m} minutes</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="lp-field">
                  <label className="lp-label">Reason for visit</label>
                  <textarea
                    className="lp-input lp-textarea"
                    rows={3}
                    value={form.reason}
                    onChange={set('reason')}
                    placeholder="Brief description of symptoms or purpose…"
                    required
                  />
                </div>

                {selectedDoctor && selectedDoctor.consultationFee > 0 && (
                  <div className="lp-book-fee">
                    <div className="lp-fee-left">
                      <CreditCard size={20} />
                      <div>
                        <div className="lp-fee-label">Consultation fee</div>
                        <div className="lp-fee-sub">Paid securely via eSewa when you confirm</div>
                      </div>
                    </div>
                    <div className="lp-fee-amount">{formatNpr(selectedDoctor.consultationFee)}</div>
                  </div>
                )}

                {error && <div className="lp-error">{error}</div>}

                <button
                  type="submit"
                  disabled={busy}
                  className="lp-btn lp-btn-primary lp-book-submit"
                >
                  <CreditCard size={18} />
                  {busy ? 'Preparing payment…' : `Confirm & Pay${selectedDoctor && selectedDoctor.consultationFee > 0 ? ` ${formatNpr(selectedDoctor.consultationFee)}` : ''}`}
                </button>
                <p className="lp-book-secure"><ShieldCheck size={14} /> Your slot is held only while you complete payment — if the time is taken, eSewa refunds automatically.</p>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
