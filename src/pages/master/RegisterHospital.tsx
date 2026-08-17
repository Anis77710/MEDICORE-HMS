import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Building2, Calendar, CheckCircle2, CreditCard, Lock, Mail, Phone, ShieldCheck, User,
} from 'lucide-react'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'
import { Field, Input, Button } from '../../components/ui'
import { masterApi } from '../../api/services/master'
import '../landing/landing.css'

export default function RegisterHospital() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    hospitalName: '',
    name: '',
    email: '',
    phone: '',
    birthYear: '',
  })

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
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
      const pay = await masterApi.initiateHospitalRegistration({
        hospitalName: form.hospitalName,
        name: form.name,
        email: form.email,
        phone: form.phone,
        birthYear: year,
      })
      // Auto-submit the hidden form to eSewa; the browser returns to
      // /master/register/status?payment=... after the payment.
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
      setError(err instanceof Error ? err.message : 'Failed to start registration')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lp-book">
      <nav className="lp-book-nav">
        <div className="lp-container lp-book-nav-inner">
          <Link to="/home" className="lp-book-brand">
            <MedicoreLogo size={30} />
            Medicore HMS
          </Link>
          <Link to="/home" className="lp-book-back">
            <ArrowLeft size={16} /> Back to home
          </Link>
        </div>
      </nav>

      <div className="lp-book-glow" aria-hidden="true" />

      <main className="lp-book-main">
        <div className="lp-container">
          <header className="lp-book-head">
            <h1>Register your hospital</h1>
            <p>
              Pay the one-time registration fee by eSewa, and
              the platform team will review your request. Once approved, your hospital goes live
              and your login credentials - along with your payment receipt - are emailed to you.
            </p>
          </header>

          <div className="lp-book-grid">
            <div className="lp-book-form">
              <div className="lp-book-card">
                <form onSubmit={submit} noValidate>
                  <div className="lp-form-field">
                    <Field label="Hospital Name">
                      <div className="auth-input-wrap">
                        <Building2 size={18} className="auth-input-icon" />
                        <Input
                          value={form.hospitalName}
                          onChange={set('hospitalName')}
                          placeholder="Medicore General Hospital"
                          autoComplete="organization"
                          required
                          className="auth-input"
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="lp-form-field">
                    <Field label="Your Full Name">
                      <div className="auth-input-wrap">
                        <User size={18} className="auth-input-icon" />
                        <Input
                          value={form.name}
                          onChange={set('name')}
                          placeholder="Ramesh Sharma"
                          autoComplete="name"
                          required
                          className="auth-input"
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="lp-form-field">
                    <Field label="Your Gmail Address">
                      <div className="auth-input-wrap">
                        <Mail size={18} className="auth-input-icon" />
                        <Input
                          type="email"
                          value={form.email}
                          onChange={set('email')}
                          placeholder="ramesh@gmail.com"
                          autoComplete="email"
                          required
                          className="auth-input"
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="lp-form-field">
                    <Field label="Phone Number">
                      <div className="auth-input-wrap">
                        <Phone size={18} className="auth-input-icon" />
                        <Input
                          value={form.phone}
                          onChange={set('phone')}
                          placeholder="+977 98XXXXXXXX"
                          autoComplete="tel"
                          required
                          className="auth-input"
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="lp-form-field">
                    <Field label="Your Birth Year">
                      <div className="auth-input-wrap">
                        <Calendar size={18} className="auth-input-icon" />
                        <Input
                          type="number"
                          min={1900}
                          max={2100}
                          value={form.birthYear}
                          onChange={set('birthYear')}
                          placeholder="e.g. 1985"
                          required
                          className="auth-input"
                        />
                      </div>
                    </Field>
                  </div>

                  {error && <div className="auth-error">{error}</div>}

                  <Button type="submit" size="lg" block loading={busy}>
                    Pay &amp; Submit Request
                  </Button>
                </form>
              </div>
            </div>

            <aside className="lp-book-side">
              <div className="lp-book-card lp-summary">
                <div className="lp-summary-title">
                  <CreditCard size={18} /> Registration summary
                </div>
                <ul className="lp-summary-list">
                  <li>
                    <span>Registration fee</span>
                    <strong>One-time</strong>
                  </li>
                  <li>
                    <span>Payment method</span>
                    <strong>eSewa</strong>
                  </li>
                </ul>
                <div className="lp-summary-note">
                  <CheckCircleIcon />
                  Every hospital pays the one-time registration fee.
                  Your receipt is included in the approval email.
                </div>
              </div>

              <div className="lp-book-card lp-trust">
                <div className="lp-trust-item">
                  <ShieldCheck size={18} />
                  <span>Secure eSewa payment</span>
                </div>
                <div className="lp-trust-item">
                  <Lock size={18} />
                  <span>Approval before go-live</span>
                </div>
                <div className="lp-trust-item">
                  <Mail size={18} />
                  <span>Credentials + receipt emailed</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}

function CheckCircleIcon() {
  return <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
}
