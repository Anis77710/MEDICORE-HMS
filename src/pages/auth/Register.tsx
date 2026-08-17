import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Building2, User, Mail, Phone, Calendar } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Field, Input, Button } from '../../components/ui'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'

export default function Register() {
  const { register } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    hospitalName: '',
    name: '',
    email: '',
    phone: '',
    birthYear: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const year = parseInt(form.birthYear, 10)
    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      setError('Please enter a valid birth year (e.g. 1985)')
      return
    }
    setBusy(true)
    try {
      const res = await register({
        hospitalName: form.hospitalName,
        name: form.name,
        email: form.email,
        phone: form.phone,
        birthYear: year,
      })
      push(
        `"${res.hospital?.name ?? form.hospitalName}" registered. Your login credentials have been sent to your email`,
      )
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand-panel">
            <div className="auth-deco">
              <Activity size={140} strokeWidth={1} />
            </div>
            <div className="auth-brand-content">
              <Link to="/" className="auth-brand-logo">
                <div className="auth-logo-box">
                  <MedicoreLogo size={32} />
                </div>
                <h1>Medicore HMS</h1>
              </Link>
              <h2>Register your hospital</h2>
              <p>
                One platform for doctors, nurses, patients, administrators and hospital staff to
                run daily operations smoothly. Your team members are added by you - the admin -
                after registration.
              </p>
            </div>
            <div className="auth-brand-foot">
              <span>Trusted by 1,200+ hospitals</span>
            </div>
          </div>

          <div className="auth-form-panel">
            <div className="auth-form-inner">
              <>
                <h2 className="auth-title">Register Your Hospital</h2>
                <p className="auth-subtitle">
                  This creates the hospital profile and the first administrator account. Doctors,
                  nurses and staff are added by you after registration - their login credentials
                  are sent to each member's email automatically.
                </p>

                <form onSubmit={submit} noValidate>
                    <Field label="Hospital Name">
                      <div className="auth-input-wrap">
                        <Building2 size={18} className="auth-input-icon" />
                        <Input value={form.hospitalName} onChange={set('hospitalName')} placeholder="Medicore General Hospital" autoComplete="organization" required className="auth-input" />
                      </div>
                    </Field>

                    <Field label="Your Full Name">
                      <div className="auth-input-wrap">
                        <User size={18} className="auth-input-icon" />
                        <Input value={form.name} onChange={set('name')} placeholder="Ramesh Sharma" autoComplete="name" required className="auth-input" />
                      </div>
                    </Field>

                    <Field label="Your Gmail Address">
                      <div className="auth-input-wrap">
                        <Mail size={18} className="auth-input-icon" />
                        <Input type="email" value={form.email} onChange={set('email')} placeholder="ramesh@gmail.com" autoComplete="email" required className="auth-input" />
                      </div>
                    </Field>

                    <Field label="Phone Number">
                      <div className="auth-input-wrap">
                        <Phone size={18} className="auth-input-icon" />
                        <Input value={form.phone} onChange={set('phone')} placeholder="+977 98XXXXXXXX" autoComplete="tel" required className="auth-input" />
                      </div>
                    </Field>

                    <Field label="Your Birth Year">
                      <div className="auth-input-wrap">
                        <Calendar size={18} className="auth-input-icon" />
                        <Input type="number" min={1900} max={2100} value={form.birthYear} onChange={set('birthYear')} placeholder="e.g. 1985" required className="auth-input" />
                      </div>
                    </Field>

                    {error && <div className="auth-error">{error}</div>}

                    <Button type="submit" size="lg" block loading={busy}>
                      Register Hospital
                    </Button>
                  </form>

                  <p className="auth-foot">
                    Already have an account?{' '}
                    <Link to="/login" className="auth-link-strong">
                      Log in
                    </Link>
                  </p>
                </>
              </div>
            </div>
          </div>
      </main>
    </div>
  )
}
