import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building, Eye, EyeOff, Globe, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useMasterAuth } from '../../context/MasterAuthContext'
import { useToast } from '../../context/ToastContext'
import { Field, Input, Button } from '../../components/ui'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'

export default function MasterLogin() {
  const { login } = useMasterAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      push('Welcome to the Medicore platform')
      navigate('/master')
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
              <Building size={140} strokeWidth={1} />
            </div>
            <div className="auth-brand-content">
              <Link to="/" className="auth-brand-logo">
                <div className="auth-logo-box">
                  <MedicoreLogo size={32} />
                </div>
                <h1>Medicore HMS</h1>
              </Link>
              <h2>Platform Administrator</h2>
              <p>
                Manage every hospital on the platform — review and approve paid registration
                requests, suspend or activate hospitals, control the public directory and
                platform settings.
              </p>
            </div>
            <div className="auth-brand-foot">
              <span>
                <Globe size={15} /> All hospitals
              </span>
              <span>
                <ShieldCheck size={15} /> Master access
              </span>
            </div>
          </div>

          <div className="auth-form-panel">
            <div className="auth-form-inner">
              <h2 className="auth-title">Master Admin Login</h2>
              <p className="auth-subtitle">Sign in with your platform administrator credentials.</p>

              <form onSubmit={submit} noValidate>
                <Field label="Admin Email">
                  <div className="auth-input-wrap">
                    <Mail size={18} className="auth-input-icon" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@medicore.health"
                      autoComplete="username"
                      required
                      className="auth-input"
                      data-testid="master-login-email"
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
                      data-testid="master-login-password"
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

                {error && <div className="auth-error">{error}</div>}

                <Button type="submit" size="lg" block loading={busy} data-testid="master-login-submit">
                  Log In to Platform
                </Button>
              </form>

              <p className="auth-foot">
                Hospital staff?{' '}
                <Link to="/login" className="auth-link-strong">
                  Sign in to your hospital
                </Link>
              </p>
              <p className="auth-foot">
                Registering a hospital?{' '}
                <Link to="/register" className="auth-link-strong">
                  Register your hospital
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
