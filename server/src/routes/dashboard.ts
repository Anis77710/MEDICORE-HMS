import { Router } from 'express'
import { PatientModel } from '../models/Patient.js'
import { DoctorModel } from '../models/Doctor.js'
import { DepartmentModel } from '../models/Department.js'
import { AppointmentModel } from '../models/Appointment.js'
import { InvoiceModel } from '../models/Billing.js'
import { requireAuth } from '../middleware/auth.js'
import { hospitalOf } from '../middleware/tenant.js'
import { cachedHospital } from '../config/tenants.js'
import { platformAnnouncementModel } from '../config/platform.js'

// A patient occupies a bed only while admitted or critical (inpatient).
const OCCUPYING_STATUSES = ['Admitted', 'Critical']

export const dashboardRouter = Router()

dashboardRouter.use(requireAuth)

// GET /dashboard/stats - aggregated metrics for the landing dashboard
dashboardRouter.get('/stats', async (_req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const monthStart = today.slice(0, 8) + '01'

    const [patients, doctors, departments, appointmentsToday, appointments, invoicesMonth] =
      await Promise.all([
        PatientModel.find(),
        DoctorModel.find(),
        DepartmentModel.find(),
        AppointmentModel.countDocuments({ date: today }),
        AppointmentModel.find(),
        InvoiceModel.find({ issuedAt: { $gte: monthStart } }),
      ])

    const totalPatients = patients.length
    const bedTotal = departments.reduce((s, d) => s + d.bedCount, 0)
    // Occupancy is derived from registered patients currently in a bed,
    // never from stored/mock numbers on the department record.
    const occupiedByDept = new Map<string, number>()
    for (const p of patients) {
      if (OCCUPYING_STATUSES.includes(p.status)) {
        occupiedByDept.set(p.department, (occupiedByDept.get(p.department) ?? 0) + 1)
      }
    }
    const bedOccupied = departments.reduce(
      (s, d) => s + (occupiedByDept.get(d.name) ?? 0),
      0,
    )
    const revenueMonth = invoicesMonth.reduce((s, i) => s + i.total, 0)

    const trend = appointments.reduce<Record<string, { admissions: number; discharges: number }>>(
      (acc, a) => {
        const month = a.date.slice(0, 7)
        const key = `2026-${month.slice(5)}` // stable key regardless of DB data
        acc[key] ??= { admissions: 0, discharges: 0 }
        if (a.type === 'Emergency' || a.type === 'Procedure' || a.status === 'Completed') {
          if (a.type === 'Emergency' || a.type === 'Procedure') acc[key].admissions++
          else acc[key].discharges++
        }
        return acc
      },
      {},
    )
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const admissionsTrend = monthNames.map((month, i) => ({
      month,
      admissions: trend[`2026-${String(i + 1).padStart(2, '0')}`]?.admissions ?? 0,
      discharges: trend[`2026-${String(i + 1).padStart(2, '0')}`]?.discharges ?? 0,
    }))

    const byDepartment = departments.reduce<Record<string, number>>((acc, d) => {
      acc[d.name] = patients.filter((p) => p.department === d.name).length
      return acc
    }, {})
    const departmentWorkload = departments.map((d) => ({
      department: d.name,
      patients: byDepartment[d.name] ?? 0,
    }))

    const statusCounts = { Confirmed: 0, Pending: 0, Completed: 0, Cancelled: 0 }
    for (const a of appointments) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1
    const appointmentStatus = (Object.entries(statusCounts) as [string, number][]).map(
      ([status, count]) => ({ status, count }),
    )

    const upcoming = await AppointmentModel.find({ date: { $gte: today } })
      .sort({ date: 1, time: 1 })
      .limit(8)

    const doctorById = new Map(doctors.map((d) => [String(d._id), d.name]))

    const recentActivity = appointments
      .slice()
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 6)
      .map((a) => ({
        id: String(a._id),
        type: a.type === 'Emergency' ? 'admission' : 'appointment',
        message: `${a.status === 'Pending' ? 'Appointment booked' : a.status}: ${a.patientName} → ${a.doctorName}`,
        time: a.createdAt ? `${Math.max(1, Math.round((Date.now() - a.createdAt.getTime()) / 3600000))}h ago` : 'today',
        actor: doctorById.get(a.doctorId) ?? a.doctorName ?? 'Front Desk',
      }))

    res.json({
      totalPatients,
      patientsChange: 0,
      appointmentsToday,
      appointmentsChange: 0,
      bedOccupancy: bedTotal > 0 ? Math.round((bedOccupied / bedTotal) * 100) : 0,
      bedOccupancyChange: 0,
      revenueMonth,
      revenueChange: 0,
      admissionsTrend,
      departmentWorkload,
      appointmentStatus,
      upcomingAppointments: upcoming,
      recentActivity,
      departmentOccupancy: departments.map((d) => ({
        department: d.name,
        occupied: occupiedByDept.get(d.name) ?? 0,
        capacity: d.bedCount,
      })),
    })
  } catch (err) {
    next(err)
  }
})

// GET /dashboard/announcements - platform announcements the master admin
// posted. "all" reaches every hospital; "active" only active ones.
dashboardRouter.get('/announcements', async (req, res, next) => {
  try {
    const slug = hospitalOf(req).slug
    const record = cachedHospital(slug)
    const audience = record?.status === 'active' ? { $in: ['all', 'active'] } : 'all'
    const items = await platformAnnouncementModel()
      .find({ active: true, audience })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
    res.json({
      items: items.map((a) => ({
        id: String(a._id),
        title: a.title,
        message: a.message,
        createdAt: a.createdAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})
