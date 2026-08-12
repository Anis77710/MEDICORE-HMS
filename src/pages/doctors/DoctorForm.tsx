import { useEffect, useState } from 'react'
import { createDoctor, updateDoctor } from '../../api/services/doctors'
import type { Doctor } from '../../types'
import { Field, Input, Button, FormActions } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

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

export function DoctorForm({
  doctor,
  onDone,
}: {
  doctor: Doctor | null
  onDone: (saved: boolean) => void
}) {
  const { push } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (doctor) {
        await updateDoctor(doctor.id, { ...form, birthYear: form.birthYear ? Number(form.birthYear) : undefined })
        push('Doctor updated')
      } else {
        const year = parseInt(form.birthYear, 10)
        if (Number.isNaN(year) || year < 1900 || year > 2100) {
          setError('Please enter a valid birth year (e.g. 1985)')
          setBusy(false)
          return
        }
        await createDoctor({ ...form, birthYear: year })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save doctor')
    } finally {
      setBusy(false)
    }
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
