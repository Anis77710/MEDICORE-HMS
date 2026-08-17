// ============================================================
// Medicore HMS - login credential helpers
//
// Staff accounts sign in with a synthetic login username derived
// from the hospital code, the member's first name and their unique
// staff ID, and a cryptographically-random temporary password:
//
//   Hospital: Medicore Hospital (code MH, domain medicore.hms)
//   Member:   Ram, staff ID DOC-0042
//   username: MHram.0042@medicore.hms
//   password: K7m#p92Qx!   (random, must be changed on first login)
//
// No predictable passwords are ever generated from names, birth
// years, DOB, phone numbers or staff IDs. The unique staff ID is
// the primary identifier; name + birth year never identify an
// account. Passwords are only ever stored as bcrypt hashes.
// ============================================================

import { randomBytes } from 'node:crypto'
import { sendMail } from './email.js'
import { CounterModel } from '../models/Counter.js'
import { currentContext } from '../models/registry.js'
import { HospitalSettingsModel } from '../models/Settings.js'
import { cachedHospital, hospitalCode, hospitalLoginDomain } from '../config/tenants.js'
import { env } from '../config/env.js'
import { emailLayout, escHtml, formatNpr, formatPaidAt, greeting, kvCard, paragraph, paragraphHtml, receiptCard, emphasis } from './emailTemplate.js'

export const PASSWORD_MIN = 12

/**
 * The credential context for the hospital handling the current request:
 * its registry code (e.g. "MH"), its login email domain (e.g.
 * "medicore.hms") and its display name (for emails).
 */
export async function hospitalCredentialContext(): Promise<{ code: string; loginDomain: string; name: string }> {
  const slug = currentContext().slug
  const rec = cachedHospital(slug)
  const settings = await HospitalSettingsModel.findById('hospital').lean()
  return {
    code: hospitalCode(slug),
    loginDomain: hospitalLoginDomain(slug),
    name: rec?.name || settings?.name || 'Medicore Hospital',
  }
}

// Extracts the first name, stripping honorifics ("Dr.", "Prof." etc.),
// and normalises it to lowercase alphanumerics.
export function firstNameOf(name: string): string {
  const cleaned = name.replace(/^(dr|mr|mrs|ms|prof|er)\.?\s+/i, '').trim()
  const word = cleaned.split(/\s+/)[0] ?? ''
  const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized || 'user'
}

// ------------------------------------------------------------
// Staff IDs - the primary unique identifier for every member.
// Format "<PREFIX>-<zero-padded sequence>", e.g. DOC-0042.
// ------------------------------------------------------------

const STAFF_ID_PREFIX: Record<string, string> = {
  ADMIN: 'ADM',
  DOCTOR: 'DOC',
  NURSE: 'NUR',
  STAFF: 'STF',
  PATIENT: 'PAT',
}

export function staffIdPrefix(role: string): string {
  return STAFF_ID_PREFIX[role] ?? 'STF'
}

/** The numeric portion of a staff ID ("DOC-0042" -> "0042"). */
export function staffIdNumber(staffId: string): string {
  const m = staffId.match(/(\d+)$/)
  return m?.[1] ?? staffId
}

