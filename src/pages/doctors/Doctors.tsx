import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Star, Stethoscope, Plus, Hourglass, Users, ArrowRight } from 'lucide-react'
import { listDoctors, deleteDoctor, getDoctorMetrics } from '../../api/services/doctors'
import type { Doctor, DoctorMetrics } from '../../types'
import {
  PageHeader,
  Card,
  Button,
  SearchInput,
  Avatar,
  StatusBadge,
  Badge,
  Spinner,
  EmptyState,
  ConfirmDialog,
  Modal,
} from '../../components/ui'
import { DoctorForm } from './DoctorForm'
import { useToast } from '../../context/ToastContext'
import { usePermissions } from '../../rbac/usePermissions'

const DEPT_FILTERS = [
  'All',
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'General Medicine',
  'Orthopedics',
  'Dermatology',
  'Oncology',
  'Gynecology',
] as const

export default function Doctors() {
  const { push } = useToast()
  const { can } = usePermissions()
  const [items, setItems] = useState<Doctor[]>([])
  const [metrics, setMetrics] = useState<Record<string, DoctorMetrics>>({})
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState<string>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Doctor | null>(null)
  const [deleting, setDeleting] = useState<Doctor | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      listDoctors({ search: search || undefined, department: dept }),
      getDoctorMetrics(),
    ])
      .then(([doctors, m]) => {
        if (cancelled) return
        setItems(doctors)
        setMetrics(m)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load doctors')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, dept, refreshKey])

  const deptCounts = useMemo(() => {
    const map: Record<string, number> = { All: items.length }
    for (const d of items) map[d.department] = (map[d.department] ?? 0) + 1
    return map
  }, [items])

  const activeCount = items.filter((d) => d.status === 'Active').length
  const disabledAccounts = items.filter((d) => d.account?.status === 'Disabled').length
  const attention = items
    .filter((d) => (metrics[d.id]?.pendingAppointments ?? 0) > 0)
    .sort((a, b) => (metrics[b.id]?.pendingAppointments ?? 0) - (metrics[a.id]?.pendingAppointments ?? 0))

  return (
    <>
      <PageHeader
        title="Doctors"
        subtitle={`${items.length} physicians · ${activeCount} active · ${disabledAccounts} disabled login${disabledAccounts === 1 ? '' : 's'}`}
        actions={
          can('doctors', 'create') ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add Doctor
            </Button>
          ) : undefined
        }
      />

      {attention.length > 0 && (
        <Card className="mb-4">
          <div className="card-header">
            <div>
              <h3 className="card-title">Doctors needing attention</h3>
              <p className="card-subtitle">
                Pending appointment confirmations — oldest first. Open a doctor to action or reassign.
              </p>
            </div>
            <Link to="/appointments?status=Pending" className="text-sm font-semibold">
              All pending <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
            </Link>
          </div>
          <div className="attention-list">
            {attention.map((d) => (
              <div key={d.id} className="attention-item">
                <Avatar name={d.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <Link to={`/doctors/${d.id}`} className="font-semibold">
                    {d.name}
                  </Link>
                  <div className="muted text-xs">
                    {metrics[d.id]?.pendingAppointments} pending
                    {metrics[d.id]?.pendingOldest ? ` · oldest ${metrics[d.id]!.pendingOldest}` : ''}
                  </div>
                </div>
                <Link to={`/doctors/${d.id}`} className="btn btn-outline btn-sm">
                  Review
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name or specialty…"
            />
          </div>
          <div className="chips">
            {DEPT_FILTERS.map((f) => (
              <button
                key={f}
                className={`chip ${dept === f ? 'chip-active' : ''}`}
                onClick={() => setDept(f)}
              >
                {f}
                {f !== 'All' && <span className="chip-count">{deptCounts[f] ?? 0}</span>}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading doctors…" />
        ) : error ? (
          <div className="empty-state">
            <span>{error}</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No doctors found" />
        ) : (
          <div className="doctor-grid">
            {items.map((d) => {
              const m = metrics[d.id]
              return (
                <Card key={d.id} className="doctor-card">
                  <div className="doctor-card-top">
                    <Avatar name={d.name} size="lg" />
                    <div className="flex-1 min-w-0">
                      <Link to={`/doctors/${d.id}`} className="doctor-card-name">
                        {d.name}
                      </Link>
                      <div className="muted text-sm">{d.specialty}</div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="doctor-card-details">
                    <span>
                      <Stethoscope size={14} /> {d.department}
                    </span>
                    <span>
                      <Star size={14} style={{ color: '#f59e0b' }} /> {d.rating.toFixed(1)}
                    </span>
                    <span>{d.experienceYears} yrs exp</span>
                  </div>
                  <div className="doctor-card-metrics">
                    <div className="text-sm">
                      <span className="muted">Patients</span>
                      <strong>{m?.patientsCount ?? '—'}</strong>
                    </div>
                    <div className="text-sm">
                      <span className="muted">Today</span>
                      <strong>{m?.appointmentsToday ?? '—'}</strong>
                    </div>
                    <div className="text-sm">
                      <span className="muted">Pending</span>
                      <strong>{m?.pendingAppointments ?? '—'}</strong>
                    </div>
                    <div className="text-sm">
                      <span className="muted">Consults</span>
                      <strong>{m?.consultationsCount ?? '—'}</strong>
                    </div>
                  </div>
                  <div className="doctor-card-foot">
                    <div className="text-sm">
                      <span className="muted">Fee</span>{' '}
                      <strong>Rs. {d.consultationFee}</strong>
                    </div>
                    <div className="text-sm">
                      <span className="muted">Schedule</span>{' '}
                      <strong>{d.schedule.join(', ')}</strong>
                    </div>
                  </div>
                  <div className="doctor-card-account">
                    {d.account ? (
                      <Badge tone={d.account.status === 'Disabled' ? 'red' : 'green'}>
                        {d.account.status === 'Disabled' ? 'Login disabled' : 'Login active'}
                      </Badge>
                    ) : (
                      <Badge tone="gray">No account</Badge>
                    )}
                    {m && m.pendingAppointments > 0 && (
                      <span className="flex gap-1 items-center text-xs" style={{ color: 'var(--warning)' }}>
                        <Hourglass size={13} /> {m.pendingAppointments} awaiting confirmation
                      </span>
                    )}
                  </div>
                  <div className="doctor-card-actions">
                    <Link to={`/doctors/${d.id}`} className="btn btn-outline btn-sm">
                      <Users size={14} /> Manage
                    </Link>
                    {can('doctors', 'edit') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(d)
                          setFormOpen(true)
                        }}
                      >
                        <Pencil size={14} /> Edit
                      </Button>
                    )}
                    {can('doctors', 'delete') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => setDeleting(d)}
                      >
                        <Trash2 size={14} /> Remove
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        title={editing ? 'Edit Doctor' : 'Add New Doctor'}
        size="lg"
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      >
        <DoctorForm
          doctor={editing}
          onDone={(saved) => {
            setFormOpen(false)
            setEditing(null)
            setRefreshKey((k) => k + 1)
            if (saved)
              push(editing ? 'Doctor updated' : 'Doctor added — login credentials sent to their email')
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Remove Doctor"
        message={`Remove ${deleting?.name} from the hospital? Doctors with active appointments or assigned patients must be reassigned first.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await deleteDoctor(deleting.id)
            setDeleting(null)
            setRefreshKey((k) => k + 1)
            push('Doctor removed')
          } catch (err) {
            push(err instanceof Error ? err.message : 'Doctor removal failed', 'error')
            setDeleting(null)
          }
        }}
      />
    </>
  )
}
