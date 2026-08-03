import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

// In dev (EMAIL_CONSOLE_ONLY=true) OTP emails are printed to the console so
// flows can be exercised without SMTP. In production a real transport is used.
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const subject = 'HealSync HMS — Password reset OTP'
  const text = `Your HealSync HMS password reset code is: ${otp}\nIt expires in 15 minutes.`

  if (env.EMAIL_CONSOLE_ONLY) {
    console.log('\n==============================================')
    console.log(`[email:console] OTP for ${to}: ${otp}`)
    console.log('==============================================\n')
    return
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
  await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, text })
}
