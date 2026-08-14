// ============================================================
// HealSync HMS — API endpoint registry
// ------------------------------------------------------------
// Every service in `src/api/services/*` resolves its requests
// against these paths, prefixed by VITE_API_BASE_URL (see
// `src/api/client.ts`). Keep paths and JSON shapes in sync with
// the Express server (server/src/routes/*).
// ============================================================

export const ENDPOINTS = {
  // ---------- Auth ----------
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_VERIFY_OTP: '/auth/verify-otp',
  AUTH_RESET_PASSWORD: '/auth/reset-password',
  AUTH_ME: '/auth/me',

  // ---------- Public (no auth) ----------
  PUBLIC_DOCTORS: '/public/doctors',
  PUBLIC_DOCTOR_AVAILABILITY: '/public/doctors/:id/availability',
  PUBLIC_DOCTOR_AVAILABILITY_MONTH: '/public/doctors/:id/availability-month',
  PUBLIC_PAYMENT_INITIATE: '/public/payment/initiate',
  PUBLIC_PAYMENT_RECONCILE: '/public/payment/reconcile',
  PUBLIC_HOSPITALS: '/public/hospitals',
  PUBLIC_PLATFORM: '/public/platform',
  PUBLIC_CONTACT: '/public/contact',

  // ---------- Master admin (platform panel) ----------
  MASTER_LOGIN: '/master/login',
  MASTER_ME: '/master/me',
  MASTER_STATS: '/master/stats',
  MASTER_REGISTER_INITIATE: '/master/register/initiate',
  MASTER_REQUESTS: '/master/requests',
  MASTER_REQUEST_DETAIL: '/master/requests/:id',
  MASTER_REQUEST_APPROVE: '/master/requests/:id/approve',
  MASTER_REQUEST_REJECT: '/master/requests/:id/reject',
  MASTER_HOSPITALS: '/master/hospitals',
  MASTER_HOSPITAL_DETAIL: '/master/hospitals/:slug',
  MASTER_HOSPITAL_STATUS: '/master/hospitals/:slug/status',
  MASTER_HOSPITAL_LISTED: '/master/hospitals/:slug/listed',
  MASTER_HOSPITAL_DELETE: '/master/hospitals/:slug',
  MASTER_SETTINGS: '/master/settings',
  MASTER_ANALYTICS: '/master/analytics',
  MASTER_RECEIPTS: '/master/receipts',
  MASTER_ANNOUNCEMENTS: '/master/announcements',
  MASTER_ANNOUNCEMENT_DETAIL: '/master/announcements/:id',
  MASTER_AUDIT: '/master/audit',
  MASTER_CONTACTS: '/master/contacts',
  MASTER_CONTACT_DETAIL: '/master/contacts/:id',
  MASTER_DIRECTORY_ORDER: '/master/directory/order',

  // ---------- Consultations (admin oversight) ----------
  CONSULTATIONS: '/consultations',
  CONSULTATION_DETAIL: '/consultations/:id',

  // ---------- Dashboard (hospital) ----------
  DASHBOARD_STATS: '/dashboard/stats',
  DASHBOARD_ANNOUNCEMENTS: '/dashboard/announcements',

  // ---------- Patients ----------
  PATIENTS: '/patients',
  PATIENT_DETAIL: '/patients/:id',
  PATIENT_CREATE: '/patients',
  PATIENT_UPDATE: '/patients/:id',
  PATIENT_DELETE: '/patients/:id',
  PATIENT_MEDICAL_RECORDS: '/patients/:id/records',
  PATIENT_PRESCRIPTIONS: '/patients/:id/prescriptions',
  PATIENT_BILLS: '/patients/:id/bills',
  PATIENT_DOCUMENTS: '/patients/:id/documents',

  // ---------- Doctors ----------
  DOCTORS: '/doctors',
  DOCTOR_DETAIL: '/doctors/:id',
  DOCTOR_CREATE: '/doctors',
  DOCTOR_UPDATE: '/doctors/:id',
  DOCTOR_DELETE: '/doctors/:id',
  DOCTOR_SCHEDULE: '/doctors/:id/schedule',
  DOCTOR_METRICS: '/doctors/metrics',
  DOCTOR_STATS: '/doctors/:id/stats',
  DOCTOR_ACCOUNT_CREATE: '/doctors/:id/account',
  DOCTOR_RESET_PASSWORD: '/doctors/:id/reset-password',
  DOCTOR_DISABLE_LOGIN: '/doctors/:id/disable-login',
  DOCTOR_ENABLE_LOGIN: '/doctors/:id/enable-login',
  DOCTOR_DEPENDENCIES: '/doctors/:id/dependencies',
  DOCTOR_REASSIGN: '/doctors/:id/reassign',
  DOCTOR_CALENDAR: '/doctors/:id/calendar',

  // ---------- Appointments ----------
  APPOINTMENTS: '/appointments',
  APPOINTMENT_DETAIL: '/appointments/:id',
  APPOINTMENT_CREATE: '/appointments',
  APPOINTMENT_UPDATE: '/appointments/:id',
  APPOINTMENT_DELETE: '/appointments/:id',
  APPOINTMENT_CANCEL: '/appointments/:id/cancel',
  APPOINTMENT_CONFIRM: '/appointments/:id/confirm',
  APPOINTMENT_COMPLETE: '/appointments/:id/complete',

  // ---------- Departments ----------
  DEPARTMENTS: '/departments',
  DEPARTMENT_DETAIL: '/departments/:id',
  DEPARTMENT_CREATE: '/departments',
  DEPARTMENT_UPDATE: '/departments/:id',

  // ---------- Pharmacy ----------
  MEDICINES: '/pharmacy/medicines',
  MEDICINE_DETAIL: '/pharmacy/medicines/:id',
  MEDICINE_CREATE: '/pharmacy/medicines',
  MEDICINE_UPDATE: '/pharmacy/medicines/:id',
  MEDICINE_DELETE: '/pharmacy/medicines/:id',
  PRESCRIPTIONS: '/pharmacy/prescriptions',
  PRESCRIPTION_CREATE: '/pharmacy/prescriptions',
  STOCK_LOW: '/pharmacy/stock/low',
  STOCK_INVENTORY: '/pharmacy/stock',

  // ---------- Billing ----------
  INVOICES: '/billing/invoices',
  INVOICE_DETAIL: '/billing/invoices/:id',
  INVOICE_CREATE: '/billing/invoices',
  INVOICE_UPDATE: '/billing/invoices/:id',
  PAYMENTS: '/billing/payments',
  PAYMENT_CREATE: '/billing/payments',
  INVOICE_DOWNLOAD: '/billing/invoices/:id/download',

  // ---------- Staff ----------
  STAFF: '/staff',
  STAFF_MEMBER: '/staff/:id',
  STAFF_CREATE: '/staff',
  STAFF_UPDATE: '/staff/:id',
  STAFF_DELETE: '/staff/:id',

  // ---------- Reports ----------
  REPORTS: '/reports',
  REPORT_GENERATE: '/reports/generate',
  REPORT_DETAIL: '/reports/:id',
  REPORT_DOWNLOAD: '/reports/:id/download',

  // ---------- Settings ----------
  SETTINGS_HOSPITAL: '/settings/hospital',
  SETTINGS_PROFILE: '/settings/profile',
  SETTINGS_NOTIFICATIONS: '/settings/notifications',
  SETTINGS_USERS: '/settings/users',
  SETTINGS_BACKUP: '/settings/backup',
  SETTINGS_AUDIT_LOG: '/settings/audit-log',

  // ---------- Doctor Portal ----------
  DOCTOR_ME: '/doctor-portal/me',
  DOCTOR_PATIENTS: '/doctor-portal/patients',
  DOCTOR_APPOINTMENTS: '/doctor-portal/appointments',
  DOCTOR_APPOINTMENT_CONFIRM: '/doctor-portal/appointments/:id/confirm',
  DOCTOR_APPOINTMENT_CANCEL: '/doctor-portal/appointments/:id/cancel',
  DOCTOR_APPOINTMENT_COMPLETE: '/doctor-portal/appointments/:id/complete',
  DOCTOR_APPOINTMENT_RESCHEDULE: '/doctor-portal/appointments/:id/reschedule',
  DOCTOR_CONSULTATIONS: '/doctor-portal/consultations',
  DOCTOR_CONSULTATION: '/doctor-portal/consultations/:id',
  DOCTOR_PRESCRIPTIONS: '/doctor-portal/prescriptions',

  // ---------- Patient Portal ----------
  PORTAL_ME: '/portal/me',
  PORTAL_PROFILE: '/portal/profile',
  PORTAL_PASSWORD: '/portal/password',
  PORTAL_DOCTORS: '/portal/doctors',
  PORTAL_DOCTOR_DETAIL: '/portal/doctors/:id',
  PORTAL_DOCTOR_AVAILABILITY: '/portal/doctors/:id/availability',
  PORTAL_APPOINTMENTS: '/portal/appointments',
  PORTAL_APPOINTMENT_DETAIL: '/portal/appointments/:id',
  PORTAL_APPOINTMENT_BOOK: '/portal/appointments',
  PORTAL_APPOINTMENT_RESCHEDULE: '/portal/appointments/:id/reschedule',
  PORTAL_APPOINTMENT_CANCEL: '/portal/appointments/:id/cancel',
  PORTAL_RECORDS: '/portal/records',
  PORTAL_REPORT_DOWNLOAD: '/portal/records/:id/download',
  PORTAL_PRESCRIPTIONS: '/portal/prescriptions',
  PORTAL_PRESCRIPTION_DOWNLOAD: '/portal/prescriptions/:id/download',
  PORTAL_NOTIFICATIONS: '/portal/notifications',
  PORTAL_NOTIFICATION_READ: '/portal/notifications/:id/read',
  PORTAL_NOTIFICATIONS_READ_ALL: '/portal/notifications/read-all',
  PORTAL_REVIEWS: '/portal/reviews',
  PORTAL_REVIEW_DETAIL: '/portal/reviews/:id',
  PORTAL_DOCTOR_REVIEWS: '/portal/doctors/:id/reviews',
  PORTAL_BILLS: '/portal/bills',
  PORTAL_INVOICE_DOWNLOAD: '/portal/bills/:id/download',
  PORTAL_TIMELINE: '/portal/timeline',
  PORTAL_SEARCH: '/portal/search',
} as const

// Replaces :param placeholders with values, e.g.
//   withParams(ENDPOINTS.PATIENT_DETAIL, { id: 'p-1' }) -> '/patients/p-1'
export function withParams(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/:([a-zA-Z]+)/g, (_, key: string) => String(params[key]))
}
