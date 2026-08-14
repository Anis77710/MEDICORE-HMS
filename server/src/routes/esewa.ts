import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'
import { validate } from '../middleware/validate.js'
import { DoctorModel } from '../models/Doctor.js'
import { PatientModel } from '../models/Patient.js'
import { AppointmentModel, type Appointment } from '../models/Appointment.js'
import { PaymentAttemptModel, type PaymentAttempt, type PaymentBooking } from '../models/PaymentAttempt.js'
import { makeReadableId, parseDay } from '../models/Counter.js'
import { isSlotFree, isWorkingDay, isPastSlot, dayFullName } from '../domain/availability.js'
import { hospitalOf } from '../middleware/tenant.js'
import { getTenantConnection, isValidSlug } from '../config/tenants.js'
import { withTenant } from '../models/registry.js'
import { notifyAppointmentEvent, notifyPaymentReceipt } from '../utils/appointmentMailer.js'
import {
  buildPaymentFields,
  esewaConfigured,
  extractCallbackUuid,
  newTransactionUuid,
  verifyEsewaCallback,
  checkEsewaStatus,
} from '../utils/esewa.js'

// ============================================================
// Public eSewa payment flow — the only way to create a public
// booking. POST /payment/initiate validates the slot and returns
// the eSewa form; the signed success callback then re-checks the
// slot, dedupes the patient by email and creates the patient +
// appointment (status Pending) before redirecting back to the
// frontend. A booking is never created without a verified payment.
// ============================================================

export const esewaRouter = Router()

const GENDERS = ['Male', 'Female', 'Other'] as const
const TYPES = ['Checkup', 'Consultation', 'Follow-up', 'Emergency', 'Procedure'] as const

const initiateBody = z.object({
  hospital: z.string().trim().max(50).optional(),
  firstName: z.string().min(1, 'first name required'),
  lastName: z.string().min(1, 'last name required'),
  email: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'valid email required')
    .default(''),
  phone: z.string().regex(/^\d{10}$/, 'phone must be exactly 10 digits'),
  dob: z.string().default(''),
  gender: z.enum(GENDERS).default('Other'),
  address: z.string().default(''),
  doctorId: z.string().min(1, 'doctor required'),
  type: z.enum(TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:mm'),
  durationMin: z.coerce.number().int().min(5).max(240).default(30),
  reason: z.string().default(''),
})

async function loadDoctorAndCheckSlot(booking: PaymentBooking) {
  const doctor = await DoctorModel.findById(booking.doctorId)
  if (!doctor) throw new ApiError('Doctor not found', 404)
  if (doctor.status !== 'Active') {
    throw new ApiError(
      `This doctor is currently ${doctor.status.toLowerCase()} and cannot accept new bookings. Please choose another doctor.`,
      409,
    )
  }
  if (!isWorkingDay(doctor, booking.date)) {
    throw new ApiError(
      `${doctor.name} does not work on ${dayFullName(booking.date)} — choose a working day`,
      409,
    )
  }
  if (isPastSlot(booking.date, booking.time)) {
    throw new ApiError('Cannot book an appointment in the past — choose a future date and time', 400)
  }
  const clashes = await AppointmentModel.find({
    doctorId: booking.doctorId,
    date: booking.date,
    status: { $ne: 'Cancelled' },
  }).select('date time durationMin status')
  if (!isSlotFree(clashes, booking.date, booking.time, booking.durationMin)) {
    throw new ApiError('This time slot is already booked — please choose a different time', 409)
  }
  return doctor
}

function bookingFrom(attempt: { booking: PaymentBooking }): PaymentBooking {
  return attempt.booking
}

type AttemptDoc = PaymentAttempt & { _id: unknown }
type AppointmentDoc = Appointment & { _id: unknown }

/**
 * Completes a paid booking: re-checks the slot, dedupes the patient by email,
 * creates the patient + appointment and marks the attempt success. Used by the
 * verified success callback and by the eSewa status-API reconciliation fallback.
 */
