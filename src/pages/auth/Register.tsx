import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, User, Mail, Phone, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Field, Input, Button } from '../../components/ui'

const ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'STAFF', 'PATIENT'] as const

export default function Register() {
  const { register } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'DOCTOR' as (typeof ROLES)[number],
    password: '',
    confirm: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        password: form.password,
      })
      push('Account created — welcome to HealSync')
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
              <div className="auth-brand-logo">
                <div className="auth-logo-box">
                  <Activity size={26} strokeWidth={2.4} />
                </div>
                <h1>HealSync</h1>
              </div>
              <h2>Join the network</h2>
              <p>
                One platform for doctors, nurses, patients, administrators and hospital staff to
                run daily operations smoothly.
              </p>
            </div>
            <div className="auth-brand-foot">
              <span>Trusted by 1,200+ hospitals</span>
            </div>
          </div>

          <div className="auth-form-panel">
            <div className="auth-form-inner">
              <h2 className="auth-title">Create Account</h2>
              <p className="auth-subtitle">Get started with your hospital workspace.</p>

              <form onSubmit={submit} noValidate>
                <Field label="Full Name">
                  <div className="auth-input-wrap">
                    <User size={18} className="auth-input-icon" />
                    <Input value={form.name} onChange={set('name')} placeholder="Dr. Jane Doe" autoComplete="name" required className="auth-input" />
                  </div>
                </Field>

                <Field label="Email Address">
                  <div className="auth-input-wrap">
                    <Mail size={18} className="auth-input-icon" />
                    <Input type="email" value={form.email} onChange={set('email')} placeholder="you@hospital.com" autoComplete="email" required className="auth-input" />
                  </div>
                </Field>

                <Field label="Phone Number">
                  <div className="auth-input-wrap">
                    <Phone size={18} className="auth-input-icon" />
                    <Input value={form.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" autoComplete="tel" required className="auth-input" />
                  </div>
                </Field>

                <Field label="Role">
                  <select className="select" value={form.role} onChange={set('role')}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="form-grid">
                  <Field label="Password">
                    <div className="auth-input-wrap">
                      <Lock size={18} className="auth-input-icon" />
                      <Input type="password" value={form.password} onChange={set('password')} placeholder="Min. 6 characters" autoComplete="new-password" required className="auth-input" />
                    </div>
                  </Field>
                  <Field label="Confirm Password">
                    <div className="auth-input-wrap">
                      <Lock size={18} className="auth-input-icon" />
                      <Input type="password" value={form.confirm} onChange={set('confirm')} placeholder="Repeat password" autoComplete="new-password" required className="auth-input" />
                    </div>
                  </Field>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <Button type="submit" size="lg" block loading={busy}>
                  Create Account
                </Button>
              </form>

              <p className="auth-foot">
                Already have an account?{' '}
                <Link to="/login" className="auth-link-strong">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
