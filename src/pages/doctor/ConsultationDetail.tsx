import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FileText, CheckCircle2 } from 'lucide-react'
import { getConsultation } from '../../api/services/doctorPortal'
import type { Consultation } from '../../types'
import { Card, Spinner, PageHeader } from '../../components/ui'
import { fmtDate } from './utils'

export default function ConsultationDetail() {
  const { consultationId } = useParams()
  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!consultationId) return
    let cancelled = false
    getConsultation(consultationId)
      .then((c) => {
        if (!cancelled) setConsultation(c)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load consultation')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [consultationId])

  if (loading) return <Spinner label="Loading consultation…" />
  if (error) return <div className="auth-error">{error}</div>
  if (!consultation) return <div className="auth-error">Consultation not found.</div>

  const c = consultation
  const hasVitals = Object.values(c.vitals ?? {}).some((v) => v !== undefined && v !== null && v !== '')

  return (
    <>
      <PageHeader
        title={`Consultation ${c.consultationNo ?? c.id}`}
        subtitle={`${c.patientName} · ${fmtDate(c.createdAt)} · by ${c.doctorName}`}
        backTo="/doctor/consultations"
        actions={
          <Link to={`/doctor/patients/${c.patientId}`} className="btn btn-outline">
            <FileText size={16} /> Open Patient Record
          </Link>
        }
      />

      <div className="mb-4">
        <div className="notice notice-success flex gap-2 align-center" style={{ gap: 8 }}>
          <CheckCircle2 size={18} />
          <span>
            Consultation recorded <strong>{fmtDate(c.createdAt)}</strong>.
            {c.prescriptionId && (
              <>
                {' '}
                Prescription <strong className="font-mono">{c.prescriptionNo ?? c.prescriptionId}</strong> was issued.
              </>
            )}
          </span>
        </div>
      </div>

      <div className="grid-2 mb-4">
        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Clinical Notes
          </h3>
          <div className="dp-kv mt-2">
            <div>
              <span>Chief Complaint</span>
              <p>{c.chiefComplaint}</p>
            </div>
            <div>
              <span>Symptoms</span>
              <p>{c.symptoms || '-'}</p>
            </div>
            <div>
              <span>Assessment</span>
              <p>{c.clinicalNotes.assessment || '-'}</p>
            </div>
            <div>
              <span>Observations</span>
              <p>{c.clinicalNotes.observations || '-'}</p>
            </div>
            <div>
              <span>Reasoning</span>
              <p>{c.clinicalNotes.reasoning || '-'}</p>
            </div>
            <div>
              <span>General Notes</span>
              <p>{c.clinicalNotes.general || '-'}</p>
            </div>
          </div>
        </Card>

        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Diagnosis
          </h3>
          <div className="dp-kv mt-2">
            <div>
              <span>Primary</span>
              <strong>{c.diagnosis.primary}</strong>
            </div>
            {c.diagnosis.additional && (
              <div>
                <span>Additional</span>
                <p>{c.diagnosis.additional}</p>
              </div>
            )}
            {c.diagnosis.notes && (
              <div>
                <span>Notes</span>
                <p>{c.diagnosis.notes}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid-2 mb-4">
        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Vitals
          </h3>
          {hasVitals ? (
            <div className="dp-kv mt-2">
              <div>
                <span>Blood Pressure</span>
                <strong>{c.vitals.bloodPressure || '-'}</strong>
              </div>
              <div>
                <span>Heart Rate</span>
                <strong>{c.vitals.heartRate ? `${c.vitals.heartRate} bpm` : '-'}</strong>
              </div>
              <div>
                <span>Temperature</span>
                <strong>{c.vitals.temperature ? `${c.vitals.temperature} °C` : '-'}</strong>
              </div>
              <div>
                <span>Respiratory Rate</span>
                <strong>{c.vitals.respiratoryRate ? `${c.vitals.respiratoryRate} /min` : '-'}</strong>
              </div>
              <div>
                <span>SpO₂</span>
                <strong>{c.vitals.spo2 ? `${c.vitals.spo2} %` : '-'}</strong>
              </div>
              <div>
                <span>Weight</span>
                <strong>{c.vitals.weightKg ? `${c.vitals.weightKg} kg` : '-'}</strong>
              </div>
              <div>
                <span>Height</span>
                <strong>{c.vitals.heightCm ? `${c.vitals.heightCm} cm` : '-'}</strong>
              </div>
              <div>
                <span>BMI</span>
                <strong>{c.vitals.bmi ? c.vitals.bmi.toFixed(1) : '-'}</strong>
              </div>
            </div>
          ) : (
            <p className="muted text-sm">No vitals recorded.</p>
          )}
        </Card>

        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Physical Examination
          </h3>
          <div className="dp-kv mt-2">
            <div>
              <span>General</span>
              <p>{c.examination.general || '-'}</p>
            </div>
            <div>
              <span>Cardiovascular</span>
              <p>{c.examination.cardiovascular || '-'}</p>
            </div>
            <div>
              <span>Respiratory</span>
              <p>{c.examination.respiratory || '-'}</p>
            </div>
            <div>
              <span>Neurological</span>
              <p>{c.examination.neurological || '-'}</p>
            </div>
            <div>
              <span>Abdominal</span>
              <p>{c.examination.abdominal || '-'}</p>
            </div>
            <div>
              <span>Other</span>
              <p>{c.examination.other || '-'}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padded className="mb-4">
        <h3 className="card-title" style={{ marginTop: 0 }}>
          Treatment Plan
        </h3>
        <div className="dp-kv mt-2">
          <div>
            <span>Advice</span>
            <p>{c.treatmentPlan.advice || '-'}</p>
          </div>
          <div>
            <span>Diet</span>
            <p>{c.treatmentPlan.diet || '-'}</p>
          </div>
          <div>
            <span>Lifestyle</span>
            <p>{c.treatmentPlan.lifestyle || '-'}</p>
          </div>
          <div>
            <span>Instructions</span>
            <p>{c.treatmentPlan.instructions || '-'}</p>
          </div>
        </div>
      </Card>

      {c.prescriptionId && (
        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Prescription
          </h3>
          <p className="muted text-sm">
            Prescription <strong className="font-mono">{c.prescriptionNo ?? c.prescriptionId}</strong> was issued with
            this consultation. See the{' '}
            <Link to="/doctor/prescriptions" className="font-semibold">
              Prescriptions page
            </Link>{' '}
            for full details.
          </p>
        </Card>
      )}
    </>
  )
}
