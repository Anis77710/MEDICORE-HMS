import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { AppointmentModel } from '../models/Appointment.js'
import { PatientModel } from '../models/Patient.js'
import { DoctorModel } from '../models/Doctor.js'
import { requireAuth, type AuthedRequest } from '../middleware/auth.js'
import { validate, queryOf } from '../middleware/validate.js'
import { isSlotFree } from '../domain/availability.js'
import { makeReadableId, parseDay } from '../models/Counter.js'
import { writeAuditLog } from './staff.js'
import { notifyAppointmentEvent } from '../utils/appointmentMailer.js'

export const appointmentsRouter = Router()

appointmentsRouter.use(requireAuth)

export const STATUSES = ['Confirmed', 'Pending', 'Completed', 'Cancelled'] as const
const TYPES = ['Checkup', 'Consultation', 'Follow-up', 'Emergency', 'Procedure'] as const

const appointmentBody = z.object({
  patientId: z.string().min(1, 'patient required'),
  doctorId: z.string().min(1, 'doctor required'),
  type: z.enum(TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'time must be HH:mm'),
  durationMin: z.coerce.number().int().min(5).max(240).default(30),
  reason: z.string().default(''),
})

const listQuery = z.object({
  status: z.string().optional(),
  date: z.string().optional(),
  search: z.string().optional(),
})

// GET /appointments?status&date&search
appointmentsRouter.get('/', validate({ query: listQuery }), async (req, res, next) => {
  try {
    const { status, date, search } = queryOf<{ status?: string; date?: string; search?: string }>(req)
    const filter: Record<string, unknown> = {}
    if (status && status !== 'All') filter.status = status
    if (date) filter.date = date
    if (search) {
      const s = search.toLowerCase()
      filter.$or = [
        { patientName: { $regex: s, $options: 'i' } },
        { doctorName: { $regex: s, $options: 'i' } },
        { department: { $regex: s, $options: 'i' } },
      ]
    }
    const appointments = await AppointmentModel.find(filter).sort({ date: 1, time: 1 })
    res.json(appointments)
  } catch (err) {
    next(err)
  }
})

appointmentsRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const appointment = await AppointmentModel.findById(req.params.id)
      if (!appointment) throw new ApiError('Appointment not found', 404)
      res.json(appointment)
    } catch (err) {
      next(err)
    }
  },
)

// POST /appointments — creates with patient/doctor names resolved server-side
appointmentsRouter.post('/', validate({ body: appointmentBody }), async (req, res, next) => {
  try {
    const { patientId, doctorId, ...rest } = req.body as {
      patientId: string
      doctorId: string
      type: string
      date: string
      time: string
      durationMin: number
      reason: string
    }
    const [patient, doctor] = await Promise.all([
      PatientModel.findById(patientId),
      DoctorModel.findById(doctorId),
    ])
    if (!patient) throw new ApiError('Patient not found', 404)
    if (!doctor) throw new ApiError('Doctor not found', 404)
    await assertBookable(doctor, rest.date, rest.time, rest.durationMin)
    const appointment = await AppointmentModel.create({
      ...rest,
      appointmentNo: await makeReadableId('appointment', patient.firstName, parseDay(rest.date)),
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorId,
      doctorName: doctor.name,
      department: doctor.department,
      status: 'Pending',
    })
    await writeAuditLog(req as AuthedRequest, 'appointment-create', 'appointment', String(appointment._id), {
      doctorId,
      patientId,
      date: rest.date,
      time: rest.time,
    })
    void notifyAppointmentEvent(appointment, { kind: 'booked' })
    res.status(201).json(appointment)
  } catch (err) {
    next(err)
  }
})

