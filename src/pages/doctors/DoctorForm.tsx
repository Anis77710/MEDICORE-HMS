import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { createDoctor, updateDoctor } from '../../api/services/doctors'
import type { Doctor } from '../../types'
import { Field, Input, Button, FormActions } from '../../components/ui'

const DEPARTMENTS = [
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'General Medicine',
  'Orthopedics',
  'Dermatology',
  'Oncology',
  'Gynecology',
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DoctorResult {
  ok: boolean
  message: string
  credentials?: { username: string; password: string } | null
}

export function DoctorForm({
  doctor,
  onDone,
}: {
  doctor: Doctor | null
  onDone: (saved: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DoctorResult | null>(null)
  const submittingRef = useRef(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'General Medicine',
    specialty: '',
    qualification: '',
    experienceYears: 5,
    consultationFee: 80,
    status: 'Active' as Doctor['status'],
    schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    birthYear: '',
  })

  useEffect(() => {
    if (doctor) {
      setForm({
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        department: doctor.department,
        specialty: doctor.specialty,
        qualification: doctor.qualification,
        experienceYears: doctor.experienceYears,
        consultationFee: doctor.consultationFee,
        status: doctor.status,
        schedule: doctor.schedule,
        birthYear: doctor.birthYear ? String(doctor.birthYear) : '',
      })
    }
  }, [doctor])

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      schedule: f.schedule.includes(day)
        ? f.schedule.filter((d) => d !== day)
        : [...f.schedule, day],
    }))
  }

  const resetAndAddAnother = () => {
    setResult(null)
    setError('')
    setForm({
      name: '',
      email: '',
      phone: '',
      department: 'General Medicine',
      specialty: '',
      qualification: '',
      experienceYears: 5,
      consultationFee: 80,
      status: 'Active' as Doctor['status'],
      schedule: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      birthYear: '',
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    setError('')
    setBusy(true)
    submittingRef.current = true
    try {
      if (doctor) {
        await updateDoctor(doctor.id, { ...form, birthYear: form.birthYear ? Number(form.birthYear) : undefined })
        setResult({ ok: true, message: `Dr. ${form.name} has been updated successfully.` })
      } else {
        const year = parseInt(form.birthYear, 10)
        if (Number.isNaN(year) || year < 1900 || year > 2100) {
          setError('Please enter a valid birth year (e.g. 1985)')
          setBusy(false)
          submittingRef.current = false
          return
        }
        const created = await createDoctor({ ...form, birthYear: year })
        setResult({
          ok: true,
          message: `Dr. ${form.name} has been added successfully. Login credentials were sent to ${form.email}.`,
          credentials: created.credentials,
        })
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to save doctor',
      })
    } finally {
      setBusy(false)
      submittingRef.current = false
    }
  }

  if (result) {
    return (
      <div className={`doctor-result ${result.ok ? 'doctor-result-ok' : 'doctor-result-error'}`}>
        <div className="doctor-result-icon">
          {result.ok ? <CheckCircle2 size={44} /> : <XCircle size={44} />}
        </div>
        <div className="doctor-result-title">
          {result.ok
            ? doctor
              ? 'Doctor updated'
              : 'Doctor created successfully'
            : 'Failed to save doctor'}
        </div>
        <div className="doctor-result-sub">{result.message}</div>

        {result.ok && result.credentials && (
          <div className="doctor-result-credentials">
            <div className="doctor-result-credentials-title">Temporary login credentials</div>
            <div className="doctor-result-credentials-row">
              <span>Username</span>
              <strong>{result.credentials.username}</strong>
            </div>
            <div className="doctor-result-credentials-row">
              <span>Password</span>
              <strong>{result.credentials.password}</strong>
            </div>
            <div className="doctor-result-credentials-hint">
              Share these with the doctor — they can change them after first login.
            </div>
          </div>
        )}

        <FormActions>
          {result.ok ? (
            <>
              <Button type="button" variant="outline" onClick={resetAndAddAnother}>
                <RotateCcw size={16} /> Add another
              </Button>
              <Button type="button" onClick={() => onDone(true)}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setResult(null)}>
                Try again
              </Button>
              <Button type="button" variant="outline" onClick={() => onDone(false)}>
                Cancel
              </Button>
            </>
          )}
        </FormActions>
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Full Name">
          <Input value={form.name} onChange={set('name')} required placeholder="Dr. John Smith" />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} required placeholder="john@gmail.com" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} required placeholder="+977 98XXXXXXXX" />
        </Field>
        <Field label="Department">
          <select className="select" value={form.department} onChange={set('department')}>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Specialty">
          <Input value={form.specialty} onChange={set('specialty')} required placeholder="Cardiologist" />
        </Field>
        <Field label="Qualification">
          <Input value={form.qualification} onChange={set('qualification')} placeholder="MD, DM (Cardiology)" />
        </Field>
        <Field label="Years of Experience">
          <Input
            type="number"
            min={0}
            max={50}
            value={form.experienceYears}
            onChange={set('experienceYears')}
          />
        </Field>
        <Field label="Consultation Fee (NPR)">
          <Input
            type="number"
            min={0}
            value={form.consultationFee}
            onChange={set('consultationFee')}
          />
        </Field>
        <Field label="Status">
          <select className="select" value={form.status} onChange={set('status')}>
            <option>Active</option>
            <option>On Leave</option>
            <option>Unavailable</option>
          </select>
        </Field>
        <Field label="Working Days">
          <div className="schedule-days">
            {WEEKDAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`schedule-day ${form.schedule.includes(d) ? 'schedule-day-on' : ''}`}
                onClick={() => toggleDay(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
        {!doctor && (
          <Field label="Birth Year">
            <Input type="number" min={1900} max={2100} value={form.birthYear} onChange={set('birthYear')} placeholder="e.g. 1985" required />
          </Field>
        )}
      </div>

      {error && <div className="auth-error">{error}</div>}

      <FormActions>
        <Button type="button" variant="outline" onClick={() => onDone(false)}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {doctor ? 'Save Changes' : 'Add Doctor'}
        </Button>
      </FormActions>
    </form>
  )
}