// ============================================================
// Medicore HMS — login credential helpers
//
// Every hospital staff member signs in with a synthetic username
// derived from their first name, and an initial password derived
// from their first name + birth year. The admin never chooses a
// password: the system generates it and emails it to the member's
// Gmail address.
//
//   name: "Dr. Ramesh Sharma"   birthYear: 1985
//   username: ramesh@medicore.hms
//   password: ramesh@1985
// ============================================================

import { sendMail } from './email.js'

export const USERNAME_DOMAIN = 'medicore.hms'

// Extracts the first name, stripping honorifics ("Dr.", "Prof." etc.),
// and normalises it to lowercase alphanumerics.
export function firstNameOf(name: string): string {
  const cleaned = name.replace(/^(dr|mr|mrs|ms|prof|er)\.?\s+/i, '').trim()
  const word = cleaned.split(/\s+/)[0] ?? ''
  const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized || 'user'
}

export function loginUsername(name: string): string {
  return `${firstNameOf(name)}@${USERNAME_DOMAIN}`
}

export function defaultPassword(name: string, birthYear?: number | null): string {
  return `${firstNameOf(name)}@${birthYear ?? 2000}`
}

export function sendCredentialsEmail(
  to: string,
  opts: { name: string; username: string; password: string },
): Promise<void> {
  return sendMail({
    to,
    subject: 'Medicore HMS — Your login credentials',
    text:
      `Hello ${opts.name},\n\n` +
      `An administrator has created your Medicore HMS account. Here are your login credentials:\n\n` +
      `  Login username: ${opts.username}\n` +
      `  Password:       ${opts.password}\n\n` +
      `Sign in at the Medicore HMS login page. For security, please change your password after your first sign-in.\n` +
      `If you did not expect this email, you can safely ignore it.`,
  })
}

function formatNpr(amount: number): string {
  return `NPR ${amount.toLocaleString('en-US')}`
}

export function receiptText(opts: {
  regNo: string
  hospitalName: string
  amount: number
  transactionCode: string
  paidAt?: Date
}): string {
  const paidAt = opts.paidAt
    ? new Date(opts.paidAt).toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu' })
    : '—'
  return (
    `  Registration No:    ${opts.regNo}\n` +
    `  Hospital:           ${opts.hospitalName}\n` +
    `  Amount paid:        ${formatNpr(opts.amount)} (one-time registration fee)\n` +
    `  Transaction code:   ${opts.transactionCode || '—'}\n` +
    `  Paid on:            ${paidAt} (NPT)\n` +
    `  Payment gateway:    eSewa`
  )
}

/**
 * Sent to a hospital's admin once the master admin approves their paid
 * registration: login credentials PLUS the payment receipt for the
 * NPR 2,000 registration fee — the same credential scheme doctors and
 * staff use (firstname@medicore.hms + firstname@birthYear).
 */
export function sendHospitalCredentialsEmail(
  to: string,
  opts: {
    name: string
    hospitalName: string
    username: string
    password: string
    regNo: string
    amount: number
    transactionCode: string
    paidAt?: Date
  },
): Promise<void> {
  return sendMail({
    to,
    subject: `Medicore HMS — ${opts.hospitalName} approved: login credentials & receipt`,
    text:
      `Hello ${opts.name},\n\n` +
      `Congratulations! Your hospital "${opts.hospitalName}" (registration ${opts.regNo}) ` +
      `has been approved and is now live on the Medicore HMS platform.\n\n` +
      `Here are your login credentials:\n\n` +
      `  Login username: ${opts.username}\n` +
      `  Password:       ${opts.password}\n\n` +
      `Sign in at the Medicore HMS login page. For security, please change your password after your first sign-in.\n\n` +
      `═══════════════════════════════════════\n` +
      `PAYMENT RECEIPT\n` +
      `═══════════════════════════════════════\n\n` +
      receiptText({
        regNo: opts.regNo,
        hospitalName: opts.hospitalName,
        amount: opts.amount,
        transactionCode: opts.transactionCode,
        paidAt: opts.paidAt,
      }) +
      `\n\nKeep this receipt for your records.\n` +
      `If you did not expect this email, you can safely ignore it.`,
  })
}

export function sendRegistrationRejectedEmail(
  to: string,
  opts: { name: string; hospitalName: string; regNo: string; reason?: string },
): Promise<void> {
  const reason = opts.reason
    ? `\nReason given by the platform team: ${opts.reason}\n`
    : '\n'
  return sendMail({
    to,
    subject: `Medicore HMS — ${opts.hospitalName} registration update`,
    text:
      `Hello ${opts.name},\n\n` +
      `We're sorry — the registration request for "${opts.hospitalName}" ` +
      `(registration ${opts.regNo}) could not be approved at this time.` +
      reason +
      `\nIf you paid the registration fee, the refund will be processed by the platform team. ` +
      `Contact us for any questions.\n\nIf you did not expect this email, you can safely ignore it.`,
  })
}
