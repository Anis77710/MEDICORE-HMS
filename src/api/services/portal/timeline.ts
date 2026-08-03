// ============================================================
// HealSync HMS — Patient Portal: health timeline & search
// ============================================================

import { ENDPOINTS } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay } from '../../mock'
import { store } from '../../store'
import { mockMedicalRecords } from '../../mock'
import type {
  PortalSearchResults,
  TimelineEvent,
} from '../../../types/portal'

// ---------- Timeline ----------

export async function getHealthTimeline(patientId: string): Promise<TimelineEvent[]> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    const events: TimelineEvent[] = []

    store.appointments
      .filter((a) => a.patientId === patientId)
      .forEach((a) =>
        events.push({
          id: `tl-apt-${a.id}`,
          type: 'appointment',
          date: a.date,
          title: `${a.type} appointment`,
          description: `${a.reason || 'Consultation'} with ${a.doctorName}`,
          doctorName: a.doctorName,
          meta: `${a.time} · ${a.status}`,
        }),
      )

    const records = mockMedicalRecords[patientId as keyof typeof mockMedicalRecords] ?? []
    records.forEach((r) =>
      events.push({
        id: `tl-rec-${r.id}`,
        type: r.type === 'Lab Test' ? 'report' : r.type === 'Admission' ? 'treatment' : 'diagnosis',
        date: r.date,
        title: r.type,
        description: r.diagnosis,
        doctorName: r.doctor,
        meta: r.status,
      }),
    )

    store.prescriptions
      .filter((p) => p.patientId === patientId)
      .forEach((rx) =>
        events.push({
          id: `tl-rx-${rx.id}`,
          type: 'prescription',
          date: rx.issuedAt,
          title: `Prescription (${rx.medicines.length} medicines)`,
          description: rx.medicines.map((m) => m.name).join(', '),
          doctorName: rx.doctorName,
          meta: rx.status,
        }),
      )

    return events.sort((a, b) => b.date.localeCompare(a.date))
  }
  return http.get<TimelineEvent[]>(ENDPOINTS.PORTAL_TIMELINE, { params: { patientId } })
}

// ---------- Global search ----------

export async function portalSearch(patientId: string, query: string): Promise<PortalSearchResults> {
  const empty: PortalSearchResults = { doctors: [], appointments: [], prescriptions: [], reports: [] }
  if (!query.trim()) return empty

  if (USE_MOCK_API) {
    await mockDelay(400)
    const s = query.toLowerCase()

    const doctors = store.doctors
      .filter(
        (d) =>
          d.name.toLowerCase().includes(s) ||
          d.specialty.toLowerCase().includes(s) ||
          d.department.toLowerCase().includes(s),
      )
      .map((d) => ({ id: d.id, name: d.name, department: d.department, specialty: d.specialty }))
      .slice(0, 5)

    const appointments = store.appointments
      .filter(
        (a) =>
          a.patientId === patientId &&
          (a.doctorName.toLowerCase().includes(s) ||
            a.department.toLowerCase().includes(s) ||
            a.reason.toLowerCase().includes(s) ||
            a.date.includes(s)),
      )
      .map((a) => ({
        id: a.id,
        title: `${a.type} · ${a.doctorName}`,
        date: a.date,
        time: a.time,
        status: a.status,
      }))
      .slice(0, 5)

    const prescriptions = store.prescriptions
      .filter(
        (p) =>
          p.patientId === patientId &&
          (p.doctorName.toLowerCase().includes(s) ||
            p.medicines.some((m) => m.name.toLowerCase().includes(s))),
      )
      .map((p) => ({ id: p.id, title: p.doctorName, issuedAt: p.issuedAt, status: p.status }))
      .slice(0, 5)

    const records = mockMedicalRecords[patientId as keyof typeof mockMedicalRecords] ?? []
    const reports = records
      .filter(
        (r) =>
          r.diagnosis.toLowerCase().includes(s) ||
          r.type.toLowerCase().includes(s) ||
          r.doctor.toLowerCase().includes(s),
      )
      .map((r) => ({ id: r.id, title: `${r.type} — ${r.diagnosis}`, date: r.date }))
      .slice(0, 5)

    return { doctors, appointments, prescriptions, reports }
  }
  return http.get<PortalSearchResults>(ENDPOINTS.PORTAL_SEARCH, { params: { query } })
}
