import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { ConsultationModel } from '../models/Consultation.js'
import { PatientModel } from '../models/Patient.js'
import { DoctorModel, type Doctor } from '../models/Doctor.js'
import { AppointmentModel } from '../models/Appointment.js'
import { PrescriptionModel } from '../models/Pharmacy.js'
import { UserModel } from '../models/User.js'
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'
import { writeAuditLog } from './staff.js'
import { getAvailabilitySlots, isWorkingDay, isPastSlot, isSlotFree, dayFullName } from '../domain/availability.js'
import { makeReadableId } from '../models/Counter.js'
import { notifyAppointmentEvent } from '../utils/appointmentMailer.js'

// ============================================================
// Doctor Portal — every route is authenticated, restricted to the
// DOCTOR role and scoped to the doctor profile that matches the
// signed-in user's email. A doctor can never address another
// doctor's patients, appointments, consultations or prescriptions.
// ============================================================

export const doctorPortalRouter = Router()

doctorPortalRouter.use(requireAuth, requireRole('DOCTOR'))

async function resolveDoctor(req: import('express').Request): Promise<import('mongoose').HydratedDocument<Doctor>> {
  const { userId } = req as AuthedRequest
  const user = await UserModel.findById(userId)
  if (!user) throw new ApiError('Account not found', 401)
  const doctor = await DoctorModel.findOne({ email: user.email.toLowerCase() })
  if (!doctor) {
    throw new ApiError(
      'Doctor profile not found. Ask an administrator to link your account to a doctor profile.',
      404,
    )
  }
  return doctor
}

/**
 * Clinical capability gate. A doctor who is On Leave or Unavailable
 * can still VIEW their data, but cannot confirm appointments, complete
 * appointments, start consultations or issue prescriptions.
 */
function assertCanServe(doctor: Pick<Doctor, 'status' | 'name'>): void {
  if (doctor.status !== 'Active') {
    throw new ApiError(
      `Your profile is marked "${doctor.status}" — clinical actions (confirming appointments, consultations, prescriptions) are disabled until an administrator reactivates you.`,
      403,
    )
  }
}

// ---------- Zod schemas ----------

const medicineItem = z.object({
  name: z.string().min(1, 'medicine name required'),
  dosage: z.string().default(''),
  frequency: z.string().default(''),
  durationDays: z.coerce.number().int().min(1).max(365).default(7),
  instructions: z.string().default(''),
})

const vitalsBody = z.object({
  bloodPressure: z.string().optional(),
  heartRate: z.coerce.number().min(0).max(400).optional(),
  temperature: z.coerce.number().min(30).max(45).optional(),
  respiratoryRate: z.coerce.number().min(0).max(100).optional(),
  spo2: z.coerce.number().min(0).max(100).optional(),
  weightKg: z.coerce.number().min(0).max(400).optional(),
  heightCm: z.coerce.number().min(0).max(250).optional(),
  bmi: z.coerce.number().min(0).max(100).optional(),
})

const examinationBody = z.object({
  general: z.string().default(''),
  cardiovascular: z.string().default(''),
  respiratory: z.string().default(''),
  neurological: z.string().default(''),
  abdominal: z.string().default(''),
  other: z.string().default(''),
})

const consultationBody = z.object({
  patientId: z.string().min(1, 'patient required'),
  appointmentId: z.string().optional(),
  chiefComplaint: z.string().min(3, 'chief complaint is required'),
  symptoms: z.string().default(''),
  vitals: vitalsBody.default({}),
  examination: examinationBody.default({}),
  diagnosis: z.object({
    primary: z.string().min(1, 'primary diagnosis is required'),
    additional: z.string().default(''),
    notes: z.string().default(''),
  }),
  clinicalNotes: z.object({
    assessment: z.string().default(''),
    observations: z.string().default(''),
    reasoning: z.string().default(''),
    general: z.string().default(''),
  }),
  treatmentPlan: z.object({
    advice: z.string().default(''),
    diet: z.string().default(''),
    lifestyle: z.string().default(''),
    instructions: z.string().default(''),
  }),
  prescription: z.object({ medicines: z.array(medicineItem) }).optional(),
  prescriptionId: z.string().optional(),
})

const prescriptionBody = z.object({
  patientId: z.string().min(1, 'patient required'),
  appointmentId: z.string().optional(),
  medicines: z.array(medicineItem).min(1, 'at least one medicine required'),
})

const listQuery = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  patientId: z.string().optional(),
})

// ---------- GET /doctor-portal/me ----------
doctorPortalRouter.get('/me', async (req, res, next) => {
  try {
    const doctor = await resolveDoctor(req)
    res.json(doctor)
  } catch (err) {
    next(err)
  }
})

