import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { listMyPrescriptions } from '../../api/services/doctorPortal'
import type { Prescription } from '../../types'
import { Card, Spinner, EmptyState, StatusBadge, PageHeader, Avatar } from '../../components/ui'
import { fmtDate } from './utils'

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    listMyPrescriptions()
      .then((list) => {
        if (!cancelled) setPrescriptions(list)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load prescriptions')
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
    return [...prescriptions]
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
      .filter(
        (rx) =>
          !q ||
          rx.id.toLowerCase().includes(q) ||
          rx.patientName.toLowerCase().includes(q) ||
          rx.medicines.some((m) => m.name.toLowerCase().includes(q)),
      )
  }, [prescriptions, query])

  if (loading) return <Spinner label="Loading prescriptions…" />
  if (error) return <div className="auth-error">{error}</div>

  return (
    <>
      <PageHeader
        title="Prescriptions"
        subtitle="Prescriptions issued by you across your consultations."
      />

      <div className="table-toolbar mb-3">
        <div className="table-toolbar-left" style={{ gap: 8 }}>
          <div className="search-box" style={{ width: 280 }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by prescription, patient or medicine…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search prescriptions"
            />
          </div>
        </div>
        <span className="muted text-sm">{filtered.length} prescriptions</span>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title="No prescriptions yet"
            hint="Prescriptions you save in a consultation will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Prescription</th>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Medicines</th>
                  <th>Appointment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rx) => (
                  <tr key={rx.id}>
                    <td className="muted font-mono">{rx.prescriptionNo ?? rx.id}</td>
                    <td className="muted">{fmtDate(rx.issuedAt)}</td>
                    <td>
                      <div className="cell-person">
                        <Avatar name={rx.patientName} size="sm" />
                        <strong>{rx.patientName}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="flex-column gap-1" style={{ gap: 2 }}>
                        {rx.medicines.map((m) => (
                          <span key={`${rx.id}-${m.name}`} className="text-sm">
                            <strong>{m.name}</strong>{' '}
                            <span className="muted">
                              - {m.dosage} · {m.frequency} · {m.durationDays} day(s)
                            </span>
                            {m.instructions && (
                              <span className="muted"> · {m.instructions}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="muted font-mono">{rx.appointmentId ?? '-'}</td>
                    <td>
                      <StatusBadge status={rx.status} />
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
