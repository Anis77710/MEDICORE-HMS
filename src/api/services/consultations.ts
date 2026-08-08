// ============================================================
// HealSync HMS — Admin clinical oversight (consultations)
// Read-only access to every doctor's consultations + prescriptions.
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay } from '../mock'
import { store } from '../store'
import type { Consultation } from '../../types'

export interface ConsultationQuery {
  search?: string
  doctorId?: string
  patientId?: string
  from?: string
  to?: string
}

export async function listAllConsultations(q: ConsultationQuery = {}): Promise<Consultation[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    let list = [...store.consultations]
    if (q.doctorId) list = list.filter((c) => c.doctorId === q.doctorId)
    if (q.patientId) list = list.filter((c) => c.patientId === q.patientId)
    if (q.search) {
      const s = q.search.toLowerCase()
      list = list.filter(
        (c) =>
          c.patientName.toLowerCase().includes(s) ||
          c.doctorName.toLowerCase().includes(s) ||
          c.chiefComplaint.toLowerCase().includes(s) ||
          c.diagnosis.primary.toLowerCase().includes(s),
      )
    }
    if (q.from || q.to) {
      list = list.filter((c) => {
        const ts = c.createdAt.slice(0, 10)
        return (!q.from || ts >= q.from) && (!q.to || ts <= q.to)
      })
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return http.get<Consultation[]>(ENDPOINTS.CONSULTATIONS, { params: { ...q } })
}

export async function getConsultationDetail(id: string): Promise<Consultation> {
  if (USE_MOCK_API) {
    await mockDelay(350)
    const c = store.consultations.find((x) => x.id === id)
    if (!c) throw new Error('Consultation not found')
    const prescription = c.prescriptionId
      ? store.prescriptions.find((rx) => rx.id === c.prescriptionId) ?? null
      : null
    return { ...c, prescription }
  }
  return http.get<Consultation>(withParams(ENDPOINTS.CONSULTATION_DETAIL, { id }))
}