// ---------- GET /doctor-portal/patients ----------
doctorPortalRouter.get('/patients', validate({ query: listQuery }), async (req, res, next) => {
  try {
    const { search, status } = queryOf<{ search?: string; status?: string }>(req)
    const doctor = await resolveDoctor(req)
    const [byAssign, appts, consults] = await Promise.all([
      PatientModel.find({ assignedDoctorId: doctor._id.toString() }).select('_id'),
      AppointmentModel.find({ doctorId: doctor._id.toString() }).select('patientId'),
      ConsultationModel.find({ doctorId: doctor._id.toString() }).select('patientId'),
    ])
    const ids = new Map<string, true>()
    for (const p of byAssign) ids.set(String(p._id), true)
    for (const a of appts) ids.set(a.patientId, true)
    for (const c of consults) ids.set(c.patientId, true)

    const filter: Record<string, unknown> = { _id: { $in: [...ids.keys()] } }
    if (search) {
      const s = search.toLowerCase()
      filter.$or = [
        { firstName: { $regex: s, $options: 'i' } },
        { lastName: { $regex: s, $options: 'i' } },
        { patientId: { $regex: s, $options: 'i' } },
      ]
    }
    if (status && status !== 'All') filter.status = status

    const patients = await PatientModel.find(filter).sort({ lastVisit: -1 })
    res.json(patients)
  } catch (err) {
    next(err)
  }
})

// ---------- GET /doctor-portal/appointments ----------
doctorPortalRouter.get('/appointments', validate({ query: listQuery }), async (req, res, next) => {
  try {
    const { date, status, search } = queryOf<{ date?: string; status?: string; search?: string }>(req)
    const doctor = await resolveDoctor(req)
    const filter: Record<string, unknown> = { doctorId: doctor._id.toString() }
    if (date) filter.date = date
    if (status && status !== 'All') filter.status = status
    if (search) {
      const s = search.toLowerCase()
      filter.$or = [
        { patientName: { $regex: s, $options: 'i' } },
        { reason: { $regex: s, $options: 'i' } },
        { type: { $regex: s, $options: 'i' } },
      ]
    }
    const appointments = await AppointmentModel.find(filter).sort({ date: 1, time: 1 })
    res.json(appointments)
  } catch (err) {
    next(err)
  }
})

function transition(status: 'Confirmed' | 'Cancelled' | 'Completed') {
  return async (req: import('express').Request, res: import('express').Response, next: (e?: unknown) => void) => {
    try {
      const doctor = await resolveDoctor(req)
      // Cancelling an appointment stays allowed (removing workload while away is fine),
      // but confirming/completing requires an Active clinical status.
      if (status !== 'Cancelled') assertCanServe(doctor)
      const appointment = await AppointmentModel.findById(req.params.id)
      if (!appointment) throw new ApiError('Appointment not found', 404)
      if (appointment.doctorId !== doctor._id.toString()) {
        throw new ApiError('You do not have permission to modify this appointment', 403)
      }
      appointment.status = status
      await appointment.save()
      await writeAuditLog(req as AuthedRequest, `appointment-${status.toLowerCase()}`, 'appointment', String(appointment._id), {
        doctorId: String(doctor._id),
        patientId: appointment.patientId,
        date: appointment.date,
        time: appointment.time,
      })
      if (status === 'Confirmed') void notifyAppointmentEvent(appointment, { kind: 'approved' })
      if (status === 'Cancelled') void notifyAppointmentEvent(appointment, { kind: 'cancelled' })
      res.json(appointment)
    } catch (err) {
      next(err)
    }
  }
}

doctorPortalRouter.post(
  '/appointments/:id/confirm',
  validate({ params: z.object({ id: z.string() }) }),
  transition('Confirmed'),
)
doctorPortalRouter.post(
  '/appointments/:id/cancel',
  validate({ params: z.object({ id: z.string() }) }),
  transition('Cancelled'),
)
doctorPortalRouter.post(
  '/appointments/:id/complete',
  validate({ params: z.object({ id: z.string() }) }),
  transition('Completed'),
)

// ---------- POST /doctor-portal/appointments/:id/reschedule ----------
// Doctor moves a patient's appointment to a new slot and the patient is
// notified by email with the reason (e.g. an emergency on the doctor's side).
const rescheduleBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:mm'),
  durationMin: z.coerce.number().int().min(5).max(240).optional(),
  reason: z.string().min(2, 'reason is required').max(120),
  note: z.string().max(500).default(''),
})