/** Allocates the next sequential staff ID for a role (unique per hospital DB). */
export async function nextStaffId(role: string): Promise<string> {
  const prefix = staffIdPrefix(role)
  const doc = await CounterModel.findByIdAndUpdate(
    `staffid-${prefix}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  )
  return `${prefix}-${String(doc!.seq).padStart(4, '0')}`
}

// ------------------------------------------------------------
// Login username - "<CODE><first>.<staffIdNumber>@<domain>"
// The staff ID portion guarantees uniqueness even for identical
// first names, birth years and departments within one hospital.
// ------------------------------------------------------------

export interface LoginUsernameInput {
  hospitalCode: string
  firstName: string
  staffId: string
  loginDomain: string
}

export function loginUsername(input: LoginUsernameInput): string {
  return `${input.hospitalCode}${input.firstName}.${staffIdNumber(input.staffId)}@${input.loginDomain}`
}

// ------------------------------------------------------------
// Secure temporary passwords
// ------------------------------------------------------------

const PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const PASSWORD_LOWER = 'abcdefghijkmnopqrstuvwxyz'
const PASSWORD_DIGITS = '23456789'
const PASSWORD_SPECIAL = '!@#$%^&*()_+-='
const PASSWORD_ALL = PASSWORD_UPPER + PASSWORD_LOWER + PASSWORD_DIGITS + PASSWORD_SPECIAL

function randomChar(charset: string): string {
  return charset[randomBytes(1)[0]! % charset.length]!
}

/**
 * Cryptographically-random temporary password: 12 characters with at
 * least one uppercase letter, one lowercase letter, one digit and one
 * special character. Never derived from personal information.
 */
export function generateTempPassword(length = PASSWORD_MIN): string {
  const parts = [
    randomChar(PASSWORD_UPPER),
    randomChar(PASSWORD_LOWER),
    randomChar(PASSWORD_DIGITS),
    randomChar(PASSWORD_SPECIAL),
  ]
  while (parts.length < length) parts.push(randomChar(PASSWORD_ALL))
  for (let i = parts.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0]! % (i + 1)
    const tmp = parts[i]!
    parts[i] = parts[j]!
    parts[j] = tmp
  }
  return parts.join('')
}

/** Returns an error message when the password fails the policy, else null. */
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters`
  }
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter'
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter'
  if (!/\d/.test(password)) return 'Password must include a number'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a special character'
  return null
}

// ------------------------------------------------------------
// Credential emails
// ------------------------------------------------------------

export interface CredentialEmailInput {
  name: string
  role: string
  username: string
  password: string
  hospitalName: string
  loginUrl?: string
}

function credentialEmailBody(input: CredentialEmailInput, action: 'created' | 'reset'): string {
  const url = input.loginUrl || `${env.APP_BASE_URL}/login`
  return (
    greeting(input.name) +
    (action === 'created'
      ? paragraph(`An administrator has created your account at ${emphasis(input.hospitalName)}.`)
      : paragraph(`An administrator has reset your password at ${emphasis(input.hospitalName)}.`)) +
    paragraph('Sign in with the temporary credentials below.') +
    kvCard('Your temporary login credentials', [
      { label: 'Login ID', value: input.username, mono: true },
      { label: 'Temporary password', value: input.password, mono: true },
      { label: 'Role', value: input.role },
      { label: 'Login page', value: url },
    ]) +
    paragraphHtml(
      `${emphasis('Important:')} you must change this temporary password when you first sign in. ` +
        `Until you do, you cannot open the dashboard.`,
    ) +
    paragraph(
      'Security: never share your password, use a password that is unique to this account, ' +
        'and change it immediately if you believe it may have been seen by someone else.',
    ) +
    paragraph('If you did not expect this email, you can safely ignore it.', { muted: true })
  )
}

function sendCredentialMail(to: string, input: CredentialEmailInput, action: 'created' | 'reset'): Promise<void> {
  const subject =
    action === 'created'
      ? `${input.hospitalName} - your temporary login credentials`
      : `${input.hospitalName} - your password has been reset`
  const text =
    `Hello ${input.name},\n\n` +
    (action === 'created'
      ? `An administrator has created your account at ${input.hospitalName}.\n`
      : `An administrator has reset your password at ${input.hospitalName}.\n`) +
    `\nHere are your temporary login credentials:\n\n` +
    `  Login ID:           ${input.username}\n` +
    `  Temporary password: ${input.password}\n` +
    `  Role:               ${input.role}\n` +
    `  Login page:         ${input.loginUrl || `${env.APP_BASE_URL}/login`}\n\n` +
    `IMPORTANT: You must change this temporary password when you first sign in. ` +
    `Until you do, you cannot open the dashboard.\n\n` +
    `Security: never share your password, use a password that is unique to this account, ` +
    `and change it immediately if you believe it may have been seen by someone else.\n\n` +
    `If you did not expect this email, you can safely ignore it.`
  const html = emailLayout({
    title: action === 'created' ? 'Your temporary login credentials' : 'Your password has been reset',
    body: credentialEmailBody(input, action),
  })
  return sendMail({ to, subject, text, html })
}

/** Sent when an admin creates a Doctor/Nurse/Staff account. */
export function sendCredentialsEmail(to: string, input: CredentialEmailInput): Promise<void> {
  return sendCredentialMail(to, input, 'created')
}

