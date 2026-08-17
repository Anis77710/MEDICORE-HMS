import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Lock } from 'lucide-react'
import * as authApi from '../../api/services/auth'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Field, Input, Button } from '../../components/ui'
import { MedicoreLogo } from '../../components/ui/MedicoreLogo'

const REQUIREMENTS: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 12, label: 'At least 12 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p) => /[a-z]/.test(p), label: 'One lowercase letter' },
  { test: (p) => /\d/.test(p), label: 'One number' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'One special character' },
]

export default function ChangePassword() {
  const { user, logout, updateUser } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next !== confirm) {
      setError('New passwords do not match')
      return
    }
    setBusy(true)
    try {
      const res = await authApi.changePassword(current, next)
      updateUser(res.user)
      push('Your password has been updated successfully.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
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

              <div className="auth-key-icon">
                <KeyRound size={26} />
              </div>
              <h2 className="auth-title">Set a Permanent Password</h2>
              <p className="auth-subtitle">
                {user ? `Welcome, ${user.name}. ` : ''}You are using a temporary password provided
                by your administrator. Choose a permanent password to access the dashboard.
              </p>

              <form onSubmit={submit} noValidate>
                <Field label="Current Password">
                  <div className="auth-input-wrap">
                    <Lock size={18} className="auth-input-icon" />
                    <Input
                      type={show ? 'text' : 'password'}
                      value={current}
                      onChange={(e) => setCurrent(e.target.value)}
                      placeholder="Temporary password from your email"
                      autoComplete="current-password"
                      required
                      className="auth-input"
                      data-testid="change-current-password"
                    />
                  </div>
                </Field>

                <Field label="New Password" hint="Minimum 12 characters with letters, numbers and symbols">
                  <div className="auth-input-wrap">
                    <Lock size={18} className="auth-input-icon" />
                    <Input
                      type={show ? 'text' : 'password'}
                      value={next}
                      onChange={(e) => setNext(e.target.value)}
                      placeholder="Enter a new strong password"
                      autoComplete="new-password"
                      required
                      className="auth-input"
                      data-testid="change-new-password"
                    />
                  </div>
                </Field>

                <Field label="Confirm New Password">
                  <div className="auth-input-wrap">
                    <Lock size={18} className="auth-input-icon" />
                    <Input
                      type={show ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter the new password"
                      autoComplete="new-password"
                      required
                      className="auth-input"
                      data-testid="change-confirm-password"
                    />
                  </div>
                </Field>

                <div className="auth-check">
                  <input
                    type="checkbox"
                    id="show-pass"
                    className="checkbox"
                    checked={show}
                    onChange={(e) => setShow(e.target.checked)}
                  />
                  <label htmlFor="show-pass">Show passwords</label>
                </div>

                <ul className="password-checks">
                  {REQUIREMENTS.map((r) => {
                    const met = next ? r.test(next) : false
                    return (
                      <li key={r.label} className={met ? 'met' : ''}>
                        <span aria-hidden>{met ? '✓' : '•'}</span>
                        {r.label}
                      </li>
                    )
                  })}
                </ul>

                {error && <div className="auth-error">{error}</div>}

                <Button
                  type="submit"
                  size="lg"
                  block
                  loading={busy}
                  disabled={!current || !next || !confirm}
                  data-testid="change-password-submit"
                >
                  Update Password
                </Button>
              </form>

              <p className="auth-foot">
                <button type="button" className="auth-link-strong" onClick={logout}>
                  Sign out
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}