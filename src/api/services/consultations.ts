// ============================================================
// HealSync HMS — Admin clinical oversight (consultations)
// Read-only access to every doctor's consultations + prescriptions.
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
import type { Consultation } from '../../types'

export interface ConsultationQuery {
  search?: string
  doctorId?: string
  patientId?: string
  from?: string
  to?: string
}

export async function listAllConsultations(q: ConsultationQuery = {}): Promise<Consultation[]> {
  return http.get<Consultation[]>(ENDPOINTS.CONSULTATIONS, { params: { ...q } })
}

export async function getConsultationDetail(id: string): Promise<Consultation> {
  return http.get<Consultation>(withParams(ENDPOINTS.CONSULTATION_DETAIL, { id }))
}
