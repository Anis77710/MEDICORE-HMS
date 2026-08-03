// ============================================================
// HealSync HMS — Patient Portal: reviews & ratings
// ============================================================

import { ENDPOINTS, withParams } from '../../endpoints'
import { http, USE_MOCK_API } from '../../client'
import { mockDelay } from '../../mock'
import { mockReviews } from '../../mockPortal'
import { store } from '../../store'
import type { DoctorReview, ReviewInput } from '../../../types/portal'

let reviews: DoctorReview[] = [...mockReviews]

export async function listDoctorReviews(doctorId: string): Promise<DoctorReview[]> {
  if (USE_MOCK_API) {
    await mockDelay(350)
    return reviews
      .filter((r) => r.doctorId === doctorId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return http.get<DoctorReview[]>(withParams(ENDPOINTS.PORTAL_DOCTOR_REVIEWS, { id: doctorId }))
}

export async function listMyReviews(patientId: string): Promise<DoctorReview[]> {
  if (USE_MOCK_API) {
    await mockDelay(300)
    return reviews
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return http.get<DoctorReview[]>(ENDPOINTS.PORTAL_REVIEWS, { params: { patientId } })
}

export async function createReview(
  patientId: string,
  patientName: string,
  input: ReviewInput,
): Promise<DoctorReview> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    const review: DoctorReview = {
      id: `rev-${Date.now()}`,
      doctorId: input.doctorId,
      patientId,
      patientName,
      rating: input.rating,
      comment: input.comment,
      visitDate: input.visitDate,
      createdAt: new Date().toISOString(),
    }
    reviews = [review, ...reviews]
    const doctor = store.doctors.find((d) => d.id === input.doctorId)
    if (doctor) {
      const total = doctor.rating * 40 + input.rating
      doctor.rating = Math.round((total / 41) * 10) / 10
    }
    return review
  }
  return http.post<DoctorReview>(ENDPOINTS.PORTAL_REVIEWS, { ...input, patientId })
}

export async function updateReview(id: string, input: ReviewInput): Promise<DoctorReview> {
  if (USE_MOCK_API) {
    await mockDelay(500)
    const idx = reviews.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error('Review not found')
    reviews[idx] = { ...reviews[idx], rating: input.rating, comment: input.comment }
    return reviews[idx]
  }
  return http.put<DoctorReview>(withParams(ENDPOINTS.PORTAL_REVIEW_DETAIL, { id }), input)
}

export async function deleteReview(id: string): Promise<void> {
  if (USE_MOCK_API) {
    await mockDelay(400)
    reviews = reviews.filter((r) => r.id !== id)
    return
  }
  await http.delete(withParams(ENDPOINTS.PORTAL_REVIEW_DETAIL, { id }))
}
