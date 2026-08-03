import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Pencil, Trash2, UserPlus } from 'lucide-react'
import { listPatients, deletePatient } from '../../api/services/patients'
import type { Patient } from '../../types'
import {
  PageHeader,
  Card,
  Button,
  SearchInput,
  Avatar,
  StatusBadge,
  Pagination,
  Spinner,
  EmptyState,
  ConfirmDialog,
  Modal,
} from '../../components/ui'
import { PatientForm } from './PatientForm'
import { useToast } from '../../context/ToastContext'
import { usePermissions } from '../../rbac/usePermissions'

const FILTERS = ['All', 'Admitted', 'Outpatient', 'Critical', 'Recovered', 'Pending'] as const

// Stable reference for age calculation (module level = stable across renders)
const REFERENCE_TIME = Date.now()

export default function Patients() {
  const navigate = useNavigate()
  const { push } = useToast()
  const { can } = usePermissions()
  const [items, setItems] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Patient | null>(null)
  const [deleting, setDeleting] = useState<Patient | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listPatients({ search: search || undefined, status: filter, page, limit })
      .then((res) => {
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load patients')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, filter, page, limit, refreshKey])

  const filteredCounts = useMemo(() => {
    return { All: total }
  }, [total])

  const counts = useMemo(() => {
    const all = ['Admitted', 'Outpatient', 'Critical', 'Recovered', 'Pending']
    const map: Record<string, number> = { All: total }
    for (const s of all) {
      map[s] = 0
    }
    for (const p of items) map[p.status] = (map[p.status] ?? 0) + 1
    return map
  }, [items, total])

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle={`${filteredCounts.All.toLocaleString()} registered patients`}
        actions={
          can('patients', 'create') ? (
            <Button onClick={() => setFormOpen(true)}>
              <UserPlus size={16} /> Add Patient
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
              placeholder="Search by name, ID or email…"
            />
          </div>
          <div className="chips">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`chip ${filter === f ? 'chip-active' : ''}`}
                onClick={() => {
                  setFilter(f)
                  setPage(1)
                }}
              >
                {f}
                {f !== 'All' && <span className="chip-count">{counts[f]}</span>}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading patients…" />
        ) : error ? (
          <div className="empty-state">
            <span>{error}</span>
            <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
              Retry
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No patients found" hint="Try adjusting your search or filters." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Age / Gender</th>
                  <th>Department</th>
                  <th>Assigned Doctor</th>
                  <th>Status</th>
                  <th>Last Visit</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const age = Math.floor(
                    (REFERENCE_TIME - new Date(p.dob).getTime()) / (365.25 * 24 * 3600 * 1000),
                  )
                  return (
                    <tr
                      key={p.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <td>
                        <div className="cell-person">
                          <Avatar name={`${p.firstName} ${p.lastName}`} size="md" />
                          <div className="cell-person-main">
                            <strong>
                              {p.firstName} {p.lastName}
                            </strong>
                            <span className="muted text-xs">{p.patientId}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {age} · {p.gender}
                        <div className="muted text-xs">{p.bloodGroup}</div>
                      </td>
                      <td>{p.department}</td>
                      <td className="muted">
                        {p.assignedDoctorId
                          ? `Dr. ${p.assignedDoctorId.replace('d-', '')}`
                          : '—'}
                      </td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="muted">{p.lastVisit}</td>
                      <td>
                        <div className="cell-actions" onClick={(e) => e.stopPropagation()}>
                          <Link
                            to={`/patients/${p.id}`}
                            className="icon-btn"
                            title="View patient"
                          >
                            <Eye size={16} />
                          </Link>
                          {can('patients', 'edit') && (
                            <button
                              className="icon-btn"
                              title="Edit patient"
                              onClick={() => {
                                setEditing(p)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {can('patients', 'delete') && (
                            <button
                              className="icon-btn icon-btn-danger"
                              title="Delete patient"
                              onClick={() => setDeleting(p)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} total={total} limit={limit} onChange={setPage} />
      </Card>

      <Modal
        open={formOpen}
        title={editing ? 'Edit Patient' : 'Add New Patient'}
        size="lg"
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      >
        <PatientForm
          patient={editing}
          onDone={(saved) => {
            setFormOpen(false)
            setEditing(null)
            setRefreshKey((k) => k + 1)
            push(saved ? `Patient ${editing ? 'updated' : 'registered'} successfully` : '')
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Patient"
        message={`Delete ${deleting?.firstName} ${deleting?.lastName} (${deleting?.patientId})? This action cannot be undone.`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deletePatient(deleting.id)
          setDeleting(null)
          setRefreshKey((k) => k + 1)
          push('Patient deleted')
        }}
      />
    </>
  )
}
