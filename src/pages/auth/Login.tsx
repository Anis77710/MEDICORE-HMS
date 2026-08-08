import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Eye, EyeOff, Mail, Lock, ShieldCheck, KeyRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Field, Input, Button } from '../../components/ui'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'

export default function Login() {
  const { login } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password, remember)
      push('Welcome back to Medicore HMS')
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
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
              <h2>Smart Hospital Management</h2>
              <p>
                Streamlining healthcare excellence through intuitive data management and
                patient-first administration.
              </p>
            </div>
            <div className="auth-brand-foot">
              <span>
                <ShieldCheck size={15} /> HIPAA Compliant
              </span>
              <span>
                <KeyRound size={15} /> 256-bit Secure
              </span>
            </div>
          </div>

          <div className="auth-form-panel">
            <div className="auth-form-inner">
              <h2 className="auth-title">Welcome Back</h2>
              <p className="auth-subtitle">Please enter your details to access the dashboard.</p>

              <form onSubmit={submit} noValidate>
                <Field label="Email Address">
                  <div className="auth-input-wrap">
                    <Mail size={18} className="auth-input-icon" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@hospital.com"
                      autoComplete="email"
                      required
                      className="auth-input"
                      data-testid="login-email"
                    />
                  </div>
                </Field>

                <Field label="Password">
                  <div className="auth-input-wrap">
                    <Lock size={18} className="auth-input-icon" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="auth-input"
                      data-testid="login-password"
                    />
                    <button
                      type="button"
                      className="auth-eye"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </Field>

                <div className="auth-row">
                  <label className="auth-check">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      data-testid="login-remember"
                    />
                    <span>Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="auth-link">
                    Forgot password?
                  </Link>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <Button type="submit" size="lg" block loading={busy} data-testid="login-submit">
                  Log In
                </Button>
              </form>

              <div className="auth-separator">
                <span>Or sign in with</span>
              </div>

              <div className="auth-social">
                <button type="button" className="auth-social-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.97 10.97 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
                  </svg>
                  Google
                </button>
                <button type="button" className="auth-social-btn">
                  <svg width="18" height="18" viewBox="0 0 23 23" fill="#00A4EF">
                    <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" transform="scale(.95833)" />
                  </svg>
                  Microsoft
                </button>
              </div>

              <p className="auth-foot">
                Don't have an account?{' '}
                <Link to="/register" className="auth-link-strong">
                  Sign up for a demo
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
