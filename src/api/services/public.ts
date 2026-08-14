// ============================================================
// Medicore HMS — Public booking service (no auth required)
// Used by the public "Book an Appointment" page.
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http, USE_MOCK_API } from '../client'
import { mockDelay } from '../mock'
import { store } from '../store'
import { createPatient } from './patients'
import { createAppointment } from './appointments'
import { getAvailabilitySlots, isWorkingDay, dayOfWeek } from '../availability'
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
  if (USE_MOCK_API) {
    await mockDelay()
    return store.doctors
      .filter((d) => d.status === 'Active')
      .map((d) => ({
        id: d.id,
        name: d.name,
        department: d.department,
        specialty: d.specialty,
        consultationFee: d.consultationFee,
        schedule: d.schedule,
      }))
  }
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
  if (USE_MOCK_API) {
    await mockDelay(350)
    const doctor = store.doctors.find((d) => d.id === doctorId)
    if (!doctor) throw new Error('Doctor not found')
    const appointments = store.appointments.filter(
      (a) => a.doctorId === doctorId && a.date === date && a.status !== 'Cancelled',
    )
    return {
      date,
      workingDay: isWorkingDay(doctor, date),
      doctorStatus: doctor.status,
      slots: getAvailabilitySlots(doctor, appointments, date),
    }
  }
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
  if (USE_MOCK_API) {
    await mockDelay(350)
    const doctor = store.doctors.find((d) => d.id === doctorId)
    if (!doctor) throw new Error('Doctor not found')
    const [y, m] = month.split('-').map(Number)
    const dayCount = new Date(y ?? new Date().getFullYear(), (m ?? 1), 0).getDate()
    const now = new Date()
    const todayIso =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-` +
      `${String(now.getDate()).padStart(2, '0')}`
    const days: Record<string, DayAvailability> = {}
    for (let d = 1; d <= dayCount; d++) {
      const iso = `${month}-${String(d).padStart(2, '0')}`
      if (iso < todayIso) continue
      if (!doctor.schedule.includes(dayOfWeek(iso))) {
        days[iso] = 'off'
        continue
      }
      const appts = store.appointments.filter(
        (a) => a.doctorId === doctorId && a.date === iso && a.status !== 'Cancelled',
      )
      const slots = getAvailabilitySlots(doctor, appts, iso)
      days[iso] = slots.some((s) => s.available) ? 'available' : 'booked'
    }
    return { month, days }
  }
  return http.get<PublicMonthAvailability>(
    withParams(ENDPOINTS.PUBLIC_DOCTOR_AVAILABILITY_MONTH, { id: doctorId }),
    { params: { month, hospital }, auth: false },
  )
}

export async function initiateBookingPayment(
  input: PublicBookingInput,
): Promise<PublicPaymentInitiation> {
  if (USE_MOCK_API) {
    await mockDelay(600)
    const doctor = store.doctors.find((d) => d.id === input.doctorId)
    if (!doctor) throw new Error('Doctor not found')
    if (doctor.status !== 'Active') {
      throw new Error(
        `This doctor is currently ${doctor.status.toLowerCase()} and cannot accept new bookings. Please choose another doctor.`,
      )
    }
    const appointments = store.appointments.filter(
      (a) => a.doctorId === input.doctorId && a.date === input.date && a.status !== 'Cancelled',
    )
    const slot = getAvailabilitySlots(doctor, appointments, input.date).find(
      (s) => s.time === input.time,
    )
    if (!slot || !slot.available) {
      throw new Error('This time slot is already booked — please choose a different time')
    }
    const patient = await createPatient({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      dob: input.dob,
      gender: input.gender,
      bloodGroup: '',
      address: input.address,
      emergencyContact: '',
      department: doctor?.department ?? 'General',
      assignedDoctorId: input.doctorId,
      insurance: '',
      allergies: [],
    })
    await createAppointment({
      patientId: patient.id,
      doctorId: input.doctorId,
      type: input.type,
      date: input.date,
      time: input.time,
      durationMin: input.durationMin,
      reason: input.reason,
    })
    // Mock mode has no gateway — treat the payment as completed instantly.
    return {
      attemptId: `mock-${Date.now()}`,
      transactionUuid: `mock-${Date.now()}`,
      amount: doctor.consultationFee,
      formUrl: '',
      fields: {},
    }
  }
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
  if (USE_MOCK_API) {
    await mockDelay(400)
    return { status: 'pending' }
  }
  return http.post<ReconcileResult>(ENDPOINTS.PUBLIC_PAYMENT_RECONCILE, input, {
    auth: false,
  })
}
