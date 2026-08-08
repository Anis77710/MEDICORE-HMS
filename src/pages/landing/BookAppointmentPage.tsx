import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2, CreditCard,
  Mail, MapPin, Phone, ShieldCheck, XCircle,
} from 'lucide-react'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'
import { listPublicDoctors, initiateBookingPayment, type PublicDoctor } from '../../api/services/public'
import type { AppointmentType } from '../../types'
import './landing.css'

const TYPES: AppointmentType[] = ['Checkup', 'Consultation', 'Follow-up', 'Emergency', 'Procedure']

const GENDERS = ['Male', 'Female', 'Other'] as const

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

  const [doctors, setDoctors] = useState<PublicDoctor[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    gender: 'Male',
    dob: '',
    address: '',
    doctorId: '',
    type: 'Consultation' as AppointmentType,
    date: new Date().toISOString().slice(0, 10),
    time: '09:00',
    durationMin: 30,
    reason: '',
  })

  useEffect(() => {
    listPublicDoctors().then(setDoctors).catch(() => setDoctors([]))
  }, [])

  const selectedDoctor = doctors.find((d) => d.id === form.doctorId)

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const pay = await initiateBookingPayment({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        dob: form.dob,
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
              {payment === 'success' && successCard(
                <CheckCircle2 size={32} />,
                'success',
                'Payment successful — appointment requested!',
                <>
                  Your eSewa payment went through and your appointment request
                  (ref <strong>{ref || 'sent to your email'}</strong>) has been received by{' '}
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
              {payment === 'failed' && successCard(
                <XCircle size={32} />,
                'error',
                'Payment was not completed',
                'No charge was made and no appointment was booked. You can try again with the same details or choose another time.',
                <Link to="/book-appointment" className="lp-btn lp-btn-primary" style={{ marginTop: 8 }}>
                  Try again
                </Link>,
              )}
              {payment === 'conflict' && successCard(
                <XCircle size={32} />,
                'warn',
                'That slot was just taken',
                'Your payment went through, but another patient booked the same time first. We will contact you by email about your refund and you can pick a different slot below.',
                <Link to="/book-appointment" className="lp-btn lp-btn-primary" style={{ marginTop: 8 }}>
                  Book another time
                </Link>,
              )}
              {(payment !== 'success' && payment !== 'failed' && payment !== 'conflict') && successCard(
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
                    <input className="lp-input" type="tel" value={form.phone} onChange={set('phone')} placeholder="98XXXXXXXX" required />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Email</label>
                    <input className="lp-input" type="email" value={form.email} onChange={set('email')} placeholder="you@email.com" required />
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Date of birth</label>
                    <input className="lp-input" type="date" value={form.dob} onChange={set('dob')} required />
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
                    <input className="lp-input" type="date" value={form.date} onChange={set('date')} required />
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
