import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  ListChecks,
  Plus,
  Stethoscope,
  Trash2,
  TriangleAlert,
  Save,
  User,
} from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import {
  createConsultation,
  savePrescription,
  listConsultations,
} from '../../api/services/doctorPortal'
import { getPatient } from '../../api/services/patients'
import { listMedicines } from '../../api/services/pharmacy'
import type {
  Consultation,
  ConsultationCreateInput,
  Medicine,
  Patient,
  PrescriptionMedicine,
} from '../../types'
import {
  Card,
  Spinner,
  EmptyState,
  Button,
  ConfirmDialog,
  PageHeader,
  Avatar,
  StatusBadge,
} from '../../components/ui'
import { ageFromDob, calcBmi, fmtDate } from './utils'

interface MedicineRow extends PrescriptionMedicine {
  key: string
  medicineId: string
}

type Phase = 'form' | 'review' | 'done'

export default function ConsultationPage() {
  const [params] = useSearchParams()
  const { push } = useToast()

  const appointmentId = params.get('appointmentId') ?? undefined
  const patientId = params.get('patientId') ?? ''

  const [patient, setPatient] = useState<Patient | null>(null)
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [pastConsultations, setPastConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [phase, setPhase] = useState<Phase>('form')
  const [created, setCreated] = useState<Consultation | null>(null)
  const [savedPrescriptionId, setSavedPrescriptionId] = useState<string | null>(null)
  const [savedPrescriptionNo, setSavedPrescriptionNo] = useState<string | null>(null)
  const [savingPrescription, setSavingPrescription] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [validationError, setValidationError] = useState('')

  const [form, setForm] = useState({
    chiefComplaint: '',
    symptoms: '',
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    respiratoryRate: '',
    spo2: '',
    weightKg: '',
    heightCm: '',
    examGeneral: '',
    examCardiovascular: '',
    examRespiratory: '',
    examNeurological: '',
    examAbdominal: '',
    examOther: '',
    primaryDiagnosis: '',
    additionalDiagnosis: '',
    diagnosisNotes: '',
    assessment: '',
    observations: '',
    reasoning: '',
    clinicalGeneral: '',
    advice: '',
    diet: '',
    lifestyle: '',
    instructions: '',
  })
  const [medicineRows, setMedicineRows] = useState<MedicineRow[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      patientId ? getPatient(patientId) : Promise.resolve(null),
      listMedicines(),
      listConsultations({ patientId }),
    ])
      .then(([p, meds, past]) => {
        if (cancelled) return
        setPatient(p)
        setMedicines(meds)
        setPastConsultations(past)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load consultation data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  const bmi = useMemo(() => {
    const w = Number(form.weightKg)
    const h = Number(form.heightCm)
    if (!w || !h || h <= 0) return null
    return calcBmi(w, h)
  }, [form.weightKg, form.heightCm])

  const medicineMap = useMemo(
    () => new Map(medicines.map((m) => [m.id, m])),
    [medicines],
  )

  function addMedicineRow() {
    setMedicineRows((rows) => [
      ...rows,
      { key: `row-${Date.now()}`, medicineId: '', name: '', dosage: '', frequency: '', durationDays: 5 },
    ])
  }

  function updateMedicineRow(key: string, patch: Partial<MedicineRow>) {
    setMedicineRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeMedicineRow(key: string) {
    setMedicineRows((rows) => rows.filter((r) => r.key !== key))
  }

  function onMedicineSelect(key: string, medicineId: string) {
    const m = medicineMap.get(medicineId)
    updateMedicineRow(key, {
      medicineId,
      name: m?.name ?? '',
      dosage: m ? defaultDosage(m) : '',
    })
  }

  function defaultDosage(m: Medicine): string {
    const known: Record<string, string> = {
      Amoxicillin: '500 mg',
      Paracetamol: '500 mg',
      Metformin: '500 mg',
      Amlodipine: '5 mg',
      Atorvastatin: '10 mg',
      Omeprazole: '20 mg',
      Ibuprofen: '400 mg',
      Azithromycin: '500 mg',
      Cetirizine: '10 mg',
      Salbutamol: '100 mcg',
    }
    return known[m.name] ?? ''
  }

  const completedRows = medicineRows.filter((r) => r.name.trim() !== '')
  const hasStockWarnings = medicineRows.some((r) => {
    const m = medicineMap.get(r.medicineId)
    return m && (m.stock <= 0 || m.status === 'Out of Stock' || (m.status === 'Low Stock' && m.stock <= m.reorderLevel))
  })

  function validate(): string {
    if (form.chiefComplaint.trim().length < 3) return 'Chief complaint is required (min 3 characters).'
    if (!form.primaryDiagnosis.trim()) return 'Primary diagnosis is required.'
    return ''
  }

  function buildInput(): ConsultationCreateInput {
    const prescription = completedRows.length
      ? { medicines: completedRows.map((r) => ({ name: r.name, dosage: r.dosage, frequency: r.frequency, durationDays: r.durationDays, instructions: r.instructions })) }
      : undefined
    return {
      patientId: patient?.id ?? '',
      appointmentId,
      chiefComplaint: form.chiefComplaint.trim(),
      symptoms: form.symptoms.trim(),
      vitals: {
        bloodPressure: form.bloodPressure || undefined,
        heartRate: form.heartRate ? Number(form.heartRate) : undefined,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        respiratoryRate: form.respiratoryRate ? Number(form.respiratoryRate) : undefined,
        spo2: form.spo2 ? Number(form.spo2) : undefined,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        heightCm: form.heightCm ? Number(form.heightCm) : undefined,
        bmi: bmi ?? undefined,
      },
      examination: {
        general: form.examGeneral.trim(),
        cardiovascular: form.examCardiovascular.trim(),
        respiratory: form.examRespiratory.trim(),
        neurological: form.examNeurological.trim(),
        abdominal: form.examAbdominal.trim(),
        other: form.examOther.trim(),
      },
      diagnosis: {
        primary: form.primaryDiagnosis.trim(),
        additional: form.additionalDiagnosis.trim(),
        notes: form.diagnosisNotes.trim(),
      },
      clinicalNotes: {
        assessment: form.assessment.trim(),
        observations: form.observations.trim(),
        reasoning: form.reasoning.trim(),
        general: form.clinicalGeneral.trim(),
      },
      treatmentPlan: {
        advice: form.advice.trim(),
        diet: form.diet.trim(),
        lifestyle: form.lifestyle.trim(),
        instructions: form.instructions.trim(),
      },
      prescription,
      prescriptionId: savedPrescriptionId ?? undefined,
    }
  }

  async function onSavePrescription() {
    if (!patient) return
    if (completedRows.length === 0) {
      push('Add at least one medicine to save a prescription', 'error')
      return
    }
    setSavingPrescription(true)
    try {
      const rx = await savePrescription({
        patientId: patient.id,
        appointmentId,
        medicines: completedRows.map((r) => ({
          name: r.name,
          dosage: r.dosage,
          frequency: r.frequency,
          durationDays: r.durationDays,
          instructions: r.instructions,
        })),
      })
      setSavedPrescriptionId(rx.id)
      setSavedPrescriptionNo(rx.prescriptionNo ?? rx.id)
      push(`Prescription ${rx.prescriptionNo ?? rx.id} saved`)
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to save prescription', 'error')
    } finally {
      setSavingPrescription(false)
    }
  }

  async function onComplete() {
    const v = validate()
    if (v) {
      setValidationError(v)
      return
    }
    setShowReview(true)
  }

  async function onConfirmComplete() {
    setShowReview(false)
    setSubmitting(true)
    setValidationError('')
    try {
      const c = await createConsultation(buildInput())
      setCreated(c)
      setPhase('done')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed to save consultation', 'error')
      setSubmitting(false)
    }
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  if (loading) return <Spinner label="Preparing consultation…" />
  if (error) return <div className="auth-error">{error}</div>

  if (phase === 'done' && created) {
    return (
      <>
        <div className="dp-success-wrap">
          <div className="dp-success-icon">
            <CheckCircle2 size={44} />
          </div>
          <h2>Consultation saved</h2>
          <p className="muted">
            Consultation <strong className="font-mono">{created.consultationNo ?? created.id}</strong> for{' '}
            <strong>{created.patientName}</strong> has been recorded.
            {created.prescriptionId && (
              <>
                {' '}
                Prescription <strong className="font-mono">{created.prescriptionNo ?? created.prescriptionId}</strong> was
                issued.
              </>
            )}
          </p>
          <div className="flex gap-2 mt-4" style={{ gap: 10 }}>
            <Link to={`/doctor/consultations/${created.id}`} className="btn btn-primary">
              <ClipboardList size={16} /> View Consultation
            </Link>
            <Link to="/doctor/appointments?view=today" className="btn btn-outline">
              Back to Appointments
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New Consultation"
        subtitle={
          appointmentId
            ? 'Recording a consultation for a scheduled appointment.'
            : 'Recording a consultation for a patient.'
        }
        backTo={appointmentId ? '/doctor/appointments' : patient ? `/doctor/patients/${patient.id}` : '/doctor/patients'}
      />

      {!patient ? (
        <Card>
          <EmptyState
            title="No patient selected"
            hint="Open this page from an appointment (Start Consultation) or from a patient record (New Consultation)."
          />
        </Card>
      ) : (
        <div className="dp-layout">
          <div className="flex-column gap-4" style={{ gap: 16 }}>
            <Card padded>
              <h3 className="card-title" style={{ marginTop: 0 }}>
                <ClipboardList size={16} style={{ verticalAlign: 'middle' }} /> Chief Complaint
              </h3>              <div className="field">
                <label htmlFor="chiefComplaint">Chief complaint *</label>
                <textarea
                  id="chiefComplaint"
                  className="textarea"
                  rows={2}
                  placeholder="e.g. Fever with cough and sore throat for 3 days"
                  value={form.chiefComplaint}
                  onChange={(e) => set('chiefComplaint', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="symptoms">Symptoms</label>
                <textarea
                  id="symptoms"
                  className="textarea"
                  rows={2}
                  placeholder="e.g. Fever 101°F, dry cough, mild headache, loss of appetite"
                  value={form.symptoms}
                  onChange={(e) => set('symptoms', e.target.value)}
                />
              </div>
            </Card>

            <Card padded>
              <h3 className="card-title" style={{ marginTop: 0 }}>
                <HeartPulse size={16} style={{ verticalAlign: 'middle' }} /> Vitals
              </h3>
              <div className="dp-vitals-grid">
                <div className="field">
                  <label htmlFor="bp">Blood Pressure (mmHg)</label>
                  <input
                    id="bp"
                    className="input"
                    placeholder="120/80"
                    value={form.bloodPressure}
                    onChange={(e) => set('bloodPressure', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="hr">Heart Rate (bpm)</label>
                  <input
                    id="hr"
                    className="input"
                    type="number"
                    min={0}
                    max={400}
                    placeholder="72"
                    value={form.heartRate}
                    onChange={(e) => set('heartRate', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="temp">Temperature (°C)</label>
                  <input
                    id="temp"
                    className="input"
                    type="number"
                    step="0.1"
                    min={30}
                    max={45}
                    placeholder="36.8"
                    value={form.temperature}
                    onChange={(e) => set('temperature', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rr">Respiratory Rate (/min)</label>
                  <input
                    id="rr"
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="16"
                    value={form.respiratoryRate}
                    onChange={(e) => set('respiratoryRate', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="spo2">SpO₂ (%)</label>
                  <input
                    id="spo2"
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="98"
                    value={form.spo2}
                    onChange={(e) => set('spo2', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="weight">Weight (kg)</label>
                  <input
                    id="weight"
                    className="input"
                    type="number"
                    step="0.1"
                    min={0}
                    max={400}
                    placeholder="65"
                    value={form.weightKg}
                    onChange={(e) => set('weightKg', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="height">Height (cm)</label>
                  <input
                    id="height"
                    className="input"
                    type="number"
                    min={0}
                    max={250}
                    placeholder="170"
                    value={form.heightCm}
                    onChange={(e) => set('heightCm', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>BMI</label>
                  <input className="input" value={bmi ? String(bmi) : ''} readOnly placeholder="Auto" />
                </div>
              </div>
            </Card>

            <Card padded>
              <h3 className="card-title" style={{ marginTop: 0 }}>
                <Stethoscope size={16} style={{ verticalAlign: 'middle' }} /> Physical Examination
              </h3>
              <div className="dp-exam-grid">
                <div className="field">
                  <label htmlFor="examGeneral">General</label>
                  <textarea
                    id="examGeneral"
                    className="textarea"
                    rows={2}
                    placeholder="Pallor, dehydration…"
                    value={form.examGeneral}
                    onChange={(e) => set('examGeneral', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="examCardio">Cardiovascular</label>
                  <textarea
                    id="examCardio"
                    className="textarea"
                    rows={2}
                    placeholder="Heart sounds…"
                    value={form.examCardiovascular}
                    onChange={(e) => set('examCardiovascular', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="examResp">Respiratory</label>
                  <textarea
                    id="examResp"
                    className="textarea"
                    rows={2}
                    placeholder="Air entry, crepitations…"
                    value={form.examRespiratory}
                    onChange={(e) => set('examRespiratory', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="examNeuro">Neurological</label>
                  <textarea
                    id="examNeuro"
                    className="textarea"
                    rows={2}
                    placeholder="GCS, reflexes…"
                    value={form.examNeurological}
                    onChange={(e) => set('examNeurological', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="examAbd">Abdominal</label>
                  <textarea
                    id="examAbd"
                    className="textarea"
                    rows={2}
                    placeholder="Tenderness, organomegaly…"
                    value={form.examAbdominal}
                    onChange={(e) => set('examAbdominal', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="examOther">Other</label>
                  <textarea
                    id="examOther"
                    className="textarea"
                    rows={2}
                    placeholder="Skin, extremities…"
                    value={form.examOther}
                    onChange={(e) => set('examOther', e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <Card padded>
              <h3 className="card-title" style={{ marginTop: 0 }}>
                <Activity size={16} style={{ verticalAlign: 'middle' }} /> Diagnosis
              </h3>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="primaryDx">Primary diagnosis *</label>
                  <input
                    id="primaryDx"
                    className="input"
                    placeholder="e.g. Acute pharyngitis"
                    value={form.primaryDiagnosis}
                    onChange={(e) => set('primaryDiagnosis', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="additionalDx">Additional diagnosis</label>
                  <input
                    id="additionalDx"
                    className="input"
                    placeholder="Comorbidities, second diagnosis…"
                    value={form.additionalDiagnosis}
                    onChange={(e) => set('additionalDiagnosis', e.target.value)}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="dxNotes">Diagnosis notes</label>
                <textarea
                  id="dxNotes"
                  className="textarea"
                  rows={2}
                  placeholder="Rationale and differential considerations…"
                  value={form.diagnosisNotes}
                  onChange={(e) => set('diagnosisNotes', e.target.value)}
                />
              </div>
            </Card>

            <Card padded>
              <h3 className="card-title" style={{ marginTop: 0 }}>
                <FileText size={16} style={{ verticalAlign: 'middle' }} /> Clinical Notes
              </h3>
              <div className="dp-exam-grid">
                <div className="field">
                  <label htmlFor="assessment">Assessment</label>
                  <textarea
                    id="assessment"
                    className="textarea"
                    rows={2}
                    placeholder="Overall assessment…"
                    value={form.assessment}
                    onChange={(e) => set('assessment', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="observations">Observations</label>
                  <textarea
                    id="observations"
                    className="textarea"
                    rows={2}
                    placeholder="Clinical observations…"
                    value={form.observations}
                    onChange={(e) => set('observations', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="reasoning">Reasoning</label>
                  <textarea
                    id="reasoning"
                    className="textarea"
                    rows={2}
                    placeholder="Clinical reasoning…"
                    value={form.reasoning}
                    onChange={(e) => set('reasoning', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="clinicalGeneral">General notes</label>
                  <textarea
                    id="clinicalGeneral"
                    className="textarea"
                    rows={2}
                    placeholder="Any other clinical notes…"
                    value={form.clinicalGeneral}
                    onChange={(e) => set('clinicalGeneral', e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <Card padded>
              <h3 className="card-title" style={{ marginTop: 0 }}>
                <ListChecks size={16} style={{ verticalAlign: 'middle' }} /> Treatment Plan
              </h3>
              <div className="dp-exam-grid">
                <div className="field">
                  <label htmlFor="advice">Advice</label>
                  <textarea
                    id="advice"
                    className="textarea"
                    rows={2}
                    placeholder="e.g. Rest, plenty of fluids, avoid cold drinks"
                    value={form.advice}
                    onChange={(e) => set('advice', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="diet">Diet</label>
                  <textarea
                    id="diet"
                    className="textarea"
                    rows={2}
                    placeholder="e.g. Soft diet, warm liquids"
                    value={form.diet}
                    onChange={(e) => set('diet', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="lifestyle">Lifestyle</label>
                  <textarea
                    id="lifestyle"
                    className="textarea"
                    rows={2}
                    placeholder="e.g. 8 hours sleep, avoid smoking"
                    value={form.lifestyle}
                    onChange={(e) => set('lifestyle', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="instructions">Instructions</label>
                  <textarea
                    id="instructions"
                    className="textarea"
                    rows={2}
                    placeholder="e.g. Follow up in 5 days if fever persists"
                    value={form.instructions}
                    onChange={(e) => set('instructions', e.target.value)}
                  />
                </div>
              </div>
            </Card>
          </div>

          <aside className="dp-aside">
            <Card padded>
              <div className="flex gap-3 align-center" style={{ gap: 12 }}>
                <Avatar name={`${patient.firstName} ${patient.lastName}`} size="lg" />
                <div>
                  <strong>{patient.firstName} {patient.lastName}</strong>
                  <div className="muted text-sm">{patient.patientId}</div>
                  <div className="muted text-sm">
                    {ageFromDob(patient.dob) ?? '—'} yrs · {patient.gender} · {patient.bloodGroup || '—'}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <StatusBadge status={patient.status} />
                <span className="muted text-xs">
                  {' '}
                  Last visit: {patient.lastVisit ? fmtDate(patient.lastVisit) : 'Never'}
                </span>
              </div>

              <div className="dp-aside-section">
                <h4 className="dp-aside-title">
                  <TriangleAlert size={14} /> Allergies
                </h4>
                {(patient.allergies ?? []).length ? (
                  <div className="flex gap-2" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {patient.allergies.map((a, i) => (
                      <span key={i} className="badge badge-red">
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="muted text-xs">No allergies recorded.</p>
                )}
              </div>

              <div className="dp-aside-section">
                <h4 className="dp-aside-title">
                  <FileText size={14} /> Previous Diagnoses
                </h4>
                {pastConsultations.length ? (
                  <ul className="dp-dot-list">
                    {pastConsultations.slice(0, 5).map((c) => (
                      <li key={c.id}>
                        {c.diagnosis.primary}
                        <span className="muted text-xs"> · {fmtDate(c.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-xs">No previous diagnoses.</p>
                )}
              </div>

              <div className="dp-aside-section">
                <h4 className="dp-aside-title">
                  <User size={14} /> Insurance
                </h4>
                <p className="text-sm">{patient.insurance || 'Not on record'}</p>
              </div>
            </Card>
          </aside>
        </div>
      )}

      {patient && (
        <Card padded className="mt-4">
          <div className="card-header" style={{ padding: 0, marginBottom: 14, border: 'none' }}>
            <div>
              <h3 className="card-title">Prescription</h3>
              <p className="card-subtitle">Prescribe medicines from the pharmacy inventory.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addMedicineRow}>
              <Plus size={15} /> Add medicine
            </Button>
          </div>

          {medicineRows.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 20px' }}>
              <span className="muted text-sm">No medicines added yet.</span>
            </div>
          ) : (
            <div className="dp-rx-list">
              {medicineRows.map((row, idx) => {
                const m = row.medicineId ? medicineMap.get(row.medicineId) : undefined
                const outOfStock = !!m && m.stock <= 0
                const lowStock = !!m && !outOfStock && m.status === 'Low Stock'
                return (
                  <div key={row.key} className="dp-rx-row">
                    <div className="dp-rx-index">{idx + 1}</div>
                    <div className="dp-rx-fields">
                      <div className="dp-rx-select">
                        <select
                          className="input"
                          value={row.medicineId}
                          onChange={(e) => onMedicineSelect(row.key, e.target.value)}
                          aria-label={`Medicine ${idx + 1}`}
                        >
                          <option value="">Select medicine…</option>
                          {medicines.map((med) => (
                            <option key={med.id} value={med.id}>
                              {med.name} (Stock: {med.stock})
                            </option>
                          ))}
                        </select>
                        {outOfStock && (
                          <span className="dp-stock-warn">
                            <TriangleAlert size={13} /> Out of stock
                          </span>
                        )}
                        {lowStock && (
                          <span className="dp-stock-warn">
                            <TriangleAlert size={13} /> Low stock ({m!.stock} left)
                          </span>
                        )}
                      </div>
                      <input
                        className="input"
                        placeholder="Dosage"
                        value={row.dosage}
                        onChange={(e) => updateMedicineRow(row.key, { dosage: e.target.value })}
                        aria-label={`Dosage ${idx + 1}`}
                      />
                      <input
                        className="input"
                        placeholder="Frequency"
                        value={row.frequency}
                        onChange={(e) => updateMedicineRow(row.key, { frequency: e.target.value })}
                        aria-label={`Frequency ${idx + 1}`}
                      />
                      <input
                        className="input"
                        type="number"
                        min={1}
                        placeholder="Days"
                        value={String(row.durationDays)}
                        onChange={(e) =>
                          updateMedicineRow(row.key, { durationDays: Number(e.target.value) })
                        }
                        aria-label={`Duration days ${idx + 1}`}
                      />
                      <input
                        className="input"
                        placeholder="Instructions"
                        value={row.instructions ?? ''}
                        onChange={(e) => updateMedicineRow(row.key, { instructions: e.target.value })}
                        aria-label={`Instructions ${idx + 1}`}
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeMedicineRow(row.key)}>
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {hasStockWarnings && (
                <div className="dp-stock-note">
                  <TriangleAlert size={14} />
                  <span>
                    Some selected medicines are out of stock or low. Please verify availability with
                    the pharmacy.
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {patient && (
        <div className="dp-actionbar">
          <div className="dp-actionbar-inner">
            <div className="flex gap-2 align-center" style={{ gap: 8 }}>
              {savedPrescriptionNo ? (
                <span className="dp-saved-rx">
                  <CheckCircle2 size={14} /> Prescription {savedPrescriptionNo} saved
                </span>
              ) : (
                <span className="muted text-sm">Prescription can be saved before completing.</span>
              )}
            </div>
            <div className="flex gap-2" style={{ gap: 10 }}>
              {validationError && <span className="dp-validation-error">{validationError}</span>}
              <Button
                variant="secondary"
                loading={savingPrescription}
                onClick={() => void onSavePrescription()}
              >
                <Save size={16} /> Save Prescription
              </Button>
              <Button loading={submitting} onClick={() => void onComplete()}>
                <CheckCircle2 size={16} /> Complete Consultation
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showReview}
        title="Complete consultation?"
        confirmLabel="Save consultation"
        danger={false}
        onConfirm={() => void onConfirmComplete()}
        onCancel={() => setShowReview(false)}
      >
        <p className="confirm-message">
          The consultation record cannot be edited after saving. Review the summary below before
          confirming.
        </p>
        <ReviewSummary
          patient={patient}
          chiefComplaint={form.chiefComplaint}
          primaryDiagnosis={form.primaryDiagnosis}
          prescriptionId={savedPrescriptionNo ?? savedPrescriptionId}
          medicineCount={completedRows.length}
          bmi={bmi}
        />
      </ConfirmDialog>
    </>
  )
}

function ReviewSummary({
  patient,
  chiefComplaint,
  primaryDiagnosis,
  prescriptionId,
  medicineCount,
  bmi,
}: {
  patient: Patient | null
  chiefComplaint: string
  primaryDiagnosis: string
  prescriptionId: string | null
  medicineCount: number
  bmi: number | null
}) {
  return (
    <div className="dp-review-summary">
      <div>
        <span>Patient</span>
        <strong>
          {patient ? `${patient.firstName} ${patient.lastName}` : '—'}
        </strong>
      </div>
      <div>
        <span>Chief complaint</span>
        <strong>{chiefComplaint}</strong>
      </div>
      <div>
        <span>Primary diagnosis</span>
        <strong>{primaryDiagnosis}</strong>
      </div>
      <div>
        <span>Prescription</span>
        <strong>
          {prescriptionId ? `${prescriptionId} (${medicineCount} items)` : `Not saved (${medicineCount} items pending)`}
        </strong>
      </div>
      {bmi !== null && (
        <div>
          <span>BMI</span>
          <strong>{bmi}</strong>
        </div>
      )}
    </div>
  )
}
