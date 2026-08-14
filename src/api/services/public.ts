// ============================================================
// Medicore HMS — Public booking service (no auth required)
// Used by the public "Book an Appointment" page.
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
import type {
  AppointmentType,
  AvailabilitySlot,
  DoctorStatus,
  PublicPaymentInitiation,
} from '../../types'

export interface PublicDoctor {
  id: string
  name: string
  department: string
  specialty: string
  consultationFee: number
  schedule: string[]
}

export interface PublicBookingInput {
  hospital?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  gender: 'Male' | 'Female' | 'Other'
  address: string
  doctorId: string
  type: AppointmentType
  date: string
  time: string
  durationMin: number
  reason: string
}

export async function listPublicDoctors(hospital?: string): Promise<PublicDoctor[]> {
  return http.get<PublicDoctor[]>(ENDPOINTS.PUBLIC_DOCTORS, {
    auth: false,
    params: { hospital },
  })
}

export interface PublicAvailability {
  date: string
  workingDay: boolean
  doctorStatus: DoctorStatus
  slots: AvailabilitySlot[]
}

export async function getPublicAvailability(
  doctorId: string,
  date: string,
  hospital?: string,
): Promise<PublicAvailability> {
  return http.get<PublicAvailability>(
    withParams(ENDPOINTS.PUBLIC_DOCTOR_AVAILABILITY, { id: doctorId }),
    { params: { date, hospital }, auth: false },
  )
}

export type DayAvailability = 'off' | 'available' | 'booked'

export interface PublicMonthAvailability {
  month: string
  days: Record<string, DayAvailability>
}

export async function getPublicMonthAvailability(
  doctorId: string,
  month: string,
  hospital?: string,
): Promise<PublicMonthAvailability> {
  return http.get<PublicMonthAvailability>(
    withParams(ENDPOINTS.PUBLIC_DOCTOR_AVAILABILITY_MONTH, { id: doctorId }),
    { params: { month, hospital }, auth: false },
  )
}

export async function initiateBookingPayment(
  input: PublicBookingInput,
): Promise<PublicPaymentInitiation> {
  return http.post<PublicPaymentInitiation>(ENDPOINTS.PUBLIC_PAYMENT_INITIATE, input, {
    auth: false,
  })
}

export interface ReconcileResult {
  status: 'success' | 'pending' | 'failed'
  appointmentNo?: string
}

/**
 * Re-checks a pending payment attempt against eSewa's transaction status API.
 * The frontend calls this when the user returns from the eSewa hop without a
 * confirmed callback — if eSewa says the payment was COMPLETE, the booking is
 * created server-side and the user sees a success screen instead of a dead end.
 */
export async function reconcileBookingPayment(input: {
  attemptId: string
  hospital?: string
}): Promise<ReconcileResult> {
  return http.post<ReconcileResult>(ENDPOINTS.PUBLIC_PAYMENT_RECONCILE, input, {
    auth: false,
  })
}
