import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import * as authApi from '../../api/services/auth'
import { useToast } from '../../context/ToastContext'
import { Field, Input, Button } from '../../components/ui'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'

export default function ForgotPassword() {
  const { push } = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await authApi.forgotPassword(email)
      push(res.message, 'info')
      navigate('/verify-otp', { state: { email } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <main className="auth-shell auth-shell-sm">
        <div className="auth-card auth-card-single">
          <div className="auth-form-panel auth-form-panel-full">
            <div className="auth-form-inner">
              <div className="auth-brand-logo auth-brand-logo-center">
                <div className="auth-logo-box">
                  <MedicoreLogo size={32} />
                </div>
                <h1>Medicore HMS</h1>
              </div>
              <h2 className="auth-title">Forgot Password?</h2>
              <p className="auth-subtitle">
                Enter the email linked to your account and we'll send you a reset code.
              </p>

              <form onSubmit={submit} noValidate>
                <Field label="Email Address">
                  <div className="auth-input-wrap">
                    <Mail size={18} className="auth-input-icon" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@hospital.com"
                      required
                      className="auth-input"
                    />
                  </div>
                </Field>

                {error && <div className="auth-error">{error}</div>}

                <Button type="submit" size="lg" block loading={busy}>
                  Send Reset Code
                </Button>
              </form>

              <p className="auth-foot">
                <Link to="/login" className="auth-link">
                  <ArrowLeft size={14} /> Back to login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