async function completeBooking(
  attempt: AttemptDoc,
  transactionCode: string,
): Promise<{ appointment: AppointmentDoc; doctor: NonNullable<Awaited<ReturnType<typeof loadDoctorAndCheckSlot>>> }> {
  const booking = bookingFrom(attempt)
  const doctor = await loadDoctorAndCheckSlot(booking)

  let patient = await PatientModel.findOne({ email: booking.email.toLowerCase() })
  if (!patient) {
    patient = await PatientModel.create({
      firstName: booking.firstName,
      lastName: booking.lastName,
      email: booking.email,
      phone: booking.phone,
      dob: booking.dob,
      gender: booking.gender,
      address: booking.address,
      bloodGroup: '',
      emergencyContact: '',
      insurance: '',
      allergies: [],
      status: 'Pending',
      department: doctor.department,
      assignedDoctorId: String(doctor._id),
      lastVisit: '',
      patientId: await makeReadableId('patient', booking.firstName),
    })
  }

  const appointment = await AppointmentModel.create({
    appointmentNo: await makeReadableId('appointment', patient.firstName, parseDay(booking.date)),
    patientId: patient._id,
    patientName: `${patient.firstName} ${patient.lastName}`,
    doctorId: String(doctor._id),
    doctorName: doctor.name,
    department: doctor.department,
    type: booking.type,
    date: booking.date,
    time: booking.time,
    durationMin: booking.durationMin,
    reason: booking.reason,
    status: 'Pending',
  })

  await PaymentAttemptModel.findByIdAndUpdate(attempt._id, {
    $set: {
      status: 'success',
      transactionCode,
      patientId: String(patient._id),
      appointmentId: String(appointment._id),
      appointmentNo: appointment.appointmentNo,
    },
  })

  void notifyAppointmentEvent(appointment, { kind: 'booked' })
  void notifyPaymentReceipt({
    email: booking.email,
    patientName: appointment.patientName,
    doctorName: doctor.name,
    department: doctor.department,
    appointmentNo: appointment.appointmentNo,
    date: booking.date,
    time: booking.time,
    amount: attempt.amount,
    transactionCode,
  })

  return { appointment, doctor }
}

/** Redirects the browser back to the frontend booking page with result params. */
function redirectSuccess(res: Response, appointment: { appointmentNo: string }, doctor: { name: string }, booking: PaymentBooking) {
  redirectToFrontend(
    res,
    `payment=success&ref=${encodeURIComponent(appointment.appointmentNo)}` +
      `&doctor=${encodeURIComponent(doctor.name)}&date=${booking.date}&time=${booking.time}`,
  )
}

// POST /public/payment/initiate — validates and returns the eSewa form fields.
esewaRouter.post('/payment/initiate', validate({ body: initiateBody }), async (req, res, next) => {
  try {
    if (!esewaConfigured()) {
      throw new ApiError(
        'Online payments are not configured yet. Please try again later.',
        503,
      )
    }
    const booking = req.body as PaymentBooking
    const doctor = await loadDoctorAndCheckSlot(booking)

    const transactionUuid = newTransactionUuid()
    const slug = hospitalOf(req).slug
    const attempt = await PaymentAttemptModel.create({
      transactionUuid,
      amount: doctor.consultationFee,
      status: 'pending',
      booking,
      hospital: slug,
    })

    const { fields, signature, formUrl } = buildPaymentFields({
      totalAmount: doctor.consultationFee,
      transactionUuid,
      successUrl: `${env.APP_API_URL}/api/public/payment/success?hosp=${encodeURIComponent(slug)}`,
      failureUrl: `${env.APP_API_URL}/api/public/payment/failure?hosp=${encodeURIComponent(slug)}`,
    })

    res.status(201).json({
      attemptId: String(attempt._id),
      transactionUuid,
      amount: doctor.consultationFee,
      formUrl,
      fields: { ...fields, signature },
    })
  } catch (err) {
    next(err)
  }
})

const redirectToFrontend = (res: { redirect(status: number, url: string): void }, params: string) =>
  res.redirect(302, `${env.APP_BASE_URL}/book-appointment?${params}`)

