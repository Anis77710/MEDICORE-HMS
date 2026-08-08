import { useEffect, useState } from 'react'
import { createAppointment } from '../../api/services/appointments'
import { listDoctors } from '../../api/services/doctors'
import { listPatients } from '../../api/services/patients'
import type { AppointmentType, Doctor, Patient } from '../../types'
import { Field, Input, Button, FormActions } from '../../components/ui'

const TYPES: AppointmentType[] = ['Checkup', 'Consultation', 'Follow-up', 'Emergency', 'Procedure']

export function BookAppointment({
  defaultDate,
  onDone,
}: {
  defaultDate?: string
  onDone: (ok: boolean) => void
}) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    patientId: '',
    doctorId: '',
    type: 'Consultation' as AppointmentType,
    date: defaultDate ?? new Date().toISOString().slice(0, 10),
    time: '09:00',
    durationMin: 30,
    reason: '',
  })

  useEffect(() => {
    listPatients({ limit: 100 }).then((r) => setPatients(r.items)).catch(() => setPatients([]))
    listDoctors().then(setDoctors).catch(() => setDoctors([]))
  }, [])

  useEffect(() => {
    if (defaultDate) setForm((f) => ({ ...f, date: defaultDate }))
  }, [defaultDate])

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await createAppointment(form)
      onDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book appointment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Field label="Patient">
        <select className="select" value={form.patientId} onChange={set('patientId')} required>
          <option value="">Select a patient…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} · {p.patientId}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Doctor">
        <select className="select" value={form.doctorId} onChange={set('doctorId')} required>
          <option value="">Select a doctor…</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.department}
            </option>
          ))}
        </select>
      </Field>

      <div className="form-grid">
        <Field label="Appointment Type">
          <select className="select" value={form.type} onChange={set('type')}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Duration (minutes)">
          <select className="select" value={form.durationMin} onChange={set('durationMin')}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
          </select>
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={set('date')} required />
        </Field>
        <Field label="Time">
          <Input type="time" value={form.time} onChange={set('time')} required />
        </Field>
      </div>

      <Field label="Reason for Visit">
        <textarea
          className="textarea"
          rows={2}
          value={form.reason}
          onChange={set('reason')}
          placeholder="Brief description of symptoms or purpose…"
          required
        />
      </Field>

      {error && <div className="auth-error">{error}</div>}

      <FormActions>
        <Button type="button" variant="outline" onClick={() => onDone(false)}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          <CalendarPlusIcon /> Book Appointment
        </Button>
      </FormActions>
    </form>
  )
}

function CalendarPlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
      <path d="M16 2v4" />
      <path d="M8 2v4" />
      <path d="M3 10h18" />
      <path d="M19 16v6" />
      <path d="M16 19h6" />
    </svg>
  )
}
