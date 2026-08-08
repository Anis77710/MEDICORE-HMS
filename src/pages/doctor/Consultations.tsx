import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { listConsultations } from '../../api/services/doctorPortal'
import type { Consultation } from '../../types'
import { Card, Spinner, EmptyState, PageHeader, Avatar } from '../../components/ui'
import { fmtDate } from './utils'

export default function Consultations() {
  const [params] = useSearchParams()
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    listConsultations()
      .then((list) => {
        if (!cancelled) setConsultations(list)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load consultations')
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
    return [...consultations]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter(
        (c) =>
          !q ||
          c.id.toLowerCase().includes(q) ||
          c.patientName.toLowerCase().includes(q) ||
          c.chiefComplaint.toLowerCase().includes(q) ||
          c.diagnosis.primary.toLowerCase().includes(q),
      )
  }, [consultations, query])

  const patientIdParam = params.get('patientId')

  if (loading) return <Spinner label="Loading consultations…" />
  if (error) return <div className="auth-error">{error}</div>

  return (
    <>
      <PageHeader
        title="Consultations"
        subtitle="Your completed and in-progress consultation records."
        actions={
          <Link to="/doctor/appointments?view=today" className="btn btn-primary">
            <Plus size={16} /> New Consultation
          </Link>
        }
      />

      <div className="table-toolbar mb-3">
        <div className="table-toolbar-left" style={{ gap: 8 }}>
          <div className="search-box" style={{ width: 280 }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Search by patient, complaint or diagnosis…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search consultations"
            />
          </div>
        </div>
        <span className="muted text-sm">{filtered.length} consultations</span>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title="No consultations yet"
            hint="Complete a consultation from your appointments to record it here."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Consultation</th>
                  <th>Date</th>
                  <th>Patient</th>
                  <th>Chief Complaint</th>
                  <th>Primary Diagnosis</th>
                  <th>Prescription</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="muted font-mono">{c.consultationNo ?? c.id}</td>
                    <td className="muted">{fmtDate(c.createdAt)}</td>
                    <td>
                      <div className="cell-person">
                        <Avatar name={c.patientName} size="sm" />
                        <strong>{c.patientName}</strong>
                      </div>
                    </td>
                    <td className="muted">{c.chiefComplaint}</td>
                    <td className="font-semibold">{c.diagnosis.primary}</td>
                    <td className="muted font-mono">{c.prescriptionNo ?? c.prescriptionId ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/doctor/consultations/${c.id}`} className="btn btn-outline btn-sm">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {patientIdParam && (
        <p className="muted text-sm mt-3">
          Tip: use the patient record page to start a consultation for a specific patient.
        </p>
      )}
    </>
  )
}
