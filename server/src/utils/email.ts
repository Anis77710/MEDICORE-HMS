import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { emailLayout, paragraph } from './emailTemplate.js'

// ============================================================
// Strict email delivery. The only transport that ever runs is
// real SMTP (env EMAIL_TRANSPORT=smtp, the default).
//
// EMAIL_TRANSPORT=log is an explicit, test-only escape hatch:
// messages are captured in memory and printed to the console so
// local flows and the smoke suite can run without SMTP. It must
// never be enabled in production — a production boot refuses to
// start if SMTP is not configured.
//
// If SMTP is not configured, sendMail throws — a message is never
// silently dropped or "demo-delivered".
// ============================================================

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

// Only populated in 'log' mode (tests / local dev without SMTP).
const captured: MailMessage[] = []

export function capturedEmails(): readonly MailMessage[] {
  return captured
}

function requireSmtp(): nodemailer.Transporter {
  if (!env.SMTP_HOST) {
    throw new Error(
      'SMTP is not configured — set SMTP_HOST (and SMTP_USER/SMTP_PASS) in server/.env. ' +
        'No email was sent. Real email delivery is mandatory; see .env.example.',
    )
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (env.EMAIL_TRANSPORT === 'log') {
    captured.push(message)
    console.log('\n[mail:log] ──────────────────────────────────────────────')
    console.log(`[mail:log] To:      ${message.to}`)
    console.log(`[mail:log] Subject: ${message.subject}`)
    console.log(`[mail:log] ${message.text.split('\n').join('\n[mail:log] ')}`)
    console.log('[mail:log] ──────────────────────────────────────────────\n')
    return
  }

  const transporter = requireSmtp()
  await transporter.sendMail({ from: env.EMAIL_FROM, ...message })
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  await sendMail({
    to,
    subject: 'Medicore HMS — Password reset code',
    text: `Your Medicore HMS password reset code is: ${otp}\nIt expires in 15 minutes. If you did not request this, you can safely ignore this email.`,
    html: emailLayout({
      title: 'Password reset code',
      body:
        paragraph(`Your Medicore HMS password reset code is:`) +
        `<div style="margin:0 0 14px;padding:14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;text-align:center;font-family:'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:6px;color:#0e7490;">${otp}</div>` +
        paragraph('It expires in 15 minutes. If you did not request this, you can safely ignore this email.', { muted: true }),
    }),
  })
}
