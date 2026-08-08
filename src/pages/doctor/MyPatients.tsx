import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Stethoscope } from 'lucide-react'
import { getMyPatients } from '../../api/services/doctorPortal'
import type { Patient, PatientStatus } from '../../types'
import { Card, Spinner, EmptyState, StatusBadge, PageHeader, Avatar } from '../../components/ui'
import { ageFromDob, fmtDate } from './utils'

const STATUSES: PatientStatus[] = ['Admitted', 'Outpatient', 'Critical', 'Recovered', 'Pending']

export default function MyPatients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  useEffect(() => {
    let cancelled = false
    getMyPatients()
      .then((list) => {
        if (!cancelled) setPatients(list)
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
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return patients
      .filter((p) => statusFilter === 'All' || p.status === statusFilter)
      .filter(
        (p) =>
          !q ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.patientId.toLowerCase().includes(q),
      )
      .sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
  }, [patients, query, statusFilter])

  if (loading) return <Spinner label="Loading your patients…" />
  if (error) return <div className="auth-error">{error}</div>

  return (
    <>
      <PageHeader
        title="My Patients"
        subtitle="Patients assigned to you or seen in your consultations."
        actions={
          <Link to="/doctor/appointments?view=today" className="btn btn-outline">
            <Stethoscope size={16} /> View Appointments
          </Link>
        }
      />

      <div className="table-toolbar mb-3">
        <div className="table-toolbar-left" style={{ gap: 8 }}>
          <div className="search-box" style={{ width: 280 }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by name or patient ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search patients"
            />
          </div>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <span className="muted text-sm">{filtered.length} patients</span>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={patients.length === 0 ? 'No patients yet' : 'No patients match your search'}
            hint={
              patients.length === 0
                ? 'Patients appear here once you complete a consultation or are assigned to them.'
                : 'Try a different search or status filter.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Age / Gender</th>
                  <th>Blood Group</th>
                  <th>Last Visit</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td className="muted font-mono">{p.patientId}</td>
                    <td>
                      <div className="cell-person">
                        <Avatar name={`${p.firstName} ${p.lastName}`} size="sm" />
                        <strong>
                          {p.firstName} {p.lastName}
                        </strong>
                      </div>
                    </td>
                    <td className="muted">
                      {ageFromDob(p.dob)} yrs · {p.gender}
                    </td>
                    <td className="muted">{p.bloodGroup || '—'}</td>
                    <td className="muted">{p.lastVisit ? fmtDate(p.lastVisit) : 'Never'}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/doctor/patients/${p.id}`} className="btn btn-outline btn-sm">
                        Open Record
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
