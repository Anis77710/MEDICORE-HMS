import { Router } from 'express'
import { z } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { DoctorModel } from '../models/Doctor.js'
import { AppointmentModel } from '../models/Appointment.js'
import { validate } from '../middleware/validate.js'
import { getAvailabilitySlots, isWorkingDay } from '../domain/availability.js'

// ============================================================
// Public endpoints — no auth. Used by the public booking page:
// GET /public/doctors, GET /public/doctors/:id/availability.
// Creating a booking goes through the eSewa payment flow
// (POST /public/payment/initiate → callback) in routes/esewa.ts —
// an appointment is never created without a verified payment.
// ============================================================

export const publicRouter = Router()

// GET /public/doctors — doctors currently available for booking
publicRouter.get('/doctors', async (_req, res, next) => {
  try {
    const doctors = await DoctorModel.find({ status: 'Active' }).sort({ name: 1 })
    res.json(
      doctors.map((d) => ({
        id: String(d._id),
        name: d.name,
        department: d.department,
        specialty: d.specialty,
        consultationFee: d.consultationFee,
        schedule: d.schedule,
      })),
    )
  } catch (err) {
    next(err)
  }
})

// GET /public/doctors/:id/availability?date=YYYY-MM-DD
// Centralized slot generation — same rules as the admin calendar.
publicRouter.get(
  '/doctors/:id/availability',
  validate({
    params: z.object({ id: z.string() }),
    query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  }),
  async (req, res, next) => {
    try {
      const doctor = await DoctorModel.findById(req.params.id)
      if (!doctor) throw new ApiError('Doctor not found', 404)
      const { date } = req.query as { date: string }
      const appointments = await AppointmentModel.find({
        doctorId: String(doctor._id),
        date,
        status: { $ne: 'Cancelled' },
      }).select('date time durationMin status')
      res.json({
        date,
        workingDay: isWorkingDay(doctor, date),
        doctorStatus: doctor.status,
        slots: getAvailabilitySlots(doctor, appointments, date),
      })
    } catch (err) {
      next(err)
    }
  },
)

