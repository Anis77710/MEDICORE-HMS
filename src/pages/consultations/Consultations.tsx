import { useEffect, useMemo, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { listAllConsultations, getConsultationDetail } from '../../api/services/consultations'
import type { Consultation } from '../../types'
import {
  PageHeader,
  Card,
  Spinner,
  EmptyState,
  SearchInput,
  Avatar,
  Modal,
  Badge,
} from '../../components/ui'
import { listDoctors } from '../../api/services/doctors'

function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Detail({ c }: { c: Consultation }) {
  return (
    <div className="consult-detail-grid">
      <div>
        <h4 className="card-title mb-2" style={{ fontSize: 14 }}>Visit</h4>
        <div className="info-rows mb-3">
          <div className="info-row"><span className="muted">Patient</span><strong>{c.patientName}</strong></div>
          <div className="info-row"><span className="muted">Doctor</span><strong>{c.doctorName}</strong></div>
          <div className="info-row"><span className="muted">Date</span><strong>{fmtDate(c.createdAt)}</strong></div>
        </div>

        <h4 className="card-title mb-2" style={{ fontSize: 14 }}>Chief Complaint</h4>
        <p className="text-sm mb-3">{c.chiefComplaint}</p>
        {c.symptoms && (
          <>
            <h4 className="card-title mb-2" style={{ fontSize: 14 }}>Symptoms</h4>
            <p className="text-sm mb-3">{c.symptoms}</p>
          </>
        )}

        <h4 className="card-title mb-2" style={{ fontSize: 14 }}>Diagnosis</h4>
        <div className="info-rows mb-3">
          <div className="info-row"><span className="muted">Primary</span><strong>{c.diagnosis.primary}</strong></div>
          <div className="info-row"><span className="muted">Additional</span><strong>{c.diagnosis.additional || '—'}</strong></div>
          <div className="info-row"><span className="muted">Notes</span><strong>{c.diagnosis.notes || '—'}</strong></div>
        </div>

        <h4 className="card-title mb-2" style={{ fontSize: 14 }}>Vitals</h4>
        <div className="dp-vitals-grid">
          {c.vitals.bloodPressure && <div className="dp-vital"><span>BP</span><strong>{c.vitals.bloodPressure}</strong></div>}
          {c.vitals.heartRate != null && <div className="dp-vital"><span>HR</span><strong>{c.vitals.heartRate} bpm</strong></div>}
          {c.vitals.temperature != null && <div className="dp-vital"><span>Temp</span><strong>{c.vitals.temperature} °C</strong></div>}
          {c.vitals.spo2 != null && <div className="dp-vital"><span>SpO₂</span><strong>{c.vitals.spo2}%</strong></div>}
          {c.vitals.weightKg != null && <div className="dp-vital"><span>Weight</span><strong>{c.vitals.weightKg} kg</strong></div>}
          {c.vitals.heightCm != null && <div className="dp-vital"><span>Height</span><strong>{c.vitals.heightCm} cm</strong></div>}
        </div>
      </div>

      <div>
        <h4 className="card-title mb-2" style={{ fontSize: 14 }}>Examination</h4>
        <div className="info-rows mb-3">
          <div className="info-row"><span className="muted">General</span><strong>{c.examination.general || '—'}</strong></div>
          <div className="info-row"><span className="muted">Cardiovascular</span><strong>{c.examination.cardiovascular || '—'}</strong></div>
          <div className="info-row"><span className="muted">Respiratory</span><strong>{c.examination.respiratory || '—'}</strong></div>
          <div className="info-row"><span className="muted">Abdominal</span><strong>{c.examination.abdominal || '—'}</strong></div>
          <div className="info-row"><span className="muted">Neurological</span><strong>{c.examination.neurological || '—'}</strong></div>
        </div>

        <h4 className="card-title mb-2" style={{ fontSize: 14 }}>Treatment Plan</h4>
        <div className="info-rows mb-3">
          <div className="info-row"><span className="muted">Advice</span><strong>{c.treatmentPlan.advice || '—'}</strong></div>
          <div className="info-row"><span className="muted">Diet</span><strong>{c.treatmentPlan.diet || '—'}</strong></div>
          <div className="info-row"><span className="muted">Lifestyle</span><strong>{c.treatmentPlan.lifestyle || '—'}</strong></div>
          <div className="info-row"><span className="muted">Instructions</span><strong>{c.treatmentPlan.instructions || '—'}</strong></div>
        </div>

        <h4 className="card-title mb-2" style={{ fontSize: 14 }}>Prescription</h4>
        {!c.prescription || c.prescription.medicines.length === 0 ? (
          <p className="muted text-sm">No medicines prescribed.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Days</th>
                </tr>
              </thead>
              <tbody>
                {c.prescription.medicines.map((m, i) => (
                  <tr key={`${m.name}-${i}`}>
                    <td className="font-semibold">{m.name}</td>
                    <td className="muted">{m.dosage}</td>
                    <td className="muted">{m.frequency}</td>
                    <td className="muted">{m.durationDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminConsultations() {
  const [items, setItems] = useState<Consultation[]>([])
  const [search, setSearch] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('All')
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Consultation | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      listAllConsultations({
        search: search || undefined,
        doctorId: doctorFilter === 'All' ? undefined : doctorFilter,
      }),
      listDoctors(),
    ])
      .then(([consultations, docs]) => {
        if (cancelled) return
        setItems(consultations)
        setDoctors(docs.map((d) => ({ id: d.id, name: d.name })))
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, doctorFilter])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      setDetail(await getConsultationDetail(id))
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const total = items.length
  const withRx = useMemo(() => items.filter((c) => c.prescriptionId).length, [items])

  return (
    <>
      <PageHeader
        title="Consultations"
        subtitle={`${total} clinical records · ${withRx} with prescriptions`}
      />

      <Card>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <SearchInput value={search} onChange={setSearch} placeholder="Search patient, doctor, diagnosis…" />
          </div>
          <div className="chips">
            <button
              className={`chip ${doctorFilter === 'All' ? 'chip-active' : ''}`}
              onClick={() => setDoctorFilter('All')}
            >
              All doctors
            </button>
            {doctors.map((d) => (
              <button
                key={d.id}
                className={`chip ${doctorFilter === d.id ? 'chip-active' : ''}`}
                onClick={() => setDoctorFilter(d.id)}
              >
                {d.name.replace(/^Dr\.?\s*/i, '')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Spinner label="Loading consultations…" />
        ) : items.length === 0 ? (
          <EmptyState title="No consultations found" hint="Clinical records created by doctors will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Chief Complaint</th>
                  <th>Diagnosis</th>
                  <th>Date</th>
                  <th>Rx</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-person">
                        <Avatar name={c.patientName} size="sm" />
                        <strong>{c.patientName}</strong>
                      </div>
                    </td>
                    <td className="muted">{c.doctorName}</td>
                    <td className="muted">{c.chiefComplaint}</td>
                    <td className="font-semibold">{c.diagnosis.primary}</td>
                    <td className="muted">{fmtDate(c.createdAt)}</td>
                    <td>{c.prescriptionId ? <Badge tone="purple">Rx</Badge> : <Badge tone="gray">—</Badge>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => void openDetail(c.id)}>
                        <Stethoscope size={14} /> View Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        title={detail ? `Consultation · ${detail.patientName}` : 'Consultation'}
        size="lg"
      >
        {detailLoading ? (
          <Spinner label="Loading record…" />
        ) : detail ? (
          <Detail c={detail} />
        ) : (
          <p className="muted">Record unavailable.</p>
        )}
      </Modal>
    </>
  )
}
