// ============================================================
// Medicore HMS - Doctor Portal service
// Doctor-scoped clinical data. Real API: /doctor-portal/*
// The logged-in doctor is always resolved server-side, so a doctor
// can never address another doctor's records through this service.
// ============================================================

import { ENDPOINTS, withParams } from '../endpoints'
import { http } from '../client'
import type {
  Appointment,
  Consultation,
  ConsultationCreateInput,
  Doctor,
  DoctorPrescriptionCreateInput,
  Patient,
  Prescription,
} from '../../types'

export async function getDoctorProfile(): Promise<Doctor> {
  return http.get<Doctor>(ENDPOINTS.DOCTOR_ME)
}

export async function setMyStatus(status: Doctor['status']): Promise<Doctor> {
  return http.patch<Doctor>(ENDPOINTS.DOCTOR_ME_STATUS, { status })
}

export interface DoctorPatientQuery {
  search?: string
  status?: string
}

export async function getMyPatients(q: DoctorPatientQuery = {}): Promise<Patient[]> {
  return http.get<Patient[]>(ENDPOINTS.DOCTOR_PATIENTS, { params: { ...q } })
}

export interface DoctorAppointmentQuery {
  date?: string
  status?: string
  search?: string
}

export async function getMyAppointments(q: DoctorAppointmentQuery = {}): Promise<Appointment[]> {
  return http.get<Appointment[]>(ENDPOINTS.DOCTOR_APPOINTMENTS, { params: { ...q } })
}

export async function confirmAppointment(id: string): Promise<Appointment> {
  return http.post<Appointment>(withParams(ENDPOINTS.DOCTOR_APPOINTMENT_CONFIRM, { id }))
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  return http.post<Appointment>(withParams(ENDPOINTS.DOCTOR_APPOINTMENT_CANCEL, { id }))
}

export interface RescheduleAppointmentInput {
  date: string
  time: string
  durationMin?: number
  reason: string
  note?: string
}

export async function rescheduleAppointment(
  id: string,
  input: RescheduleAppointmentInput,
): Promise<Appointment> {
  return http.post<Appointment>(withParams(ENDPOINTS.DOCTOR_APPOINTMENT_RESCHEDULE, { id }), input)
}

export async function listConsultations(q: { patientId?: string } = {}): Promise<Consultation[]> {
  return http.get<Consultation[]>(ENDPOINTS.DOCTOR_CONSULTATIONS, { params: { ...q } })
}

export async function getConsultation(id: string): Promise<Consultation> {
  return http.get<Consultation>(withParams(ENDPOINTS.DOCTOR_CONSULTATION, { id }))
}

export async function createConsultation(input: ConsultationCreateInput): Promise<Consultation> {
  return http.post<Consultation>(ENDPOINTS.DOCTOR_CONSULTATIONS, input)
}

export async function savePrescription(input: DoctorPrescriptionCreateInput): Promise<Prescription> {
  return http.post<Prescription>(ENDPOINTS.DOCTOR_PRESCRIPTIONS, input)
}

export async function listMyPrescriptions(): Promise<Prescription[]> {
  return http.get<Prescription[]>(ENDPOINTS.DOCTOR_PRESCRIPTIONS)
}