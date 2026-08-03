// ============================================================
// HealSync HMS — Patient Portal: prescriptions
// ============================================================

import { ENDPOINTS, withParams } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay } from '../../mock'
import { store } from '../../store'
import type { Prescription } from '../../../types'

export async function listMyPrescriptions(patientId: string): Promise<Prescription[]> {
  if (USE_MOCK_API) {
    await mockDelay()
    return store.prescriptions
      .filter((p) => p.patientId === patientId)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  }
  return http.get<Prescription[]>(ENDPOINTS.PORTAL_PRESCRIPTIONS, { params: { patientId } })
}

function prescriptionToText(rx: Prescription): string {
  const lines = [
    'HEALSYNC HOSPITAL',
    'Prescription',
    '----------------------------',
    `Patient: ${rx.patientName}`,
    `Doctor: ${rx.doctorName}`,
    `Issued: ${rx.issuedAt}`,
    `Status: ${rx.status}`,
    '',
    'Medicines:',
    ...rx.medicines.map(
      (m) => `  - ${m.name} | ${m.dosage} | ${m.frequency} | ${m.durationDays} days`,
    ),
    '',
    'This is a computer-generated prescription.',
  ]
  return lines.join('\n')
}

export async function downloadPrescriptionPdf(rx: Prescription): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    const blob = new Blob([prescriptionToText(rx)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Prescription-${rx.id}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    return
  }
  const resp = await fetch(withParams(ENDPOINTS.PORTAL_PRESCRIPTION_DOWNLOAD, { id: rx.id }))
  const blob = await resp.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Prescription-${rx.id}.pdf`
  a.click()
}
