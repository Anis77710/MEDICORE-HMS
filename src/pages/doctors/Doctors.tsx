import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, Star, Stethoscope, Plus } from 'lucide-react'
import { listDoctors, deleteDoctor } from '../../api/services/doctors'
import type { Doctor } from '../../types'
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
    listDoctors({ search: search || undefined, department: dept })
      .then((res) => {
        if (!cancelled) setItems(res)
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

  return (
    <>
      <PageHeader
        title="Doctors"
        subtitle={`${items.length} physicians · ${activeCount} active`}
        actions={
          can('doctors', 'create') ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Add Doctor
            </Button>
          ) : undefined
        }
      />

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
            {items.map((d) => (
              <Card key={d.id} className="doctor-card">
                <div className="doctor-card-top">
                  <Avatar name={d.name} size="lg" />
                  <div className="flex-1 min-w-0">
                    <strong className="doctor-card-name">{d.name}</strong>
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
                <div className="doctor-card-foot">
                  <div className="text-sm">
                    <span className="muted">Fee</span>{' '}
                    <strong>${d.consultationFee}</strong>
                  </div>
                  <div className="text-sm">
                    <span className="muted">Patients</span>{' '}
                    <strong>{d.patientsCount}</strong>
                  </div>
                  <div className="text-sm">
                    <span className="muted">Schedule</span>{' '}
                    <strong>{d.schedule.join(', ')}</strong>
                  </div>
                </div>
                <div className="doctor-card-actions">
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
            ))}
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
            if (saved) push(editing ? 'Doctor updated' : 'Doctor added')
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Remove Doctor"
        message={`Remove ${deleting?.name} from the hospital? Their patients will need reassignment.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deleteDoctor(deleting.id)
          setDeleting(null)
          setRefreshKey((k) => k + 1)
          push('Doctor removed')
        }}
      />
    </>
  )
}
