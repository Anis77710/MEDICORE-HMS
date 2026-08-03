// ============================================================
// HealSync HMS — Patient Portal: medical records & reports
// ============================================================

import { ENDPOINTS, withParams } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay } from '../../mock'
import { mockMedicalRecords, mockDocuments } from '../../mock'

export interface MedicalRecord {
  id: string
  date: string
  type: string
  diagnosis: string
  doctor: string
  notes: string
  status: string
}

export interface PatientDocument {
  id: string
  name: string
  type: string
  size: string
  date: string
  uploadedBy: string
}

export async function listMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    const rows = mockMedicalRecords[patientId as keyof typeof mockMedicalRecords] ?? []
    return [...rows].sort((a, b) => b.date.localeCompare(a.date))
  }
  return http.get<MedicalRecord[]>(
    withParams(ENDPOINTS.PATIENT_MEDICAL_RECORDS, { id: patientId }),
  )
}

export async function listPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    const rows = mockDocuments[patientId as keyof typeof mockDocuments] ?? []
    return [...rows].sort((a, b) => b.date.localeCompare(a.date))
  }
  return http.get<PatientDocument[]>(withParams(ENDPOINTS.PATIENT_DOCUMENTS, { id: patientId }))
}

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

export async function downloadReport(doc: PatientDocument): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    downloadBlob(
      `HealSync Medical Report\n\nFile: ${doc.name}\nUploaded: ${doc.date} by ${doc.uploadedBy}\n\n(This is a placeholder download — wire it to the real backend endpoint for production files.)`,
      doc.name.replace(/\.[^.]+$/, '') + '.txt',
      'text/plain',
    )
    return
  }
  const url = `${http.get as unknown as string}` // placeholder; real impl below
  void url
  const resp = await fetch(withParams(ENDPOINTS.PORTAL_REPORT_DOWNLOAD, { id: doc.id }))
  const blob = await resp.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = doc.name
  a.click()
}

export async function searchMedicalRecords(
  patientId: string,
  query: string,
): Promise<MedicalRecord[]> {
  const all = await listMedicalRecords(patientId)
  if (!query) return all
  const s = query.toLowerCase()
  return all.filter(
    (r) =>
      r.diagnosis.toLowerCase().includes(s) ||
      r.type.toLowerCase().includes(s) ||
      r.doctor.toLowerCase().includes(s) ||
      r.notes.toLowerCase().includes(s),
  )
}
