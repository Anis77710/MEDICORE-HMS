import { useEffect, useState } from 'react'
import { KeyRound, Pencil, Trash2, UserPlus } from 'lucide-react'
import {
  listStaff,
  deleteStaff,
  resetStaffPassword,
  disableStaffLogin,
  enableStaffLogin,
} from '../../api/services/misc'
import type { StaffMember } from '../../types'
import {
  PageHeader,
  Card,
  Button,
  SearchInput,
  Avatar,
  StatusBadge,
  Spinner,
  EmptyState,
  ConfirmDialog,
  Modal,
  Badge,
} from '../../components/ui'
import { StaffForm } from './StaffForm'
import { useToast } from '../../context/ToastContext'

const ROLE_FILTERS = ['All', 'ADMIN', 'DOCTOR', 'NURSE', 'STAFF'] as const

const ROLE_TONE: Record<string, 'purple' | 'blue' | 'teal' | 'gray'> = {
  ADMIN: 'purple',
  DOCTOR: 'blue',
  NURSE: 'teal',
  STAFF: 'gray',
}

export default function Staff() {
  const { push } = useToast()
  const [items, setItems] = useState<StaffMember[]>([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<string>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [deleting, setDeleting] = useState<StaffMember | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [account, setAccount] = useState<StaffMember | null>(null)
  const [loginStatus, setLoginStatus] = useState<'Active' | 'Disabled' | null>(null)
  const [tempPassword, setTempPassword] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listStaff({ search: search || undefined, role })
      .then((res) => {
        if (!cancelled) setItems(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load staff')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, role, refreshKey])

  const openAccount = (m: StaffMember) => {
    setAccount(m)
    setLoginStatus(null)
    setTempPassword('')
  }

  const onReset = async () => {
    if (!account) return
    setAccountBusy(true)
    try {
      const res = await resetStaffPassword(account.id)
      setTempPassword(res.tempPassword ?? '')
      push('Temporary password sent to their email')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Reset failed', 'error')
    } finally {
      setAccountBusy(false)
    }
  }

  const onDisable = async () => {
    if (!account) return
    setAccountBusy(true)
    try {
      const res = await disableStaffLogin(account.id)
      setLoginStatus(res.status as 'Active' | 'Disabled')
      push('Login disabled - their sessions have been revoked')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Action failed', 'error')
    } finally {
      setAccountBusy(false)
    }
  }

  const onEnable = async () => {
    if (!account) return
    setAccountBusy(true)
    try {
      const res = await enableStaffLogin(account.id)
      setLoginStatus(res.status as 'Active' | 'Disabled')
      push('Login enabled')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Action failed', 'error')
    } finally {
      setAccountBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`${items.length} team members`}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <UserPlus size={16} /> Add Staff
          </Button>
        }
      />

      <Card>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" />
          </div>
          <div className="chips">
            {ROLE_FILTERS.map((r) => (
              <button
                key={r}
                className={`chip ${role === r ? 'chip-active' : ''}`}
                onClick={() => setRole(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading staff…" />
        ) : error ? (
          <div className="empty-state">{error}</div>
        ) : items.length === 0 ? (
          <EmptyState title="No staff members found" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Shift</th>
                  <th>Joined</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="cell-person">
                        <Avatar name={m.name} size="md" />
                        <div>
                          <strong className="text-sm">{m.name}</strong>
                          <div className="muted text-xs">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone={ROLE_TONE[m.role] ?? 'gray'}>{m.role}</Badge>
                    </td>
                    <td>{m.department}</td>
                    <td>{m.shift}</td>
                    <td className="muted">{m.joinedAt}</td>
                    <td>NPR {m.salary.toLocaleString()}/yr</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>
                      <div className="cell-actions">
                        {m.role !== 'PATIENT' && (
                          <button className="icon-btn" title="Manage account" onClick={() => openAccount(m)}>
                            <KeyRound size={16} />
                          </button>
                        )}
                        <button
                          className="icon-btn"
                          title="Edit"
                          onClick={() => {
                            setEditing(m)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn icon-btn-danger"
                          title="Remove"
                          onClick={() => setDeleting(m)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        title={editing ? 'Edit Staff Member' : 'Add Staff Member'}
        size="md"
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      >
        <StaffForm
          member={editing}
          onDone={(saved) => {
            setFormOpen(false)
            setEditing(null)
            setRefreshKey((k) => k + 1)
            if (saved)
              push(editing ? 'Staff member updated' : 'Staff member added - login credentials sent to their email')
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Remove Staff Member"
        message={`Remove ${deleting?.name} from the staff list?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deleteStaff(deleting.id)
          setDeleting(null)
          setRefreshKey((k) => k + 1)
          push('Staff member removed')
        }}
      />

      <Modal
        open={!!account}
        title="Manage Login Account"
        size="sm"
        onClose={() => setAccount(null)}
        footer={
          <>
            <Button
              variant="outline"
              loading={accountBusy}
              onClick={onReset}
            >
              Reset Password
            </Button>
            {loginStatus === 'Disabled' ? (
              <Button variant="primary" loading={accountBusy} onClick={onEnable}>
                Enable Login
              </Button>
            ) : (
              <Button variant="danger" loading={accountBusy} onClick={onDisable}>
                Disable Login
              </Button>
            )}
          </>
        }
      >
        {account && (
          <>
            <p className="confirm-message">
              {account.name} <span className="muted">({account.email})</span> signs in with their
              login username and password.
            </p>
            {loginStatus === 'Disabled' && (
              <p className="muted text-sm" style={{ marginTop: 8 }}>
                Login is currently disabled.
              </p>
            )}
            {tempPassword && (
              <div className="field" style={{ marginTop: 12 }}>
                <span className="field-label">Temporary password</span>
                <code className="credential-code">{tempPassword}</code>
                <span className="field-hint">
                  They must change it at their next sign-in. A copy has been emailed to them.
                </span>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  )
}
