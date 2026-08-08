import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'
import { validate } from '../middleware/validate.js'
import { DoctorModel } from '../models/Doctor.js'
import { PatientModel } from '../models/Patient.js'
import { AppointmentModel } from '../models/Appointment.js'
import { PaymentAttemptModel, type PaymentBooking } from '../models/PaymentAttempt.js'
import { makeReadableId, parseDay } from '../models/Counter.js'
import { isSlotFree } from '../domain/availability.js'
import { notifyAppointmentEvent, notifyPaymentReceipt } from '../utils/appointmentMailer.js'
import {
  buildPaymentFields,
  esewaConfigured,
  newTransactionUuid,
  verifyEsewaCallback,
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
  firstName: z.string().min(1, 'first name required'),
  lastName: z.string().min(1, 'last name required'),
  email: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'valid email required')
    .default(''),
  phone: z.string().default(''),
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
    const attempt = await PaymentAttemptModel.create({
      transactionUuid,
      amount: doctor.consultationFee,
      status: 'pending',
      booking,
    })

    const { fields, signature, formUrl } = buildPaymentFields({
      totalAmount: doctor.consultationFee,
      transactionUuid,
      successUrl: `${env.APP_API_URL}/api/public/payment/success`,
      failureUrl: `${env.APP_API_URL}/api/public/payment/failure`,
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
// the browser back to the frontend.
esewaRouter.all('/payment/success', async (req, res, next) => {
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
    if (!verified || !verified.transaction_uuid) {
      redirectToFrontend(res, 'payment=error&message=invalid_signature')
      return
    }

    const uuid = verified.transaction_uuid
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

    if (verified.status !== 'COMPLETE' || Number(verified.total_amount) !== attempt.amount) {
      await PaymentAttemptModel.findByIdAndUpdate(attempt._id, {
        $set: { status: 'failed', transactionCode: verified.transaction_code ?? '' },
      })
      redirectToFrontend(res, 'payment=failed')
      return
    }

    const booking = bookingFrom(attempt)
    let doctor: Awaited<ReturnType<typeof loadDoctorAndCheckSlot>> | null = null
    try {
      doctor = await loadDoctorAndCheckSlot(booking)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await PaymentAttemptModel.findByIdAndUpdate(attempt._id, { $set: { status: 'failed' } })
        redirectToFrontend(res, 'payment=conflict&message=slot_taken')
        return
      }
      throw err
    }
    if (!doctor) {
      await PaymentAttemptModel.findByIdAndUpdate(attempt._id, { $set: { status: 'failed' } })
      redirectToFrontend(res, 'payment=conflict&message=doctor_unavailable')
      return
    }

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
        transactionCode: verified.transaction_code ?? '',
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
      transactionCode: verified.transaction_code ?? '',
    })

    redirectToFrontend(
      res,
      `payment=success&ref=${encodeURIComponent(appointment.appointmentNo)}` +
        `&doctor=${encodeURIComponent(doctor.name)}&date=${booking.date}&time=${booking.time}`,
    )
  } catch (err) {
    next(err)
  }
})

// /public/payment/failure — eSewa's callback when the payer aborts or fails
// (GET redirect with query params, or form POST).
esewaRouter.all('/payment/failure', async (req, res, next) => {
  try {
    const { data, signature } = {
      ...(req.query as { data?: string; signature?: string }),
      ...(req.body as { data?: string; signature?: string }),
    }
    if (typeof data === 'string') {
      const verified = verifyEsewaCallback(data, signature)
      if (verified?.transaction_uuid) {
        await PaymentAttemptModel.findOneAndUpdate(
          { transactionUuid: verified.transaction_uuid, status: 'pending' },
          { $set: { status: 'failed', transactionCode: verified.transaction_code ?? '' } },
        )
      }
    }
    redirectToFrontend(res, 'payment=failed')
  } catch (err) {
    next(err)
  }
})
