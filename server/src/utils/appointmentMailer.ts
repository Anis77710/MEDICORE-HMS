import { PatientModel } from '../models/Patient.js'
import { sendMail } from './email.js'
import {
  emailLayout,
  escHtml,
  formatNpr,
  formatPaidAt,
  greeting,
  kvCard,
  paragraph,
  paragraphHtml,
  receiptCard,
  emphasis,
} from './emailTemplate.js'

// ============================================================
// Patient appointment notifications - every booking lifecycle
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
      reason?: string
      note?: string
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
  const appointmentCard = kvCard('Appointment details', [
    { label: 'Doctor', value: appointment.doctorName },
    { label: 'Department', value: appointment.department },
    { label: 'Type', value: appointment.type },
    { label: 'When', value: when },
  ])

  if (event.kind === 'booked') {
    const subject = `Appointment request received - ${appointment.doctorName}`
    const text = `Hello ${appointment.patientName},

We have received your ${appointment.type.toLowerCase()} appointment request:

  Doctor:     ${appointment.doctorName}
  Department: ${appointment.department}
  When:       ${when}

Your request is awaiting approval. You will receive a confirmation email
as soon as it is approved.

Medicore HMS`
    const html = emailLayout({
      title: 'Appointment request received',
      body:
        greeting(appointment.patientName) +
        paragraphHtml(
          `We have received your ${emphasis(escHtml(appointment.type.toLowerCase()))} appointment request. ` +
            `It is now ${emphasis('awaiting approval')} - you will receive a confirmation email as soon as it is approved.`,
        ) +
        appointmentCard,
    })
    return { subject, text, html }
  }

  if (event.kind === 'approved') {
    const subject = `Your appointment is confirmed - ${appointment.doctorName}`
    const text = `Hello ${appointment.patientName},

Great news - your appointment has been APPROVED:

  Doctor:     ${appointment.doctorName}
  Department: ${appointment.department}
  When:       ${when}

Please arrive 10 minutes early and bring a valid ID. To cancel or
reschedule, contact the hospital front desk.

Medicore HMS`
    const html = emailLayout({
      title: 'Your appointment is confirmed',
      body:
        greeting(appointment.patientName) +
        paragraphHtml(`Great news - your appointment has been ${emphasis('approved')}:`) +
        appointmentCard +
        paragraph('Please arrive 10 minutes early and bring a valid ID. To cancel or reschedule, contact the hospital front desk.', {
          muted: true,
        }),
    })
    return { subject, text, html }
  }

  if (event.kind === 'cancelled') {
    const subject = `Your appointment has been cancelled - ${appointment.doctorName}`
    const text = `Hello ${appointment.patientName},

Your appointment has been CANCELLED:

  Doctor:     ${appointment.doctorName}
  Department: ${appointment.department}
  Previously scheduled for: ${when}

If you did not request this cancellation, please contact the hospital
front desk. We apologise for any inconvenience.

Medicore HMS`
    const html = emailLayout({
      title: 'Your appointment has been cancelled',
      body:
        greeting(appointment.patientName) +
        paragraphHtml(
          `Your appointment with ${emphasis(escHtml(appointment.doctorName))} has been ${emphasis('cancelled')}:`,
        ) +
        appointmentCard +
        paragraph('If you did not request this cancellation, please contact the hospital front desk. We apologise for any inconvenience.', {
          muted: true,
        }),
    })
    return { subject, text, html }
  }

  const subject = `Your appointment has been rescheduled - ${appointment.doctorName}`
  const previous = event.previous
    ? `  Previously: ${fmtDate(event.previous.date)} at ${fmtTime(event.previous.time)}${event.previous.doctorName ? ` (${event.previous.doctorName})` : ''}\n`
    : ''
  const reason = event.reason
    ? `  Reason:     ${event.reason}\n`
    : '  Reason:     Requested by your doctor\n'
  const text = `Hello ${appointment.patientName},

Your appointment has been RESCHEDULED by ${appointment.doctorName}:

${previous}${reason}  New schedule: ${when}
  Doctor:     ${appointment.doctorName}
  Department: ${appointment.department}
${event.note ? `  Note:       ${event.note}\n` : ''}
If the new time does not suit you, please contact the hospital front
desk to choose another slot.

Medicore HMS`
  const previousHtml = event.previous
    ? paragraph(
        `Previously scheduled for: ${fmtDate(event.previous.date)} at ${fmtTime(event.previous.time)}${event.previous.doctorName ? ` (${event.previous.doctorName})` : ''}`,
        { muted: true },
      )
    : ''
  const reasonHtml = paragraphHtml(
    `Your appointment has been ${emphasis('rescheduled')} by ${emphasis(escHtml(appointment.doctorName))}:`,
  ) +
    (event.reason ? paragraphHtml(`Reason: ${emphasis(escHtml(event.reason))}`) : '')
  const noteHtml = event.note
    ? paragraph(escHtml(event.note), { muted: true })
    : ''
  const html = emailLayout({
    title: 'Your appointment has been rescheduled',
    body:
      greeting(appointment.patientName) +
      reasonHtml +
      previousHtml +
      appointmentCard +
      noteHtml +
      paragraph('If the new time does not suit you, please contact the hospital front desk to choose another slot.', { muted: true }),
  })
  return { subject, text, html }
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
      console.error(`[mail] No patient email for appointment ${appointment.id} - ${event.kind} notification skipped`)
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
    const subject = `Payment received - ${details.appointmentNo} (${amount})`
    const text = `Hello ${details.patientName},

We received your eSewa payment of ${amount} for the appointment below.

  Payment ref:    ${details.transactionCode || details.appointmentNo}
  Appointment:    ${details.appointmentNo}
  Doctor:         ${details.doctorName}
  Department:     ${details.department}
  When:           ${fmtDate(details.date)} at ${fmtTime(details.time)}

Your appointment request is now awaiting approval - you will receive a
confirmation email as soon as it is approved.

Medicore HMS`
    const html = emailLayout({
      title: 'Payment received',
      body:
        greeting(details.patientName) +
        paragraphHtml(
          `We received your eSewa payment of ${emphasis(formatNpr(details.amount))} for the appointment below.`,
        ) +
        receiptCard(
          [
            { label: 'Payment ref', value: details.transactionCode || details.appointmentNo },
            { label: 'Appointment', value: details.appointmentNo },
            { label: 'Doctor', value: details.doctorName },
            { label: 'Department', value: details.department },
            { label: 'When', value: `${fmtDate(details.date)} at ${fmtTime(details.time)}` },
            { label: 'Status', value: 'Paid' },
            { label: 'Amount Paid', value: formatNpr(details.amount), total: true },
          ],
          {
            subtitle: 'eSewa Payment - Official Receipt',
            date: formatPaidAt(new Date()),
            footer:
              'This is a computer-generated receipt for your Medicore HMS appointment fee.<br/>Thank you for choosing Medicore HMS.',
          },
        ) +
        paragraph(
          'Your appointment request is now awaiting approval - you will receive a confirmation email as soon as it is approved.',
          { muted: true },
        ),
    })
    await sendMail({ to: details.email, subject, text, html })
    console.log(`[mail] payment receipt queued for ${details.email} (appointment ${details.appointmentNo})`)
  } catch (err) {
    console.error(
      `[mail] Failed to send payment receipt for appointment ${details.appointmentNo}:`,
      err instanceof Error ? err.message : err,
    )
  }
}
