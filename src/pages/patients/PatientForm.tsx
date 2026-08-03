import { useEffect, useState } from 'react'
import { createPatient, updatePatient } from '../../api/services/patients'
import { listDoctors } from '../../api/services/doctors'
import type { Doctor, Gender, Patient } from '../../types'
import { Field, Input, Button, FormActions } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

export function PatientForm({
  patient,
  onDone,
}: {
  patient: Patient | null
  onDone: (saved: boolean) => void
}) {
  const { push } = useToast()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Female' as Gender,
    bloodGroup: 'O+',
    address: '',
    emergencyContact: '',
    department: 'General Medicine',
    assignedDoctorId: '',
    insurance: '',
    allergies: '',
  })

  useEffect(() => {
    listDoctors().then(setDoctors).catch(() => setDoctors([]))
  }, [])

  useEffect(() => {
    if (patient) {
      setForm({
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        dob: patient.dob,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        address: patient.address,
        emergencyContact: patient.emergencyContact,
        department: patient.department,
        assignedDoctorId: patient.assignedDoctorId,
        insurance: patient.insurance,
        allergies: patient.allergies.join(', '),
      })
    }
  }, [patient])

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const payload = {
        ...form,
        allergies: form.allergies
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      }
      if (patient) {
        await updatePatient(patient.id, payload)
        push('Patient updated')
      } else {
        await createPatient(payload)
        push('Patient registered')
      }
      onDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save patient')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="First Name">
          <Input value={form.firstName} onChange={set('firstName')} required placeholder="Sarah" />
        </Field>
        <Field label="Last Name">
          <Input value={form.lastName} onChange={set('lastName')} required placeholder="Johnson" />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} required placeholder="patient@email.com" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} required placeholder="+1 (555) 000-0000" />
        </Field>
        <Field label="Date of Birth">
          <Input type="date" value={form.dob} onChange={set('dob')} required />
        </Field>
        <Field label="Gender">
          <select className="select" value={form.gender} onChange={set('gender')}>
            <option>Female</option>
            <option>Male</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Blood Group">
          <select className="select" value={form.bloodGroup} onChange={set('bloodGroup')}>
            {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Department">
          <select className="select" value={form.department} onChange={set('department')}>
            {Array.from(new Set(doctors.map((d) => d.department))).map((dep) => (
              <option key={dep}>{dep}</option>
            ))}
            {doctors.length === 0 && <option>General Medicine</option>}
          </select>
        </Field>
        <Field label="Assigned Doctor">
          <select className="select" value={form.assignedDoctorId} onChange={set('assignedDoctorId')} required>
            <option value="">Select a doctor…</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.specialty}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Insurance">
          <Input value={form.insurance} onChange={set('insurance')} placeholder="BlueCross HMO" />
        </Field>
        <Field label="Emergency Contact" className-field>
          <Input value={form.emergencyContact} onChange={set('emergencyContact')} placeholder="+1 (555) 000-0000" />
        </Field>
        <Field label="Allergies (comma separated)">
          <Input value={form.allergies} onChange={set('allergies')} placeholder="Penicillin, Latex" />
        </Field>
      </div>

      <Field label="Address">
        <textarea className="textarea" rows={2} value={form.address} onChange={set('address')} placeholder="Street, City, State" />
      </Field>

      {error && <div className="auth-error">{error}</div>}

      <FormActions>
        <Button type="button" variant="outline" onClick={() => onDone(false)}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {patient ? 'Save Changes' : 'Register Patient'}
        </Button>
      </FormActions>
    </form>
  )
}
