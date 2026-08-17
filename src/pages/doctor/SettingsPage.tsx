import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck, User, KeyRound, CalendarOff, CalendarCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Card, PageHeader, Avatar, Button } from '../../components/ui'
import { getDoctorProfile, setMyStatus } from '../../api/services/doctorPortal'
import type { Doctor } from '../../types'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [doctor, setDoctor] = useState<Doctor | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getDoctorProfile()
      .then((d) => {
        if (!cancelled) setDoctor(d)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const onLeave = doctor?.status === 'On Leave'

  async function toggleStatus() {
    if (!doctor || statusBusy) return
    setStatusBusy(true)
    try {
      const next = onLeave ? 'Active' : 'On Leave'
      const updated = await setMyStatus(next)
      setDoctor(updated)
      push(
        next === 'On Leave'
          ? 'You are now marked On Leave. Clinical actions are paused until you return.'
          : 'Welcome back - you are marked Active.',
        next === 'On Leave' ? 'info' : undefined,
      )
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not update your status', 'error')
    } finally {
      setStatusBusy(false)
    }
  }

  async function onLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login')
    } catch {
      push('Failed to log out', 'error')
      setLoggingOut(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your account and availability." />

      <div className="grid-2">
        <div className="flex-column gap-4" style={{ gap: 16 }}>
          <Card padded>
            <h3 className="card-title" style={{ marginTop: 0 }}>
              Availability
            </h3>
            <p className="card-subtitle mb-2" style={{ marginBottom: 14 }}>
              Mark yourself On Leave to pause confirmations, consultations and prescriptions. Patients
              will see you as unavailable for new bookings.
            </p>
            <div className="dp-kv mt-2">
              <div>
                <span>Current status</span>
                <strong>{doctor?.status ?? 'Loading…'}</strong>
              </div>
            </div>
            <div className="flex gap-2 mt-3" style={{ marginTop: 14 }}>
              <Button
                variant={onLeave ? 'primary' : 'outline'}
                loading={statusBusy}
                onClick={() => void toggleStatus()}
                disabled={!doctor}
                data-testid="doctor-set-active"
              >
                <CalendarCheck size={16} /> Mark Active
              </Button>
              <Button
                variant={onLeave ? 'outline' : 'danger'}
                loading={statusBusy}
                onClick={() => void toggleStatus()}
                disabled={!doctor}
                data-testid="doctor-set-leave"
              >
                <CalendarOff size={16} /> {onLeave ? 'Marked On Leave' : 'Mark On Leave'}
              </Button>
            </div>
          </Card>

          <Card padded>
            <h3 className="card-title" style={{ marginTop: 0 }}>
              <ShieldCheck size={16} style={{ verticalAlign: 'middle' }} /> Security
            </h3>
            <p className="card-subtitle mb-2" style={{ marginBottom: 14 }}>
              Password resets are handled by hospital administration.
            </p>
            <Link to="/forgot-password" className="btn btn-outline btn-block">
              <KeyRound size={16} /> Forgot Password
            </Link>
          </Card>

          <Card padded>
            <h3 className="card-title" style={{ marginTop: 0 }}>
              <User size={16} style={{ verticalAlign: 'middle' }} /> Session
            </h3>
            <p className="card-subtitle mb-2" style={{ marginBottom: 14 }}>
              Sign out of the Doctor Portal on this device.
            </p>
            <Button variant="danger" block loading={loggingOut} onClick={() => void onLogout()}>
              <LogOut size={16} /> Log Out
            </Button>
          </Card>
        </div>

        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Account
          </h3>
          <div className="flex gap-3 align-center" style={{ gap: 12 }}>
            <Avatar name={user?.name ?? ''} size="lg" />
            <div>
              <strong>{user?.name ?? '-'}</strong>
              <div className="muted text-sm">{user?.email ?? '-'}</div>
              <div className="muted text-xs">Role: {user?.role ?? '-'}</div>
            </div>
          </div>
          <div className="dp-kv mt-4">
            <div>
              <span>Name</span>
              <strong>{user?.name ?? '-'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{user?.email ?? '-'}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{user?.role ?? '-'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{doctor?.status ?? '-'}</strong>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
