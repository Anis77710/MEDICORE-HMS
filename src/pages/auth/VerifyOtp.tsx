import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, ShieldCheck } from 'lucide-react'
import * as authApi from '../../api/services/auth'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui'

const OTP_LENGTH = 6

export default function VerifyOtp() {
  const { push } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const email = (location.state as { email?: string } | null)?.email ?? ''

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'verify' | 'reset'>('verify')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const setDigit = (i: number, v: string) => {
    const digit = v.replace(/\D/g, '').slice(-1)
    setOtp((prev) => {
      const next = [...prev]
      next[i] = digit
      return next
    })
    if (digit && i < OTP_LENGTH - 1) inputsRef.current[i + 1]?.focus()
  }

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputsRef.current[i - 1]?.focus()
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const code = otp.join('')
      const res = await authApi.verifyOtp(email, code)
      if (!res.valid) {
        setError('Invalid code. Please check and try again.')
        return
      }
      setStep('reset')
      push('Code verified — set your new password', 'info')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  const reset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      await authApi.resetPassword(email, otp.join(''), password)
      push('Password updated — you can now log in')
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
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
                  <Activity size={26} strokeWidth={2.4} />
                </div>
                <h1>HealSync</h1>
              </div>

              {step === 'verify' ? (
                <>
                  <h2 className="auth-title">Verify Your Identity</h2>
                  <p className="auth-subtitle">
                    We sent a 6-digit code to <strong>{email || 'your email'}</strong>
                  </p>

                  <form onSubmit={verify}>
                    <div className="otp-row">
                      {otp.map((d, i) => (
                        <input
                          key={i}
                          ref={(el) => {
                            inputsRef.current[i] = el
                          }}
                          className="otp-input"
                          value={d}
                          onChange={(e) => setDigit(i, e.target.value)}
                          onKeyDown={(e) => onKey(i, e)}
                          inputMode="numeric"
                          maxLength={2}
                          aria-label={`Digit ${i + 1}`}
                        />
                      ))}
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <Button type="submit" size="lg" block loading={busy} className="mt-4">
                      Verify Code
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="auth-title">Set New Password</h2>
                  <p className="auth-subtitle">Choose a strong password for your account.</p>

                  <form onSubmit={reset}>
                    <div className="field">
                      <label className="field-label">New Password</label>
                      <input
                        className="input"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field-label">Confirm Password</label>
                      <input
                        className="input"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat password"
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <Button type="submit" size="lg" block loading={busy} className="mt-2">
                      <ShieldCheck size={17} /> Reset Password
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
