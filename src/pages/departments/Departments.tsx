import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { listDepartments } from '../../api/services/departments'
import type { Department } from '../../types'
import { PageHeader, Card, Avatar, Spinner, EmptyState, Badge } from '../../components/ui'

export default function Departments() {
  const [items, setItems] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listDepartments()
      .then((res) => {
        if (!cancelled) setItems(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load departments')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const totalBeds = items.reduce((s, d) => s + d.bedCount, 0)
  const totalOccupied = items.reduce((s, d) => s + d.occupiedBeds, 0)

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle={`${items.length} departments · ${totalOccupied}/${totalBeds} beds occupied`}
      />

      {loading ? (
        <Spinner label="Loading departments…" />
      ) : error ? (
        <div className="empty-state">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No departments" />
      ) : (
        <div className="dept-cards">
          {items.map((d) => {
            const pct = Math.round((d.occupiedBeds / d.bedCount) * 100)
            return (
              <Card key={d.id} padded className="dept-card">
                <div className="dept-card-head">
                  <div className="dept-icon" style={{ background: `${d.color}18`, color: d.color }}>
                    <Building2 size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="dept-name">{d.name}</h3>
                    <p className="muted text-sm">{d.description}</p>
                  </div>
                  <Badge tone={pct >= 90 ? 'red' : pct >= 75 ? 'amber' : 'teal'}>
                    {pct}% full
                  </Badge>
                </div>

                <div className="dept-stats">
                  <div>
                    <strong>{d.bedCount}</strong>
                    <span>Beds</span>
                  </div>
                  <div>
                    <strong>{d.occupiedBeds}</strong>
                    <span>Occupied</span>
                  </div>
                  <div>
                    <strong>{d.doctorsCount}</strong>
                    <span>Doctors</span>
                  </div>
                  <div>
                    <strong>{d.patientsCount}</strong>
                    <span>Patients</span>
                  </div>
                </div>

                <div className="progress mt-2">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: d.color }} />
                </div>

                <div className="dept-head mt-4">
                  <Avatar name={d.headDoctorName} size="sm" />
                  <div>
                    <strong className="text-sm">{d.headDoctorName}</strong>
                    <div className="muted text-xs">Department Head</div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
