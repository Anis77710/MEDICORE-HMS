import { useEffect, useState } from 'react'
import { createStaff, updateStaff } from '../../api/services/misc'
import type { StaffMember } from '../../types'
import { Field, Input, Button, FormActions } from '../../components/ui'
import { useToast } from '../../context/ToastContext'

const DEPARTMENTS = [
  'Administration',
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'General Medicine',
  'Orthopedics',
  'Dermatology',
  'Oncology',
  'Gynecology',
  'Emergency',
  'Pharmacy',
  'Billing',
  'Front Desk',
]

export function StaffForm({
  member,
  onDone,
}: {
  member: StaffMember | null
  onDone: (saved: boolean) => void
}) {
  const { push } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'STAFF' as StaffMember['role'],
    department: 'Front Desk',
    shift: 'Morning' as StaffMember['shift'],
    salary: 0,
    status: 'Active' as StaffMember['status'],
    birthYear: '',
  })

  useEffect(() => {
    if (member) {
      setForm({
        name: member.name,
        email: member.email,
        phone: member.phone,
        role: member.role,
        department: member.department,
        shift: member.shift,
        salary: member.salary,
        status: member.status,
        birthYear: member.birthYear ? String(member.birthYear) : '',
      })
    }
  }, [member])

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (member) {
        await updateStaff(member.id, { ...form, birthYear: form.birthYear ? Number(form.birthYear) : undefined })
        push('Staff member updated')
      } else {
        const year = parseInt(form.birthYear, 10)
        if (Number.isNaN(year) || year < 1900 || year > 2100) {
          setError('Please enter a valid birth year (e.g. 1985)')
          setBusy(false)
          return
        }
        await createStaff({ ...form, birthYear: year })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff member')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="Full Name">
          <Input value={form.name} onChange={set('name')} required placeholder="Jane Smith" />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} required placeholder="j.smith@gmail.com" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} required placeholder="+977 98XXXXXXXX" />
        </Field>
        <Field label="Role">
          <select className="select" value={form.role} onChange={set('role')}>
            {(['ADMIN', 'DOCTOR', 'NURSE', 'STAFF'] as const).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department">
          <select className="select" value={form.department} onChange={set('department')}>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Shift">
          <select className="select" value={form.shift} onChange={set('shift')}>
            {(['Morning', 'Evening', 'Night', 'Rotating'] as const).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Annual Salary (NPR)">
          <Input type="number" min={0} value={form.salary} onChange={set('salary')} />
        </Field>
        <Field label="Status">
          <select className="select" value={form.status} onChange={set('status')}>
            {(['Active', 'On Leave', 'Resigned'] as const).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        {!member && (
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
          {member ? 'Save Changes' : 'Add Staff'}
        </Button>
      </FormActions>
    </form>
  )
}