doctorPortalRouter.post(
  '/appointments/:id/reschedule',
  validate({ params: z.object({ id: z.string() }), body: rescheduleBody }),
  async (req, res, next) => {
    try {
      const doctor = await resolveDoctor(req)
      assertCanServe(doctor)
      const body = req.body as z.infer<typeof rescheduleBody>
      const appointment = await AppointmentModel.findById(req.params.id)
      if (!appointment) throw new ApiError('Appointment not found', 404)
      if (appointment.doctorId !== doctor._id.toString()) {
        throw new ApiError('You do not have permission to modify this appointment', 403)
      }
      if (appointment.status === 'Completed') {
        throw new ApiError('A completed appointment cannot be rescheduled', 400)
      }
      const previous = {
        date: appointment.date,
        time: appointment.time,
        doctorName: appointment.doctorName,
      }
      const targetDuration = body.durationMin ?? appointment.durationMin
      if (!isWorkingDay(doctor, body.date)) {
        throw new ApiError(
          `You do not work on ${dayFullName(body.date)} — choose a working day`,
          409,
        )
      }
      if (isPastSlot(body.date, body.time)) {
        throw new ApiError('Cannot reschedule to a past slot — choose a future date and time', 400)
      }
      const clashes = await AppointmentModel.find({
        doctorId: doctor._id.toString(),
        date: body.date,
        status: { $ne: 'Cancelled' },
      }).select('date time durationMin status')
      if (!isSlotFree(clashes, body.date, body.time, targetDuration, String(appointment._id))) {
        throw new ApiError(
          'This time slot is already booked — choose a different time',
          409,
        )
      }
      appointment.date = body.date
      appointment.time = body.time
      appointment.durationMin = targetDuration
      await appointment.save()
      await writeAuditLog(req as AuthedRequest, 'appointment-reschedule', 'appointment', String(appointment._id), {
        doctorId: String(doctor._id),
        patientId: appointment.patientId,
        from: `${previous.date}T${previous.time}`,
        to: `${body.date}T${body.time}`,
        reason: body.reason,
      })
      void notifyAppointmentEvent(appointment, {
        kind: 'rescheduled',
        previous,
        reason: body.reason,
        note: body.note || undefined,
      })
      res.json(appointment)
    } catch (err) {
      next(err)
    }
  },
)

// ---------- Consultations ----------

doctorPortalRouter.get('/consultations', validate({ query: listQuery }), async (req, res, next) => {
  try {
    const { patientId } = queryOf<{ patientId?: string }>(req)
    const doctor = await resolveDoctor(req)
    const filter: Record<string, unknown> = { doctorId: doctor._id.toString() }
    if (patientId) filter.patientId = patientId
    const consultations = await ConsultationModel.find(filter).sort({ createdAt: -1 })
    res.json(consultations)
  } catch (err) {
    next(err)
  }
})

doctorPortalRouter.get(
  '/consultations/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const doctor = await resolveDoctor(req)
      const consultation = await ConsultationModel.findById(req.params.id)
      if (!consultation) throw new ApiError('Consultation not found', 404)
      if (consultation.doctorId !== doctor._id.toString()) {
        throw new ApiError('You do not have permission to view this consultation', 403)
      }
      res.json(consultation)
    } catch (err) {
      next(err)
    }
  },
)

