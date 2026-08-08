import { PatientModel } from '../models/Patient.js'
import { sendMail } from './email.js'

// ============================================================
// Patient appointment notifications — every booking lifecycle
// event produces a real email to the patient: request received,
// approved, cancelled, rescheduled.
// Delivery failures are logged loudly but never allowed to break
// the API operation (email is a side effect of the transaction).
// ============================================================

export type AppointmentEvent =
  | { kind: 'booked' }
  | { kind: 'approved' }
  | { kind: 'cancelled' }
  | {
      kind: 'rescheduled'
      previous?: { date: string; time: string; doctorName?: string }
    }

function fmtDate(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function fmtTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h ?? 0, m ?? 0)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function buildMessage(
  appointment: Pick<AppointmentLike, 'patientName' | 'doctorName' | 'department' | 'type' | 'date' | 'time'>,
  event: AppointmentEvent,
): { subject: string; text: string; html: string } {
  const when = `${fmtDate(appointment.date)} at ${fmtTime(appointment.time)}`

  if (event.kind === 'booked') {
    const subject = `Appointment request received — ${appointment.doctorName}`
    const text = `Hello ${appointment.patientName},

We have received your ${appointment.type.toLowerCase()} appointment request:

  Doctor:     ${appointment.doctorName}
  Department: ${appointment.department}
  When:       ${when}

Your request is awaiting approval. You will receive a confirmation email
as soon as it is approved.

Medicore HMS`
    return { subject, text, html: htmlBody(subject, text) }
  }

  if (event.kind === 'approved') {
    const subject = `Your appointment is confirmed — ${appointment.doctorName}`
    const text = `Hello ${appointment.patientName},

Great news — your appointment has been APPROVED:

  Doctor:     ${appointment.doctorName}
  Department: ${appointment.department}
  When:       ${when}

Please arrive 10 minutes early and bring a valid ID. To cancel or
reschedule, contact the hospital front desk.

Medicore HMS`
    return { subject, text, html: htmlBody(subject, text) }
  }

  if (event.kind === 'cancelled') {
    const subject = `Your appointment has been cancelled — ${appointment.doctorName}`
    const text = `Hello ${appointment.patientName},

Your appointment has been CANCELLED:

  Doctor:     ${appointment.doctorName}
  Department: ${appointment.department}
  Previously scheduled for: ${when}

If you did not request this cancellation, please contact the hospital
front desk. We apologise for any inconvenience.

Medicore HMS`
    return { subject, text, html: htmlBody(subject, text) }
  }

  const subject = `Your appointment has been rescheduled — ${appointment.doctorName}`
  const previous = event.previous
    ? `  Previously: ${fmtDate(event.previous.date)} at ${fmtTime(event.previous.time)}${event.previous.doctorName ? ` (${event.previous.doctorName})` : ''}\n`
    : ''
  const text = `Hello ${appointment.patientName},

Your appointment has been RESCHEDULED:

${previous}  New schedule: ${when}
  Doctor:     ${appointment.doctorName}
  Department: ${appointment.department}

If the new time does not suit you, please contact the hospital front
desk to choose another slot.

Medicore HMS`
  return { subject, text, html: htmlBody(subject, text) }
}

function htmlBody(title: string, text: string): string {
  const lines = text
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => `<p style="margin:6px 0">${l.replace(/</g, '&lt;')}</p>`)
    .join('')
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <div style="background:#0e7490;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
    <strong>Medicore HMS</strong>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 12px;font-size:18px">${title}</h2>
    ${lines}
  </div>
  <p style="color:#6b7280;font-size:12px;margin-top:16px">
    This is an automated message from Medicore HMS. Please do not reply to this email.
  </p>
</div>`
}

type AppointmentLike = {
  id?: string
  patientId: string
  patientName: string
  doctorName: string
  department: string
  type: string
  date: string
  time: string
}

export async function notifyAppointmentEvent(
  appointment: AppointmentLike,
  event: AppointmentEvent,
): Promise<void> {
  try {
    const patient = await PatientModel.findById(appointment.patientId)
    if (!patient || !patient.email) {
      console.error(`[mail] No patient email for appointment ${appointment.id} — ${event.kind} notification skipped`)
      return
    }
    const message = buildMessage(appointment, event)
    await sendMail({ to: patient.email, ...message })
    console.log(`[mail] ${event.kind} notification queued for ${patient.email} (appointment ${appointment.id})`)
  } catch (err) {
    console.error(
      `[mail] Failed to send ${event.kind} notification for appointment ${appointment.id}:`,
      err instanceof Error ? err.message : err,
    )
  }
}

export interface PaymentReceiptDetails {
  email: string
  patientName: string
  doctorName: string
  department: string
  appointmentNo: string
  date: string
  time: string
  amount: number
  transactionCode: string
}

// Receipt for the eSewa consultation fee charged at public booking time.
// Delivery failures are logged but never break the booking (email is a
// side effect of the payment callback).
export async function notifyPaymentReceipt(details: PaymentReceiptDetails): Promise<void> {
  try {
    const amount = `NPR ${details.amount.toLocaleString('en-US')}`
    const subject = `Payment received — ${details.appointmentNo} (${amount})`
    const text = `Hello ${details.patientName},

We received your eSewa payment of ${amount} for the appointment below.

  Payment ref:    ${details.transactionCode || details.appointmentNo}
  Appointment:    ${details.appointmentNo}
  Doctor:         ${details.doctorName}
  Department:     ${details.department}
  When:           ${fmtDate(details.date)} at ${fmtTime(details.time)}

Your appointment request is now awaiting approval — you will receive a
confirmation email as soon as it is approved.

Medicore HMS`
    await sendMail({ to: details.email, subject, text, html: htmlBody(subject, text) })
    console.log(`[mail] payment receipt queued for ${details.email} (appointment ${details.appointmentNo})`)
  } catch (err) {
    console.error(
      `[mail] Failed to send payment receipt for appointment ${details.appointmentNo}:`,
      err instanceof Error ? err.message : err,
    )
  }
}