// /public/payment/success — eSewa's signed callback. eSewa redirects the
// browser here via GET with `data`/`signature` query params (form POST with
// the same fields also accepted). Creates the booking only when the payment
// is verified, the amount matches and the slot is still free, then redirects
// the browser back to the frontend. The `hosp` query param (added at
// initiate time) routes the callback to the correct hospital database.
esewaRouter.all('/payment/success', async (req, res, next) => {
  const slug = resolveCallbackSlug(req)
  try {
    await withTenant(getTenantConnection(slug), slug, () => handlePaymentSuccess(req, res, slug, next))
  } catch (err) {
    next(err)
  }
})

/** Picks the hospital for an eSewa callback: `hosp` param, then header/default. */
function resolveCallbackSlug(req: Request): string {
  const hosp = req.query?.hosp
  const slug = typeof hosp === 'string' && isValidSlug(hosp) ? hosp : hospitalOf(req).slug
  return slug
}

async function handlePaymentSuccess(
  req: Request,
  res: Response,
  slug: string,
  next: (err?: unknown) => void,
): Promise<void> {
  try {
    const { data, signature } = {
      ...(req.query as { data?: string; signature?: string }),
      ...(req.body as { data?: string; signature?: string }),
    }
    if (typeof data !== 'string') {
      redirectToFrontend(res, 'payment=error&message=invalid_callback')
      return
    }
    const verified = verifyEsewaCallback(data, signature)
    const uuid = verified?.transaction_uuid ?? extractCallbackUuid(data)
    if (!uuid) {
      redirectToFrontend(res, 'payment=error&message=invalid_signature')
      return
    }

    // Atomically claim the attempt so a replayed (or racing) callback
    // can never create a second booking.
    const attempt = await PaymentAttemptModel.findOneAndUpdate(
      { transactionUuid: uuid, status: 'pending' },
      { $set: { status: 'processing' as const } },
      { new: true },
    )
    if (!attempt) {
      const existing = await PaymentAttemptModel.findOne({ transactionUuid: uuid })
      redirectToFrontend(
        res,
        existing?.status === 'success' && existing.appointmentNo
          ? `payment=success&ref=${encodeURIComponent(existing.appointmentNo)}`
          : 'payment=failed',
      )
      return
    }
    if (attempt.hospital && attempt.hospital !== slug) {
      await PaymentAttemptModel.findByIdAndUpdate(attempt._id, {
        $set: { status: 'failed' },
      })
      redirectToFrontend(res, 'payment=failed')
      return
    }

    // The signed callback is the fast path; eSewa's transaction status API is
    // the authoritative fallback. If the signature/status/amount check fails,
    // ask eSewa directly whether the money moved — if it says COMPLETE, the
    // booking must still be created (the payer was charged).
    let transactionCode = verified?.transaction_code ?? ''
    let paid =
      Boolean(verified) &&
      verified!.status === 'COMPLETE' &&
      Number(verified!.total_amount) === attempt.amount
    if (!paid) {
      const status = await checkEsewaStatus(uuid, attempt.amount)
      if (status.status === 'COMPLETE') {
        paid = true
        transactionCode = status.ref_id ?? status.transaction_code ?? transactionCode
      }
    }
    if (!paid) {
      await PaymentAttemptModel.findByIdAndUpdate(attempt._id, {
        $set: { status: 'failed', transactionCode },
      })
      redirectToFrontend(res, 'payment=failed')
      return
    }

    try {
      const { appointment, doctor } = await completeBooking(attempt, transactionCode)
      redirectSuccess(res, appointment, doctor, bookingFrom(attempt))
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        await PaymentAttemptModel.findByIdAndUpdate(attempt._id, { $set: { status: 'failed' } })
        redirectToFrontend(res, 'payment=conflict&message=slot_unavailable')
        return
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
}

// /public/payment/failure — eSewa's callback when the payer aborts or fails
// (GET redirect with query params, or form POST). Even here the transaction
// status API is consulted: a payment that eSewa reports as COMPLETE must still
// produce a booking (the payer was charged).
esewaRouter.all('/payment/failure', async (req, res, next) => {
  const slug = resolveCallbackSlug(req)
  try {
    await withTenant(getTenantConnection(slug), slug, async () => {
      const { data, signature } = {
        ...(req.query as { data?: string; signature?: string }),
        ...(req.body as { data?: string; signature?: string }),
      }
      const verified = typeof data === 'string' ? verifyEsewaCallback(data, signature) : null
      const uuid = verified?.transaction_uuid ?? (typeof data === 'string' ? extractCallbackUuid(data) : undefined)
      if (uuid) {
        // Claim the attempt atomically: if the signed success callback already
        // claimed it (status processing/success), it is completing the booking
        // — skip, a replayed or racing callback must never create a duplicate.
        const claimed = await PaymentAttemptModel.findOneAndUpdate(
          { transactionUuid: uuid, status: 'pending' },
          { $set: { status: 'processing' as const } },
          { new: true },
        )
        if (claimed) {
          const status = await checkEsewaStatus(uuid, claimed.amount)
          if (status.status === 'COMPLETE') {
            try {
              const { appointment, doctor } = await completeBooking(
                claimed,
                status.ref_id ?? status.transaction_code ?? '',
              )
              redirectSuccess(res, appointment, doctor, bookingFrom(claimed))
              return
            } catch (err) {
              if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
                await PaymentAttemptModel.findByIdAndUpdate(claimed._id, {
                  $set: { status: 'failed' },
                })
                redirectToFrontend(res, 'payment=conflict&message=slot_unavailable')
                return
              }
              throw err
            }
          }
          await PaymentAttemptModel.findByIdAndUpdate(claimed._id, {
            $set: { status: 'failed' as const, transactionCode: verified?.transaction_code ?? '' },
          })
        }
      }
      redirectToFrontend(res, 'payment=failed')
    })
  } catch (err) {
    next(err)
  }
})

// /public/payment/reconcile — the frontend calls this when the user returns to
// the booking page without a confirmed callback (e.g. the eSewa tab was closed,
// the redirect never arrived, or the callback could not be verified). The
// transaction status API is the authoritative source: if eSewa says COMPLETE
// the booking is created right here, so a paid appointment is never lost.
const reconcileBody = z.object({
  hospital: z.string().trim().max(50).optional(),
  attemptId: z.string().min(1, 'attempt id required'),
})

esewaRouter.post('/payment/reconcile', validate({ body: reconcileBody }), async (req, res, next) => {
  try {
    const { attemptId } = req.body as { attemptId: string }
    const attempt = await PaymentAttemptModel.findById(attemptId)
    if (!attempt) throw new ApiError('Payment attempt not found', 404)
    if (attempt.status === 'success') {
      res.json({ status: 'success', appointmentNo: attempt.appointmentNo })
      return
    }
    // A 'processing' attempt is being completed by the signed eSewa callback
    // right now — report pending so the frontend retries and then sees the
    // success. Never complete the same attempt twice.
    if ((attempt.status as string) === 'processing') {
      res.json({ status: 'pending' })
      return
    }
    // Atomically claim the attempt so a racing signed callback can never
    // double-complete the booking (mirrors the success callback's claim).
    const claimed = await PaymentAttemptModel.findOneAndUpdate(
      { _id: attempt._id, status: 'pending' },
      { $set: { status: 'processing' as const } },
      { new: true },
    )
    const current = claimed ?? attempt
    // eSewa's status API is the source of truth: an attempt may have been
    // marked failed earlier (e.g. the callback arrived before eSewa's status
    // API reflected the COMPLETE transaction), so re-check before giving up —
    // a payment that actually moved money must still produce a booking.
    const status = await checkEsewaStatus(current.transactionUuid, current.amount)
    if (status.status !== 'COMPLETE') {
      if (claimed) {
        await PaymentAttemptModel.findByIdAndUpdate(attempt._id, { $set: { status: 'pending' as const } })
      }
      res.json({ status: 'pending' })
      return
    }
    try {
      const { appointment } = await completeBooking(
        current,
        status.ref_id ?? status.transaction_code ?? '',
      )
      res.json({ status: 'success', appointmentNo: appointment.appointmentNo })
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        await PaymentAttemptModel.findByIdAndUpdate(attempt._id, { $set: { status: 'failed' } })
        res.status(409).json({ message: err.message })
        return
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
})
