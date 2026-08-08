// ============================================================
// Medicore HMS — Domain types
// These mirror the backend API contract (REST/JSON).
// ============================================================

export type Role = 'ADMIN' | 'DOCTOR' | 'NURSE' | 'STAFF' | 'PATIENT'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl?: string
  phone?: string
  department?: string
}

export interface AuthResponse {
  user: User
  token: string
}

// ---------- Patients ----------
export type PatientStatus = 'Admitted' | 'Outpatient' | 'Critical' | 'Recovered' | 'Pending'
export type Gender = 'Male' | 'Female' | 'Other'

export interface Patient {
  id: string
  patientId: string // e.g. P-10432
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  gender: Gender
  bloodGroup: string
  address: string
  emergencyContact: string
  status: PatientStatus
  department: string
  assignedDoctorId: string
  admittedAt?: string
  lastVisit: string
  allergies: string[]
  insurance: string
  notes?: string
}

export interface PatientCreateInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  gender: Gender
  bloodGroup: string
  address: string
  emergencyContact: string
  department: string
  assignedDoctorId: string
  insurance: string
  allergies: string[]
}

// ---------- Doctors ----------
export interface Doctor {
  id: string
  name: string
  email: string
  phone: string
  department: string
  specialty: string
  qualification: string
  experienceYears: number
  consultationFee: number
  schedule: string[]
  patientsCount: number
  rating: number
  status: 'Active' | 'On Leave' | 'Unavailable'
}

// ---------- Appointments ----------
export type AppointmentStatus = 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled'
export type AppointmentType = 'Checkup' | 'Consultation' | 'Follow-up' | 'Emergency' | 'Procedure'

export interface Appointment {
  id: string
  patientId: string
  patientName: string
  patientAvatar?: string
  doctorId: string
  doctorName: string
  department: string
  type: AppointmentType
  date: string // YYYY-MM-DD
  time: string // HH:mm
  durationMin: number
  status: AppointmentStatus
  reason: string
  createdAt: string
}

export interface AppointmentCreateInput {
  patientId: string
  doctorId: string
  type: AppointmentType
  date: string
  time: string
  durationMin: number
  reason: string
}

// ---------- Departments ----------
export interface Department {
  id: string
  name: string
  headDoctorId: string
  headDoctorName: string
  bedCount: number
  occupiedBeds: number
  doctorsCount: number
  patientsCount: number
  color: string
  icon: string
  description: string
}

// ---------- Pharmacy ----------
export interface Medicine {
  id: string
  name: string
  genericName: string
  category: string
  manufacturer: string
  price: number
  stock: number
  reorderLevel: number
  expiryDate: string
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expiring Soon'
  batch: string
}

export interface Prescription {
  id: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  medicines: { name: string; dosage: string; frequency: string; durationDays: number }[]
  issuedAt: string
  status: 'Active' | 'Completed'
}

// ---------- Billing ----------
export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Refunded'

export interface Invoice {
  id: string
  invoiceNo: string
  patientId: string
  patientName: string
  description: string
  items: { description: string; amount: number }[]
  subtotal: number
  discount: number
  tax: number
  total: number
  amountPaid: number
  status: InvoiceStatus
  issuedAt: string
  dueDate: string
}

export interface PaymentRecord {
  id: string
  invoiceId: string
  amount: number
  method: 'Card' | 'Cash' | 'Bank Transfer' | 'Insurance' | 'UPI'
  reference: string
  paidAt: string
}

// ---------- Staff ----------
export interface StaffMember {
  id: string
  name: string
  email: string
  phone: string
  role: Role
  department: string
  shift: 'Morning' | 'Evening' | 'Night' | 'Rotating'
  joinedAt: string
  salary: number
  status: 'Active' | 'On Leave' | 'Resigned'
}

// ---------- Dashboard ----------
export interface DashboardStats {
  totalPatients: number
  patientsChange: number
  appointmentsToday: number
  appointmentsChange: number
  bedOccupancy: number
  bedOccupancyChange: number
  revenueMonth: number
  revenueChange: number
  admissionsTrend: { month: string; admissions: number; discharges: number }[]
  departmentWorkload: { department: string; patients: number }[]
  appointmentStatus: { status: AppointmentStatus; count: number }[]
  upcomingAppointments: Appointment[]
  recentActivity: ActivityEvent[]
  departmentOccupancy: { department: string; occupied: number; capacity: number }[]
}

export interface ActivityEvent {
  id: string
  type: 'admission' | 'discharge' | 'lab' | 'prescription' | 'payment' | 'appointment'
  message: string
  time: string
  actor: string
}

// ---------- Reports ----------
export interface ReportSummary {
  period: string
  totalRevenue: number
  totalAppointments: number
  newPatients: number
  avgWaitTimeMin: number
  reportList: ReportItem[]
}

export interface ReportItem {
  id: string
  name: string
  type: 'Revenue' | 'Clinical' | 'Operations' | 'Patient Care'
  period: string
  generatedAt: string
  format: 'PDF' | 'XLSX' | 'CSV'
  size: string
}