/** Sent when an admin resets a staff member's password. */
export function sendPasswordResetEmail(to: string, input: CredentialEmailInput): Promise<void> {
  return sendCredentialMail(to, input, 'reset')
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
    : '-'
  return (
    `  Registration No:    ${opts.regNo}\n` +
    `  Hospital:           ${opts.hospitalName}\n` +
    `  Amount paid:        ${formatNpr(opts.amount)} (one-time registration fee)\n` +
    `  Transaction code:   ${opts.transactionCode || '-'}\n` +
    `  Paid on:            ${paidAt} (NPT)\n` +
    `  Payment gateway:    eSewa`
  )
}

/**
 * Sent to a hospital's admin once the master admin approves their paid
 * registration: login credentials PLUS the payment receipt for the
 * registration fee - the same temporary-credential scheme doctors and
 * staff use.
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
  const subject = `Medicore HMS - ${opts.hospitalName} approved: login credentials & receipt`
  const text =
    `Hello ${opts.name},\n\n` +
    `Congratulations! Your hospital "${opts.hospitalName}" (registration ${opts.regNo}) ` +
    `has been approved and is now live on the Medicore HMS platform.\n\n` +
    `Here are your temporary login credentials:\n\n` +
    `  Login ID:           ${opts.username}\n` +
    `  Temporary password: ${opts.password}\n\n` +
    `Sign in at the Medicore HMS login page. For security, you must change this temporary password ` +
    `when you first sign in - until you do, you cannot open the dashboard.\n\n` +
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
    `If you did not expect this email, you can safely ignore it.`
  const html = emailLayout({
    title: `Welcome to Medicore HMS - ${opts.hospitalName} is live`,
    body:
      greeting(opts.name) +
      paragraphHtml(
        `Congratulations! Your hospital "${escHtml(opts.hospitalName)}" (registration ${escHtml(opts.regNo)}) has been ` +
          `${emphasis('approved')} and is now live on the Medicore HMS platform.`,
      ) +
      paragraph('Here are your temporary login credentials:') +
      kvCard('Login credentials', [
        { label: 'Login ID', value: opts.username, mono: true },
        { label: 'Temporary password', value: opts.password, mono: true },
      ]) +
      paragraphHtml(
        `${emphasis('Important:')} you must change this temporary password when you first sign in - ` +
          `until you do, you cannot open the dashboard.`,
      ) +
      paragraph('Your registration fee receipt is included below - keep it for your records.') +
      receiptCard(
        [
          { label: 'Reference', value: opts.regNo },
          { label: 'Hospital', value: opts.hospitalName },
          { label: 'Payer', value: `${opts.name} (${to})` },
          { label: 'eSewa Transaction', value: opts.transactionCode || '-', },
          { label: 'Status', value: 'Approved' },
          { label: 'Amount Paid', value: formatNpr(opts.amount), total: true },
        ],
        { subtitle: 'Hospital Registration Fee - Official Receipt', date: formatPaidAt(opts.paidAt) },
      ) +
      paragraph('If you did not expect this email, you can safely ignore it.', { muted: true }),
  })
  return sendMail({ to, subject, text, html })
}

export function sendRegistrationRejectedEmail(
  to: string,
  opts: { name: string; hospitalName: string; regNo: string; reason?: string },
): Promise<void> {
  const reason = opts.reason
    ? `\nReason given by the platform team: ${opts.reason}\n`
    : '\n'
  const subject = `Medicore HMS - ${opts.hospitalName} registration update`
  const text =
    `Hello ${opts.name},\n\n` +
    `We're sorry - the registration request for "${opts.hospitalName}" ` +
    `(registration ${opts.regNo}) could not be approved at this time.` +
    reason +
    `\nIf you paid the registration fee, the refund will be processed by the platform team. ` +
    `Contact us for any questions.\n\nIf you did not expect this email, you can safely ignore it.`
  const html = emailLayout({
    title: 'Registration status update',
    body:
      greeting(opts.name) +
      paragraphHtml(
        `We're sorry - the registration request for "${escHtml(opts.hospitalName)}" ` +
          `(registration ${escHtml(opts.regNo)}) could not be ${emphasis('approved')} at this time.`,
      ) +
      (opts.reason
        ? paragraph(`Reason given by the platform team: ${opts.reason}`)
        : '') +
      paragraph('If you paid the registration fee, the refund will be processed by the platform team. Contact us for any questions.') +
      paragraph('If you did not expect this email, you can safely ignore it.', { muted: true }),
  })
  return sendMail({ to, subject, text, html })
}
