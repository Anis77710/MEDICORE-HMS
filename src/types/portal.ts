// ============================================================
// HealSync HMS — Patient Portal types
// Portal-specific domain types. Optional extensions to shared
// types (Doctor, Appointment) live here so the admin side stays
// untouched.
// ============================================================

// ---------- Extensions to shared types ----------
export interface DoctorPortalFields {
  bio?: string
  photo?: string
  languages?: string[]
  ratingCount?: number
}

export interface AppointmentPortalFields {
  meetingUrl?: string
  mode?: 'In-person' | 'Video'
}

// ---------- Notifications ----------
export type PortalNotificationType =
  | 'appointment_confirmation'
  | 'appointment_reminder'
  | 'schedule_change'
  | 'report_available'
  | 'prescription_update'
  | 'billing'
  | 'announcement'

export interface PortalNotification {
  id: string
  type: PortalNotificationType
  title: string
  message: string
  read: boolean
  createdAt: string // ISO datetime
  link?: string // portal route
}

// ---------- Reviews ----------
export interface DoctorReview {
  id: string
  doctorId: string
  patientId: string
  patientName: string
  rating: number // 1..5
  comment: string
  visitDate: string
  createdAt: string
}

export interface ReviewInput {
  doctorId: string
  rating: number
  comment: string
  visitDate: string
}

// ---------- Availability ----------
export interface TimeSlot {
  time: string // HH:mm
  available: boolean
}

export interface DoctorAvailability {
  date: string // YYYY-MM-DD
  day: string // e.g. Mon
  slots: TimeSlot[]
}

// ---------- Health timeline ----------
export type TimelineEventType =
  | 'appointment'
  | 'diagnosis'
  | 'prescription'
  | 'report'
  | 'treatment'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  date: string
  title: string
  description: string
  doctorName?: string
  meta?: string
}

// ---------- Global search ----------
export interface PortalSearchResults {
  doctors: { id: string; name: string; department: string; specialty: string }[]
  appointments: { id: string; title: string; date: string; time: string; status: string }[]
  prescriptions: { id: string; title: string; issuedAt: string; status: string }[]
  reports: { id: string; title: string; date: string }[]
}

// ---------- Profile ----------
export interface PatientProfileInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  gender: 'Male' | 'Female' | 'Other'
  bloodGroup: string
  address: string
  emergencyContact: string
  insurance: string
  allergies: string[]
  avatarUrl?: string
}

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

export interface PaymentSummary {
  totalBilled: number
  totalPaid: number
  outstanding: number
  paymentHistory: {
    id: string
    invoiceNo: string
    amount: number
    method: string
    paidAt: string
    reference: string
  }[]
}
