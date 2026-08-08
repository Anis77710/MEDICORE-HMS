import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle2,
  Mail, MapPin, Phone, ShieldCheck,
} from 'lucide-react'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'
import { listDoctors } from '../../api/services/doctors'
import { createPatient } from '../../api/services/patients'
import { createAppointment } from '../../api/services/appointments'
import type { AppointmentType, Doctor } from '../../types'
import './landing.css'

const TYPES: AppointmentType[] = ['Checkup', 'Consultation', 'Follow-up', 'Emergency', 'Procedure']

const GENDERS = ['Male', 'Female', 'Other'] as const

export default function BookAppointmentPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
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
    listDoctors().then(setDoctors).catch(() => setDoctors([]))
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
      const patient = await createPatient({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        dob: form.dob,
        gender: form.gender as (typeof GENDERS)[number],
        bloodGroup: '',
        address: form.address,
        emergencyContact: '',
        department: selectedDoctor?.department ?? 'General',
        assignedDoctorId: form.doctorId,
        insurance: '',
        allergies: [],
      })
      await createAppointment({
        patientId: patient.id,
        doctorId: form.doctorId,
        type: form.type,
        date: form.date,
        time: form.time,
        durationMin: form.durationMin,
        reason: form.reason,
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment')
    } finally {
      setBusy(false)
    }
  }

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

      <main className="lp-book-main">
        <div className="lp-container">
          <div className="lp-book-head">
            <h1>Schedule a visit with our doctors</h1>
            <p>
              Tell us a little about yourself, pick a doctor and a time that works for you,
              and we'll confirm your appointment right away.
            </p>
          </div>

          {sent ? (
            <div className="lp-book-card lp-form-success">
              <div className="lp-form-success-icon">
                <CheckCircle2 size={32} color="#059669" />
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
                . We'll contact you at {form.phone} shortly.
              </div>
              <Link to="/" className="lp-btn lp-btn-primary" style={{ marginTop: 8 }}>
                Back to home
              </Link>
            </div>
          ) : (
            <div className="lp-book-grid">
              <aside className="lp-book-aside">
                <div className="lp-book-aside-title">What happens next?</div>
                <ul className="lp-book-steps">
                  <li><span>1</span> Submit the form with your details and preferred doctor.</li>
                  <li><span>2</span> Our front desk reviews and confirms your slot.</li>
                  <li><span>3</span> You get a confirmation call with details.</li>
                </ul>

                <div className="lp-book-aside-title">Contact</div>
                <div className="lp-book-contact">
                  <div><MapPin size={16} /> Itahari, Nepal</div>
                  <div><Phone size={16} /> 9862962969</div>
                  <div><Mail size={16} /> medocorehms@gmail.com</div>
                </div>

                <div className="lp-book-note">
                  <ShieldCheck size={18} />
                  Your information is kept private and used only to schedule your visit.
                </div>
              </aside>

              <form className="lp-book-card" onSubmit={submit}>
                <div className="lp-form-title">Your details</div>
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
                    <input className="lp-input" type="email" value={form.email} onChange={set('email')} placeholder="you@email.com" />
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

                <div className="lp-form-title" style={{ marginTop: 8 }}>Appointment details</div>
                <div className="lp-form-row">
                  <div className="lp-field">
                    <label className="lp-label">Doctor</label>
                    <select className="lp-input" value={form.doctorId} onChange={set('doctorId')} required>
                      <option value="">Select a doctor…</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} · {d.specialty}
                        </option>
                      ))}
                    </select>
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

                {error && <div className="lp-error">{error}</div>}

                <button type="submit" disabled={busy} className="lp-btn lp-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  {busy ? 'Booking…' : 'Confirm Appointment'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
