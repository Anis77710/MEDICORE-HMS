import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  PlayCircle,
  Phone,
  Mail,
  Droplets,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react'
import {
  listConsultations,
  getMyAppointments,
  listMyPrescriptions,
} from '../../api/services/doctorPortal'
import { getPatient } from '../../api/services/patients'
import type { Appointment, Consultation, Patient, Prescription } from '../../types'
import { Card, Spinner, EmptyState, StatusBadge, Tabs, PageHeader, Avatar, Badge } from '../../components/ui'
import { ageFromDob, fmtDate } from './utils'

type Section = 'overview' | 'history' | 'consultations' | 'diagnoses' | 'prescriptions'

export default function PatientWorkspace() {
  const { patientId } = useParams()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [section, setSection] = useState<Section>('overview')

  useEffect(() => {
    if (!patientId) return
    let cancelled = false
    Promise.all([
      getPatient(patientId),
      listConsultations({ patientId }),
      getMyAppointments(),
      listMyPrescriptions(),
    ])
      .then(([p, consults, appts, rx]) => {
        if (cancelled) return
        setPatient(p)
        setConsultations(consults.filter((c) => c.patientId === patientId))
        setAppointments(appts.filter((a) => a.patientId === patientId))
        setPrescriptions(rx.filter((r) => r.patientId === patientId))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load patient record')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  const sortedConsultations = useMemo(
    () => [...consultations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [consultations],
  )
  const sortedAppointments = useMemo(
    () =>
      [...appointments]
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .reverse(),
    [appointments],
  )
  const sortedPrescriptions = useMemo(
    () => [...prescriptions].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    [prescriptions],
  )

  const diagnosisCount = useMemo(() => {
    const set = new Set<string>()
    for (const c of sortedConsultations) {
      set.add(c.diagnosis.primary)
      if (c.diagnosis.additional) set.add(c.diagnosis.additional)
    }
    return set.size
  }, [sortedConsultations])

  if (loading) return <Spinner label="Loading patient record…" />
  if (error) return <div className="auth-error">{error}</div>
  if (!patient) return <div className="auth-error">Patient not found.</div>

  return (
    <>
      <PageHeader
        title={`${patient.firstName} ${patient.lastName}`}
        subtitle={`${patient.patientId} · ${ageFromDob(patient.dob) ?? '-'} yrs · ${patient.gender}`}
        backTo="/doctor/patients"
        actions={
          <Link
            to={`/doctor/consultations/new?patientId=${patient.id}`}
            className="btn btn-primary"
          >
            <PlayCircle size={16} /> New Consultation
          </Link>
        }
      />

      <div className="grid-3 mb-4">
        <Card padded className="dp-patient-card">
          <div className="flex gap-3" style={{ gap: 14 }}>
            <Avatar name={`${patient.firstName} ${patient.lastName}`} size="lg" />
            <div className="flex-column gap-1" style={{ gap: 2 }}>
              <div className="flex gap-2 align-center" style={{ gap: 8 }}>
                <h3 style={{ margin: 0 }}>
                  {patient.firstName} {patient.lastName}
                </h3>
                <StatusBadge status={patient.status} />
              </div>
              <span className="muted text-sm">{patient.phone}</span>
              <span className="muted text-sm">{patient.email}</span>
            </div>
          </div>
          <div className="dp-patient-tags mt-3">
            <Badge tone="red">
              <Droplets size={12} /> {patient.bloodGroup || 'Unknown'}
            </Badge>
            <Badge tone="blue">
              <CalendarDays size={12} /> DOB {patient.dob}
            </Badge>
            <Badge tone="purple">
              <ShieldAlert size={12} /> {patient.department || 'General'}
            </Badge>
          </div>
        </Card>

        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Contact
          </h3>
          <div className="dp-kv mt-2">
            <div>
              <Phone size={14} />
              <span>{patient.phone || '-'}</span>
            </div>
            <div>
              <Mail size={14} />
              <span>{patient.email || '-'}</span>
            </div>
            <div className="muted text-sm">{patient.address || 'No address recorded'}</div>
            <div>
              <span>Emergency Contact</span>
              <strong>{patient.emergencyContact || '-'}</strong>
            </div>
          </div>
        </Card>

        <Card padded>
          <h3 className="card-title" style={{ marginTop: 0 }}>
            Clinical Snapshot
          </h3>
          <div
            className="grid-stats"
            style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}
          >
            <StatMini label="Visits" value={String(appointments.length)} />
            <StatMini label="Consultations" value={String(consultations.length)} />
            <StatMini label="Diagnoses" value={String(diagnosisCount)} />
          </div>
          <p className="muted text-sm mt-2" style={{ marginTop: 10 }}>
            Last visit: <strong>{patient.lastVisit ? fmtDate(patient.lastVisit) : 'Never'}</strong>
          </p>
        </Card>
      </div>

      <Tabs
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'history', label: 'Medical History' },
          { value: 'consultations', label: 'Consultations' },
          { value: 'diagnoses', label: 'Diagnoses' },
          { value: 'prescriptions', label: 'Prescriptions' },
        ]}
        active={section}
        onChange={(v) => setSection(v as Section)}
      />

      <div className="mt-3">
        {section === 'overview' && <OverviewSection patient={patient} />}
        {section === 'history' && <HistorySection patient={patient} />}
        {section === 'consultations' && (
          <ConsultationsSection consultations={sortedConsultations} />
        )}
        {section === 'diagnoses' && <DiagnosesSection consultations={sortedConsultations} />}
        {section === 'prescriptions' && (
          <PrescriptionsSection prescriptions={sortedPrescriptions} />
        )}
      </div>

      <Card padded className="mt-4">
        <h3 className="card-title" style={{ marginTop: 0 }}>
          Appointment History
        </h3>
        {sortedAppointments.length === 0 ? (
          <EmptyState title="No appointments" hint="This patient has no appointment history." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Department</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedAppointments.map((a) => (
                  <tr key={a.id}>
                    <td className="muted">{a.date}</td>
                    <td className="font-semibold">{a.time}</td>
                    <td className="muted">{a.type}</td>
                    <td className="muted">{a.department}</td>
                    <td className="muted">{a.reason}</td>
                    <td>
                      <StatusBadge status={a.status} />
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

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="dp-stat-mini">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function OverviewSection({ patient }: { patient: Patient }) {
  return (
    <Card padded>
      <h3 className="card-title" style={{ marginTop: 0 }}>
        Patient Information
      </h3>
      <div className="dp-kv mt-2">
        <div>
          <span>Patient ID</span>
          <strong>{patient.patientId}</strong>
        </div>
        <div>
          <span>Full Name</span>
          <strong>
            {patient.firstName} {patient.lastName}
          </strong>
        </div>
        <div>
          <span>Date of Birth</span>
          <strong>{patient.dob}</strong>
        </div>
        <div>
          <span>Age</span>
          <strong>{ageFromDob(patient.dob) ?? '-'} yrs</strong>
        </div>
        <div>
          <span>Gender</span>
          <strong>{patient.gender}</strong>
        </div>
        <div>
          <span>Blood Group</span>
          <strong>{patient.bloodGroup || '-'}</strong>
        </div>
        <div>
          <span>Department</span>
          <strong>{patient.department || '-'}</strong>
        </div>
        <div>
          <span>Assigned Doctor</span>
          <strong>{patient.assignedDoctorId ? patient.assignedDoctorId : 'Unassigned'}</strong>
        </div>
        <div>
          <span>Insurance</span>
          <strong>{patient.insurance || '-'}</strong>
        </div>
      </div>
    </Card>
  )
}

function HistorySection({ patient }: { patient: Patient }) {
  const hasAllergies = (patient.allergies ?? []).length > 0
  return (
    <div className="grid-2">
      <Card padded>
        <h3 className="card-title" style={{ marginTop: 0 }}>
          Allergies
        </h3>
        {hasAllergies ? (
          <div className="flex gap-2" style={{ gap: 8 }}>
            {patient.allergies.map((a, i) => (
              <Badge key={i} tone="red">
                {a}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">No allergies recorded.</p>
        )}
      </Card>
      <Card padded>
        <h3 className="card-title" style={{ marginTop: 0 }}>
          Notes
        </h3>
        <p className="muted text-sm">{patient.notes || 'No notes recorded.'}</p>
      </Card>
    </div>
  )
}

function ConsultationsSection({ consultations }: { consultations: Consultation[] }) {
  if (consultations.length === 0) {
    return (
      <EmptyState title="No consultations yet" hint="Complete a consultation to record it here." />
    )
  }
  return (
    <Card>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Chief Complaint</th>
              <th>Primary Diagnosis</th>
              <th>Advice</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {consultations.map((c) => (
              <tr key={c.id}>
                <td className="muted">{fmtDate(c.createdAt)}</td>
                <td>{c.chiefComplaint}</td>
                <td className="font-semibold">{c.diagnosis.primary}</td>
                <td className="muted">{c.treatmentPlan.advice}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link to={`/doctor/consultations/${c.id}`} className="btn btn-outline btn-sm">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function DiagnosesSection({ consultations }: { consultations: Consultation[] }) {
  const rows = consultations.flatMap((c) => {
    const items = [c.diagnosis.primary, ...(c.diagnosis.additional ? [c.diagnosis.additional] : [])]
    return items.map((d) => ({ diagnosis: d, date: fmtDate(c.createdAt), consultationId: c.id }))
  })
  if (rows.length === 0) {
    return (
      <EmptyState title="No diagnoses yet" hint="Diagnoses from your consultations appear here." />
    )
  }
  return (
    <Card>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Diagnosis</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Consultation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="font-semibold">{r.diagnosis}</td>
                <td className="muted">{r.date}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link to={`/doctor/consultations/${r.consultationId}`} className="btn btn-outline btn-sm">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PrescriptionsSection({ prescriptions }: { prescriptions: Prescription[] }) {
  if (prescriptions.length === 0) {
    return (
      <EmptyState title="No prescriptions yet" hint="Prescriptions you have issued appear here." />
    )
  }
  return (
    <Card>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Prescription</th>
              <th>Date</th>
              <th>Medicines</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {prescriptions.map((rx) => (
              <tr key={rx.id}>
                <td className="muted font-mono">{rx.prescriptionNo ?? rx.id}</td>
                <td className="muted">{fmtDate(rx.issuedAt)}</td>
                <td>
                  {rx.medicines.map((m) => (
                    <div key={m.name} className="text-sm">
                      <strong>{m.name}</strong>
                      <span className="muted">
                        {' '}
                        - {m.dosage}, {m.frequency}, {m.durationDays} day(s)
                      </span>
                    </div>
                  ))}
                </td>
                <td>
                  <StatusBadge status={rx.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
