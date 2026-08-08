import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  HeartPulse,
  Gauge,
  Thermometer,
  Droplets,
  Phone,
  Mail,
  MapPin,
  Droplet,
  AlertTriangle,
  Pencil,
  CalendarPlus,
  FileText,
  UserPlus,
} from 'lucide-react'
import { getPatient, getMedicalRecords, getPatientDocuments } from '../../api/services/patients'
import type { MedicalRecord, PatientDocument } from '../../api/services/patients'
import { listAppointments } from '../../api/services/appointments'
import { listInvoices } from '../../api/services/billing'
import { listPrescriptions } from '../../api/services/pharmacy'
import type {
  Appointment,
  Invoice,
  Patient,
  Prescription,
} from '../../types'
import {
  Card,
  Avatar,
  Badge,
  Spinner,
  EmptyState,
  Tabs,
  Button,
  StatusBadge,
  PageHeader,
} from '../../components/ui'
import { usePermissions } from '../../rbac/usePermissions'

type TabKey = 'overview' | 'records' | 'prescriptions' | 'appointments' | 'billing' | 'documents'

// Stable reference for age calculation (module level = stable across renders)
const REFERENCE_TIME = Date.now()

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const { can } = usePermissions()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [tab, setTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      getPatient(id),
      getMedicalRecords(id),
      listAppointments({ search: undefined }),
      listInvoices({}),
      listPrescriptions({}),
      getPatientDocuments(id),
    ])
      .then(([p, rec, appts, invs, rxs, docs]) => {
        if (cancelled) return
        setPatient(p)
        setRecords(rec)
        setAppointments(appts.filter((a) => a.patientId === p.id))
        setInvoices(invs.filter((i) => i.patientId === p.id))
        setPrescriptions(rxs.filter((r) => r.patientId === p.id))
        setDocuments(docs)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load patient')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <Spinner label="Loading patient…" />
  if (error || !patient)
    return (
      <EmptyState title="Patient not found" hint={error || 'The patient may have been removed.'} />
    )

  const age = Math.floor((REFERENCE_TIME - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))

  const vitals = [
    { icon: <Gauge size={19} />, label: 'Blood Pressure', value: '120/80', unit: 'mmHg', tone: 'teal' },
    { icon: <HeartPulse size={19} />, label: 'Heart Rate', value: '72', unit: 'bpm', tone: 'red' },
    { icon: <Thermometer size={19} />, label: 'Temperature', value: '36.8', unit: '°C', tone: 'amber' },
    { icon: <Droplets size={19} />, label: 'Oxygen Saturation', value: '98', unit: '%', tone: 'green' },
  ]

  const totalBilled = invoices.reduce((s, i) => s + i.total, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.amountPaid, 0)

  return (
    <>
      <PageHeader
        title={
          <>
            <span className="muted font-semibold" style={{ fontSize: 14 }}>
              Patients /{' '}
            </span>
            {patient.firstName} {patient.lastName}
          </>
        }
        subtitle={`${patient.patientId} · ${age} years · ${patient.gender} · Blood ${patient.bloodGroup}`}
        actions={
          <>
            {can('appointments', 'create') && (
              <Link to="/appointments" className="btn btn-outline">
                <CalendarPlus size={16} /> New Appointment
              </Link>
            )}
            {can('patients', 'edit') && (
              <Link to="/patients" className="btn btn-primary">
                <Pencil size={16} /> Edit Profile
              </Link>
            )}
          </>
        }
      />

      <Card padded className="mb-4">
        <div className="patient-hero">
          <Avatar name={`${patient.firstName} ${patient.lastName}`} size="xl" />
          <div className="patient-hero-info">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="patient-hero-name">
                {patient.firstName} {patient.lastName}
              </h2>
              <StatusBadge status={patient.status} />
            </div>
            <div className="patient-hero-meta">
              <span>
                <Phone size={14} /> {patient.phone}
              </span>
              <span>
                <Mail size={14} /> {patient.email}
              </span>
              <span>
                <MapPin size={14} /> {patient.address}
              </span>
            </div>
          </div>
          <div className="patient-hero-stats">
            <div>
              <strong>{patient.department}</strong>
              <span>Department</span>
            </div>
            <div>
              <strong>{patient.insurance}</strong>
              <span>Insurance</span>
            </div>
            <div>
              <strong>${totalBilled.toLocaleString()}</strong>
              <span>Total billed · ${totalPaid.toLocaleString()} paid</span>
            </div>
          </div>
        </div>
      </Card>

      {patient.allergies.length > 0 && (
        <div className="allergy-banner">
          <AlertTriangle size={17} />
          <div>
            <strong>Allergy alert:</strong> {patient.allergies.join(', ')}. Risk of severe reaction.
          </div>
        </div>
      )}

      <Tabs
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'records', label: 'Medical Records', count: records.length },
          { value: 'prescriptions', label: 'Prescriptions', count: prescriptions.length },
          { value: 'appointments', label: 'Appointments', count: appointments.length },
          { value: 'billing', label: 'Billing', count: invoices.length },
          { value: 'documents', label: 'Documents', count: documents.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {tab === 'overview' && (
          <div className="grid-2">
            <div className="grid-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {vitals.map((v) => (
                <Card key={v.label} padded className="vital-card">
                  <div className={`stat-icon stat-icon-${v.tone} mb-2`}>{v.icon}</div>
                  <div className="vital-label">{v.label}</div>
                  <div className="vital-value">
                    {v.value} <span>{v.unit}</span>
                  </div>
                </Card>
              ))}
            </div>

            <Card padded>
              <h3 className="card-title mb-2">Assigned Doctor</h3>
              <div className="doctor-mini">
                <Avatar name={`Dr. ${patient.assignedDoctorId}`} size="lg" />
                <div className="flex-1">
                  <strong>Dr. {patient.assignedDoctorId.replace('d-', '')}</strong>
                  <div className="muted text-sm">{patient.department}</div>
                </div>
                <Button variant="secondary" size="sm">
                  <UserPlus size={15} /> Message
                </Button>
              </div>
              <div className="card-divider" />
              <h3 className="card-title mb-2">Current Medications</h3>
              {prescriptions.filter((r) => r.status === 'Active').length === 0 ? (
                <p className="muted text-sm">No active medications.</p>
              ) : (
                prescriptions
                  .filter((r) => r.status === 'Active')
                  .flatMap((r) =>
                    r.medicines.map((m) => (
                      <div key={`${r.id}-${m.name}`} className="med-item">
                        <Droplet size={15} style={{ color: 'var(--primary)' }} />
                        <div className="flex-1">
                          <strong className="text-sm">{m.name}</strong>
                          <div className="muted text-xs">
                            {m.dosage} · {m.frequency} · {m.durationDays} days
                          </div>
                        </div>
                        <Badge tone="teal">{r.status}</Badge>
                      </div>
                    )),
                  )
              )}
            </Card>

            <Card padded>
              <h3 className="card-title mb-3">Medical History</h3>
              {records.length === 0 ? (
                <p className="muted text-sm">No records yet.</p>
              ) : (
                <div className="timeline">
                  {records.map((r) => (
                    <div key={r.id} className="timeline-item">
                      <span className="timeline-dot" style={{ background: 'var(--primary)' }} />
                      <div className="timeline-item-title">{r.diagnosis}</div>
                      <div className="timeline-item-time">
                        {r.date} · {r.doctor} · {r.type}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padded>
              <h3 className="card-title mb-2">Recent Lab Results</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Result</th>
                      <th>Range</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { t: 'Hemoglobin', v: '14.2 g/dL', r: '13–17', s: 'Normal' },
                      { t: 'WBC Count', v: '9,800 /µL', r: '4,000–11,000', s: 'Normal' },
                      { t: 'Platelets', v: '142,000 /µL', r: '150,000–450,000', s: 'Low' },
                      { t: 'LDL Cholesterol', v: '168 mg/dL', r: '<100', s: 'High' },
                    ].map((row) => (
                      <tr key={row.t}>
                        <td>{row.t}</td>
                        <td>{row.v}</td>
                        <td className="muted">{row.r}</td>
                        <td>
                          <Badge tone={row.s === 'Normal' ? 'green' : 'amber'}>{row.s}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {tab === 'records' && (
          <Card>
            {records.length === 0 ? (
              <EmptyState title="No medical records" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Diagnosis</th>
                      <th>Doctor</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id}>
                        <td>{r.date}</td>
                        <td>
                          <Badge tone="blue">{r.type}</Badge>
                        </td>
                        <td className="font-semibold">{r.diagnosis}</td>
                        <td>{r.doctor}</td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="muted">{r.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === 'prescriptions' && (
          <Card>
            {prescriptions.length === 0 ? (
              <EmptyState title="No prescriptions" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Issued</th>
                      <th>Doctor</th>
                      <th>Medicines</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescriptions.map((r) => (
                      <tr key={r.id}>
                        <td>{r.issuedAt}</td>
                        <td>{r.doctorName}</td>
                        <td>
                          {r.medicines.map((m) => (
                            <div key={m.name} className="text-sm">
                              <strong>{m.name}</strong> · {m.dosage}, {m.frequency}
                            </div>
                          ))}
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === 'appointments' && (
          <Card>
            {appointments.length === 0 ? (
              <EmptyState title="No appointments yet" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Doctor</th>
                      <th>Department</th>
                      <th>Type</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((a) => (
                      <tr key={a.id}>
                        <td>{a.date}</td>
                        <td>{a.time}</td>
                        <td>{a.doctorName}</td>
                        <td>{a.department}</td>
                        <td>{a.type}</td>
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
        )}

        {tab === 'billing' && (
          <Card>
            {invoices.length === 0 ? (
              <EmptyState title="No invoices" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Description</th>
                      <th>Issued</th>
                      <th>Due</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id}>
                        <td className="font-semibold">{i.invoiceNo}</td>
                        <td className="muted">{i.description}</td>
                        <td>{i.issuedAt}</td>
                        <td>{i.dueDate}</td>
                        <td className="font-semibold">${i.total.toLocaleString()}</td>
                        <td>${i.amountPaid.toLocaleString()}</td>
                        <td>
                          <StatusBadge status={i.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === 'documents' && (
          <Card>
            {documents.length === 0 ? (
              <EmptyState title="No documents" hint="Uploads will appear here." />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Uploaded</th>
                      <th>By</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <div className="cell-person">
                            <span className="doc-icon">
                              <FileText size={17} />
                            </span>
                            <strong>{d.name}</strong>
                          </div>
                        </td>
                        <td>
                          <Badge tone="gray">{d.type}</Badge>
                        </td>
                        <td className="muted">{d.size}</td>
                        <td className="muted">{d.date}</td>
                        <td className="muted">{d.uploadedBy}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Button variant="outline" size="sm">
                            Download
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  )
}
