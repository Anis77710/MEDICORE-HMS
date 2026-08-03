import { useEffect, useState } from 'react'
import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { listStaff, deleteStaff } from '../../api/services/misc'
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
                    <td>${m.salary.toLocaleString()}/yr</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>
                      <div className="cell-actions">
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
            if (saved) push(editing ? 'Staff member updated' : 'Staff member added')
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
    </>
  )
}