// POST /doctor-portal/consultations
// Creates the consultation (doctor/patient names resolved server-side),
// creates or links a prescription when one is provided, and marks the
// linked appointment as Completed. Consultations are immutable.
doctorPortalRouter.post('/consultations', validate({ body: consultationBody }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof consultationBody>
    const doctor = await resolveDoctor(req)
    assertCanServe(doctor)
    const patient = await PatientModel.findById(body.patientId)
    if (!patient) throw new ApiError('Patient not found', 404)

    if (body.appointmentId) {
      const appointment = await AppointmentModel.findById(body.appointmentId)
      if (!appointment) throw new ApiError('Appointment not found', 404)
      if (appointment.doctorId !== doctor._id.toString()) {
        throw new ApiError('You do not have permission to complete this appointment', 403)
      }
      if (appointment.patientId !== body.patientId) {
        throw new ApiError('Appointment does not belong to this patient', 400)
      }
      if (appointment.status === 'Completed') {
        throw new ApiError('This appointment has already been completed', 400)
      }
    }

    // Prescription: link an existing one (must belong to doctor + patient),
    // otherwise create it from the inline medicines.
    let prescriptionId = body.prescriptionId
    let prescriptionNo: string | undefined
    if (prescriptionId) {
      const rx = await PrescriptionModel.findById(prescriptionId)
      if (!rx) throw new ApiError('Prescription not found', 404)
      if (rx.doctorId !== doctor._id.toString() || rx.patientId !== patient._id.toString()) {
        throw new ApiError('Prescription does not belong to this patient', 400)
      }
      prescriptionNo = rx.prescriptionNo
    } else if (body.prescription && body.prescription.medicines.length > 0) {
      const rx = await PrescriptionModel.create({
        patientId: patient._id.toString(),
        patientName: `${patient.firstName} ${patient.lastName}`,
        doctorId: doctor._id.toString(),
        doctorName: doctor.name,
        medicines: body.prescription.medicines,
        prescriptionNo: await makeReadableId('prescription', patient.firstName),
        issuedAt: new Date().toISOString().slice(0, 10),
        status: 'Active',
        appointmentId: body.appointmentId,
      })
      prescriptionId = rx._id.toString()
      prescriptionNo = rx.prescriptionNo
    }

    const now = new Date()
    const consultation = await ConsultationModel.create({
      consultationNo: await makeReadableId('consultation', patient.firstName),
      patientId: patient._id.toString(),
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorId: doctor._id.toString(),
      doctorName: doctor.name,
      appointmentId: body.appointmentId,
      chiefComplaint: body.chiefComplaint,
      symptoms: body.symptoms,
      vitals: body.vitals,
      examination: body.examination,
      diagnosis: body.diagnosis,
      clinicalNotes: body.clinicalNotes,
      treatmentPlan: body.treatmentPlan,
      prescriptionId,
      prescriptionNo,
    })

    if (body.appointmentId) {
      await AppointmentModel.updateOne({ _id: body.appointmentId }, { status: 'Completed' })
    }
    await PatientModel.updateOne(
      { _id: patient._id },
      {
        lastVisit: now.toISOString().slice(0, 10),
        $set: { status: patient.status === 'Pending' ? 'Outpatient' : patient.status },
      },
    )

    await writeAuditLog(req as AuthedRequest, 'consultation-create', 'consultation', String(consultation._id), {
      doctorId: String(doctor._id),
      patientId: patient._id.toString(),
      appointmentId: body.appointmentId,
      prescriptionId: prescriptionId ?? null,
    })

    res.status(201).json(consultation)
  } catch (err) {
    next(err)
  }
})

// ---------- Prescriptions ----------

doctorPortalRouter.get('/prescriptions', async (req, res, next) => {
  try {
    const doctor = await resolveDoctor(req)
    const prescriptions = await PrescriptionModel.find({
      doctorId: doctor._id.toString(),
    }).sort({ issuedAt: -1 })
    res.json(prescriptions)
  } catch (err) {
    next(err)
  }
})

doctorPortalRouter.post('/prescriptions', validate({ body: prescriptionBody }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof prescriptionBody>
    const doctor = await resolveDoctor(req)
    assertCanServe(doctor)
    const patient = await PatientModel.findById(body.patientId)
    if (!patient) throw new ApiError('Patient not found', 404)
    if (body.appointmentId) {
      const appointment = await AppointmentModel.findById(body.appointmentId)
      if (!appointment) throw new ApiError('Appointment not found', 404)
      if (appointment.doctorId !== doctor._id.toString()) {
        throw new ApiError('You do not have permission to use this appointment', 403)
      }
    }
    const rx = await PrescriptionModel.create({
      patientId: patient._id.toString(),
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorId: doctor._id.toString(),
      doctorName: doctor.name,
      medicines: body.medicines,
      prescriptionNo: await makeReadableId('prescription', patient.firstName),
      issuedAt: new Date().toISOString().slice(0, 10),
      status: 'Active',
      appointmentId: body.appointmentId,
    })
    await writeAuditLog(req as AuthedRequest, 'prescription-create', 'prescription', String(rx._id), {
      doctorId: String(doctor._id),
      patientId: patient._id.toString(),
      appointmentId: body.appointmentId,
    })
    res.status(201).json(rx)
  } catch (err) {
    next(err)
  }
})

// ---------- GET /doctor-portal/schedule?date= ----------
// Centralized availability for the doctor's own schedule view.
doctorPortalRouter.get(
  '/schedule',
  validate({
    query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  }),
  async (req, res, next) => {
    try {
      const doctor = await resolveDoctor(req)
      const { date } = queryOf<{ date: string }>(req)
      const appointments = await AppointmentModel.find({
        doctorId: doctor._id.toString(),
        date,
        status: { $ne: 'Cancelled' },
      }).sort({ time: 1 })
      res.json({
        date,
        doctorStatus: doctor.status,
        workingDay: isWorkingDay(doctor, date),
        slots: getAvailabilitySlots(doctor, appointments, date),
        appointments,
      })
    } catch (err) {
      next(err)
    }
  },
)
