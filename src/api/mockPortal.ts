// ============================================================
// HealSync HMS — Patient Portal mock data
// Portal-specific seeds (notifications, reviews, doctor bios).
// Stored separately so the admin mock layer stays untouched.
// ============================================================

import type { DoctorReview, PortalNotification } from '../types/portal'

export const mockNotifications: PortalNotification[] = [
  {
    id: 'notif-1',
    type: 'appointment_confirmation',
    title: 'Appointment confirmed',
    message: 'Your consultation with Dr. Michael Roberts on Aug 02, 09:00 has been confirmed.',
    read: false,
    createdAt: '2026-07-27T14:30:00Z',
    link: '/portal/appointments',
  },
  {
    id: 'notif-2',
    type: 'appointment_reminder',
    title: 'Upcoming appointment reminder',
    message: 'Dr. Michael Roberts — Cardiology checkup tomorrow at 09:00. Please arrive 15 minutes early.',
    read: false,
    createdAt: '2026-08-01T08:00:00Z',
    link: '/portal/appointments',
  },
  {
    id: 'notif-3',
    type: 'report_available',
    title: 'Lab report ready',
    message: 'Your blood panel results are available to download in Medical Records.',
    read: false,
    createdAt: '2026-07-31T15:20:00Z',
    link: '/portal/records',
  },
  {
    id: 'notif-4',
    type: 'prescription_update',
    title: 'New prescription issued',
    message: 'Dr. Michael Roberts issued a prescription with 2 medicines on Jul 28.',
    read: true,
    createdAt: '2026-07-28T11:00:00Z',
    link: '/portal/prescriptions',
  },
  {
    id: 'notif-5',
    type: 'schedule_change',
    title: 'Doctor schedule update',
    message: 'Dr. Emily Carter will be on leave next week. Your appointments are unaffected.',
    read: true,
    createdAt: '2026-07-26T09:15:00Z',
    link: '/portal/doctors',
  },
  {
    id: 'notif-6',
    type: 'billing',
    title: 'Invoice available',
    message: 'Invoice INV-2026-0831 (Cardiac care package) is available in Billing.',
    read: true,
    createdAt: '2026-07-28T16:40:00Z',
    link: '/portal/billing',
  },
  {
    id: 'notif-7',
    type: 'announcement',
    title: 'Hospital announcement',
    message: 'HealSync is now offering online video consultations across all departments.',
    read: true,
    createdAt: '2026-07-25T10:00:00Z',
    link: '/portal/doctors',
  },
]

export const mockReviews: DoctorReview[] = [
  {
    id: 'rev-1',
    doctorId: 'd-1',
    patientId: 'p-1',
    patientName: 'Sarah Johnson',
    rating: 5,
    comment: 'Dr. Roberts was very thorough and explained my treatment plan clearly.',
    visitDate: '2026-07-28',
    createdAt: '2026-07-29T09:00:00Z',
  },
  {
    id: 'rev-2',
    doctorId: 'd-1',
    patientId: 'p-10',
    patientName: 'Samuel Wright',
    rating: 4,
    comment: 'Great follow-up care after my stent procedure.',
    visitDate: '2026-07-29',
    createdAt: '2026-07-30T12:00:00Z',
  },
  {
    id: 'rev-3',
    doctorId: 'd-1',
    patientId: 'p-2',
    patientName: 'John Miller',
    rating: 5,
    comment: 'Very professional and caring doctor. Highly recommended.',
    visitDate: '2026-06-12',
    createdAt: '2026-06-14T08:30:00Z',
  },
]

export const mockDoctorExtras: Record<
  string,
  { bio: string; languages: string[]; ratingCount: number }
> = {
  'd-1': {
    bio: 'Dr. Michael Roberts is a senior interventional cardiologist with 15 years of experience in coronary angioplasty, stenting and preventive cardiology. He has performed over 2,000 successful procedures and is a fellow of the American College of Cardiology.',
    languages: ['English', 'Spanish'],
    ratingCount: 214,
  },
  'd-2': {
    bio: 'Dr. Priya Sharma is a neurologist specializing in headache disorders, epilepsy and neuro-diagnostics. She leads the stroke unit at HealSync and is passionate about patient education.',
    languages: ['English', 'Hindi'],
    ratingCount: 168,
  },
  'd-3': {
    bio: 'Dr. James Osei is a pediatrician dedicated to infant and child wellness, vaccination programs and adolescent health. Parents appreciate his calm, friendly approach with children.',
    languages: ['English', 'French'],
    ratingCount: 190,
  },
  'd-4': {
    bio: 'Dr. Emily Carter is an internal medicine specialist focusing on hypertension, diabetes and preventive care. She coordinates comprehensive care for complex, multi-condition patients.',
    languages: ['English'],
    ratingCount: 245,
  },
  'd-5': {
    bio: 'Dr. David Kim is an orthopedic surgeon with special interest in sports injuries, arthroscopy and joint replacement. He has trained with leading surgical teams in Europe and Asia.',
    languages: ['English', 'Korean'],
    ratingCount: 132,
  },
  'd-6': {
    bio: 'Dr. Amara Diallo is a dermatologist treating skin, hair and nail conditions, including eczema, psoriasis and cosmetic dermatology. She also runs the hospital allergy clinic.',
    languages: ['English', 'Arabic', 'French'],
    ratingCount: 98,
  },
  'd-7': {
    bio: 'Dr. Robert Nguyen is a medical oncologist specializing in colorectal and lung cancer care, chemotherapy planning and palliative support. He believes in shared decision-making with patients and families.',
    languages: ['English', 'Vietnamese'],
    ratingCount: 87,
  },
  'd-8': {
    bio: 'Dr. Grace Adeyemi is a gynecologist and obstetrician providing complete women\u2019s health care — from prenatal care and delivery to menopause management and minimally invasive surgery.',
    languages: ['English', 'Yoruba'],
    ratingCount: 156,
  },
}