appointmentsRouter.put(
  '/:id',
  validate({ params: z.object({ id: z.string() }), body: appointmentBody.partial() }),
  async (req, res, next) => {
    try {
      const existing = await AppointmentModel.findById(req.params.id)
      if (!existing) throw new ApiError('Appointment not found', 404)
      const { doctorId, date, time, durationMin } = req.body as {
        doctorId?: string
        date?: string
        time?: string
        durationMin?: number
      }
      const targetDoctorId = doctorId ?? existing.doctorId
      const targetDate = date ?? existing.date
      const targetTime = time ?? existing.time
      const targetDuration = durationMin ?? existing.durationMin
      const rescheduled =
        doctorId || date || time || durationMin !== undefined
      if (rescheduled) {
        const doctor = await DoctorModel.findById(targetDoctorId)
        if (!doctor) throw new ApiError('Doctor not found', 404)
        const clashes = await AppointmentModel.find({
          doctorId: targetDoctorId,
          date: targetDate,
          status: { $ne: 'Cancelled' },
        }).select('date time durationMin status')
        if (
          !isSlotFree(clashes, targetDate, targetTime, targetDuration, existing.id) ||
          doctor.status !== 'Active'
        ) {
          throw new ApiError(
            doctor.status !== 'Active'
              ? `Cannot schedule — ${doctor.name} is ${doctor.status.toLowerCase()}`
              : 'This time slot is already booked for the doctor — choose a different time',
            409,
          )
        }
      }
      const appointment = await AppointmentModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
      if (!appointment) throw new ApiError('Appointment not found', 404)
      await writeAuditLog(req as AuthedRequest, 'appointment-update', 'appointment', String(appointment._id), {
        doctorId: targetDoctorId,
        date: targetDate,
        time: targetTime,
      })
      if (rescheduled) {
        void notifyAppointmentEvent(appointment, {
          kind: 'rescheduled',
          previous: {
            date: existing.date,
            time: existing.time,
            doctorName: existing.doctorName,
          },
        })
      }
      res.json(appointment)
    } catch (err) {
      next(err)
    }
  },
)

// A doctor must be Active to accept new bookings, and the requested
// time must be free (centralized slot rules).
async function assertBookable(
  doctor: { _id: unknown; name: string; status: string },
  date: string,
  time: string,
  durationMin: number,
): Promise<void> {
  if (doctor.status !== 'Active') {
    throw new ApiError(
      `Cannot book — ${doctor.name} is currently ${doctor.status.toLowerCase()}. Choose another doctor or date.`,
      409,
    )
  }
  const clashes = await AppointmentModel.find({
    doctorId: String(doctor._id),
    date,
    status: { $ne: 'Cancelled' },
  }).select('date time durationMin status')
  if (!isSlotFree(clashes, date, time, durationMin)) {
    throw new ApiError('This time slot is already booked for the doctor — choose a different time', 409)
  }
}

appointmentsRouter.delete(
  '/:id',
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const appointment = await AppointmentModel.findByIdAndDelete(req.params.id)
      if (!appointment) throw new ApiError('Appointment not found', 404)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  },
)

// POST /appointments/:id/cancel | /confirm | /complete
appointmentsRouter.post(
  '/:id/cancel',
  validate({ params: z.object({ id: z.string() }) }),
  transition('Cancelled'),
)
appointmentsRouter.post(
  '/:id/confirm',
  validate({ params: z.object({ id: z.string() }) }),
  transition('Confirmed'),
)
appointmentsRouter.post(
  '/:id/complete',
  validate({ params: z.object({ id: z.string() }) }),
  transition('Completed'),
)

function transition(status: (typeof STATUSES)[number]) {
  return async (req: import('express').Request, res: import('express').Response, next: (e?: unknown) => void) => {
    try {
      const appointment = await AppointmentModel.findByIdAndUpdate(req.params.id, { status }, { new: true })
      if (!appointment) throw new ApiError('Appointment not found', 404)
      await writeAuditLog(req as AuthedRequest, `appointment-${status.toLowerCase()}`, 'appointment', String(appointment._id), {
        doctorId: appointment.doctorId,
        patientId: appointment.patientId,
        date: appointment.date,
      })
      if (status === 'Confirmed') void notifyAppointmentEvent(appointment, { kind: 'approved' })
      if (status === 'Cancelled') void notifyAppointmentEvent(appointment, { kind: 'cancelled' })
      res.json(appointment)
    } catch (err) {
      next(err)
    }
  }
}
