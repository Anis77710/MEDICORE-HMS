import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck, User, KeyRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Card, PageHeader, Avatar, Button } from '../../components/ui'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { push } = useToast()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

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
      <PageHeader title="Settings" subtitle="Manage your account settings." />

      <div className="grid-2">
        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Account
          </h3>
          <div className="flex gap-3 align-center" style={{ gap: 12 }}>
            <Avatar name={user?.name ?? ''} size="lg" />
            <div>
              <strong>{user?.name ?? '—'}</strong>
              <div className="muted text-sm">{user?.email ?? '—'}</div>
              <div className="muted text-xs">Role: {user?.role ?? '—'}</div>
            </div>
          </div>
          <div className="dp-kv mt-4">
            <div>
              <span>Name</span>
              <strong>{user?.name ?? '—'}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{user?.email ?? '—'}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{user?.role ?? '—'}</strong>
            </div>
          </div>
        </Card>

        <div className="flex-column gap-4" style={{ gap: 16 }}>
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
      </div>
    </>
  )
}
