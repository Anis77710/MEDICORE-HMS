import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayCircle, Search } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { listConsultations, listMyPrescriptions } from '../../api/services/doctorPortal'
import { getMedicalRecords, listPatients } from '../../api/services/patients'
import type { MedicalRecord } from '../../api/services/patients'
import type { Patient, Consultation, Prescription } from '../../types'
import {
  Card,
  Spinner,
  EmptyState,
  Tabs,
  PageHeader,
  Avatar,
  StatusBadge,
  Badge,
} from '../../components/ui'
import { ageFromDob, fmtDate } from './utils'

type Section = 'overview' | 'history' | 'consultations' | 'diagnoses' | 'prescriptions'

export default function MedicalRecords() {
  const { push } = useToast()
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<Section>('overview')

  useEffect(() => {
    let cancelled = false
    listPatients({ limit: 100, page: 1 })
      .then((res) => {
        if (!cancelled) setPatients(res.items)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load patients')
      })
      .finally(() => {
        if (!cancelled) setLoadingPatients(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setRecords([])
      setConsultations([])
      setPrescriptions([])
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    Promise.all([
      getMedicalRecords(selectedId),
      listConsultations({ patientId: selectedId }),
      listMyPrescriptions(),
    ])
      .then(([recs, consults, rx]) => {
        if (cancelled) return
        setRecords(recs)
        setConsultations(consults.filter((c) => c.patientId === selectedId))
        setPrescriptions(rx.filter((r) => r.patientId === selectedId))
      })
      .catch((err) => {
        if (!cancelled) push(err instanceof Error ? err.message : 'Failed to load records', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, push])

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase()
    return patients
      .filter(
        (p) =>
          !q ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.patientId.toLowerCase().includes(q),
      )
      .sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
  }, [patients, query])

  const selected = patients.find((p) => p.id === selectedId) ?? null

  const sortedConsultations = useMemo(
    () => [...consultations].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [consultations],
  )
  const sortedPrescriptions = useMemo(
    () => [...prescriptions].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
    [prescriptions],
  )

  if (loadingPatients) return <Spinner label="Loading patients…" />
  if (error) return <div className="auth-error">{error}</div>

  return (
    <>
      <PageHeader
        title="Medical Records"
        subtitle="Browse complete medical records for any patient."
      />

      <div className="dp-mr-layout">
        <Card padded className="dp-mr-picker">
          <div className="search-box mb-2" style={{ width: '100%' }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Search patients…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search patients"
            />
          </div>
          <div className="dp-mr-patient-list">
            {filteredPatients.length === 0 ? (
              <EmptyState title="No patients found" />
            ) : (
              filteredPatients.map((p) => (
                <button
                  key={p.id}
                  className={`dp-mr-patient ${p.id === selectedId ? 'dp-mr-patient-active' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <Avatar name={`${p.firstName} ${p.lastName}`} size="sm" />
                  <div className="flex-column" style={{ gap: 1, textAlign: 'left', minWidth: 0 }}>
                    <strong className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.firstName} {p.lastName}
                    </strong>
                    <span className="muted text-xs">
                      {p.patientId} · {ageFromDob(p.dob) ?? '-'} yrs
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <div className="dp-mr-detail">
          {!selected ? (
            <Card>
              <EmptyState
                title="Select a patient"
                hint="Pick a patient from the list to view their medical records."
              />
            </Card>
          ) : loadingDetail ? (
            <Spinner label="Loading medical records…" />
          ) : (
            <>
              <Card padded className="mb-4">
                <div className="flex justify-between align-center" style={{ gap: 12 }}>
                  <div className="flex gap-3 align-center" style={{ gap: 12 }}>
                    <Avatar name={`${selected.firstName} ${selected.lastName}`} size="lg" />
                    <div>
                      <h3 style={{ margin: 0 }}>
                        {selected.firstName} {selected.lastName}
                      </h3>
                      <div className="muted text-sm">
                        {selected.patientId} · {ageFromDob(selected.dob) ?? '-'} yrs ·{' '}
                        {selected.gender} · {selected.bloodGroup || '-'}
                      </div>
                      <div className="muted text-sm">
                        Last visit: {selected.lastVisit ? fmtDate(selected.lastVisit) : 'Never'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2" style={{ gap: 8 }}>
                    <StatusBadge status={selected.status} />
                    <Link
                      to={`/doctor/consultations/new?patientId=${selected.id}`}
                      className="btn btn-primary btn-sm"
                    >
                      <PlayCircle size={15} /> New Consultation
                    </Link>
                  </div>
                </div>
                {(selected.allergies ?? []).length > 0 && (
                  <div className="mt-2 flex gap-2 align-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <span className="muted text-xs">Allergies:</span>
                    {selected.allergies.map((a, i) => (
                      <Badge key={i} tone="red">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>

              <Tabs
                tabs={[
                  { value: 'overview', label: 'Overview' },
                  { value: 'history', label: 'History' },
                  { value: 'consultations', label: 'Consultations' },
                  { value: 'diagnoses', label: 'Diagnoses' },
                  { value: 'prescriptions', label: 'Prescriptions' },
                ]}
                active={section}
                onChange={(v) => setSection(v as Section)}
              />

              <div className="mt-3">
                {section === 'overview' && (
                  <OverviewSection records={records} patient={selected} />
                )}
                {section === 'history' && <HistorySection records={records} />}
                {section === 'consultations' && (
                  <ConsultationsSection consultations={sortedConsultations} />
                )}
                {section === 'diagnoses' && (
                  <DiagnosesSection consultations={sortedConsultations} />
                )}
                {section === 'prescriptions' && (
                  <PrescriptionsSection prescriptions={sortedPrescriptions} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function OverviewSection({ records, patient }: { records: MedicalRecord[]; patient: Patient }) {
  return (
    <Card padded>
      <h3 className="card-title" style={{ marginTop: 0 }}>
        Medical Record Summary
      </h3>
      {records.length === 0 ? (
        <EmptyState title="No medical records" hint="Records added by the staff appear here." />
      ) : (
        <div className="flex-column gap-3" style={{ gap: 12 }}>
          {records.map((r) => (
            <div key={r.id} className="dp-record-item">
              <div className="flex justify-between align-center" style={{ gap: 10 }}>
                <strong>{r.type}</strong>
                <span className="muted text-xs">{fmtDate(r.date)}</span>
              </div>
              {r.diagnosis && <p className="text-sm mt-2" style={{ marginTop: 4 }}>{r.diagnosis}</p>}
              <p className="muted text-sm" style={{ marginTop: 4 }}>
                {r.notes}
              </p>
              <div className="flex gap-2 mt-2 align-center" style={{ gap: 6 }}>
                <StatusBadge status={r.status} />
                <span className="muted text-xs">by {r.doctor}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="dp-kv mt-4">
        <div>
          <span>Blood Group</span>
          <strong>{patient.bloodGroup || '-'}</strong>
        </div>
        <div>
          <span>Insurance</span>
          <strong>{patient.insurance || '-'}</strong>
        </div>
        <div>
          <span>Emergency Contact</span>
          <strong>{patient.emergencyContact || '-'}</strong>
        </div>
      </div>
    </Card>
  )
}

function HistorySection({ records }: { records: MedicalRecord[] }) {
  return (
    <Card padded>
      <h3 className="card-title" style={{ marginTop: 0 }}>
        History
      </h3>
      {records.length === 0 ? (
        <EmptyState title="No history records" />
      ) : (
        <div className="flex-column gap-3" style={{ gap: 12 }}>
          {records.map((r) => (
            <div key={r.id} className="dp-record-item">
              <div className="flex justify-between align-center" style={{ gap: 10 }}>
                <strong>{r.type}</strong>
                <span className="muted text-xs">{fmtDate(r.date)}</span>
              </div>
              {r.diagnosis && <p className="text-sm mt-2" style={{ marginTop: 4 }}>{r.diagnosis}</p>}
              <p className="muted text-sm" style={{ marginTop: 4 }}>
                {r.notes}
              </p>
              <div className="flex gap-2 mt-2 align-center" style={{ gap: 6 }}>
                <StatusBadge status={r.status} />
                <span className="muted text-xs">by {r.doctor}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function ConsultationsSection({ consultations }: { consultations: Consultation[] }) {
  if (consultations.length === 0) {
    return <EmptyState title="No consultations yet" hint="Complete a consultation to record it here." />
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
    return <EmptyState title="No diagnoses yet" hint="Diagnoses from your consultations appear here." />
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
    return <EmptyState title="No prescriptions yet" hint="Prescriptions you have issued appear here." />
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
