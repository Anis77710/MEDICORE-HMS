import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { env, isProd } from './config/env.js'
import { ApiError } from './utils/ApiError.js'
import { requireErrorHandler } from './middleware/errorHandler.js'
import { authRouter } from './routes/auth.js'
import { patientsRouter } from './routes/patients.js'
import { doctorsRouter } from './routes/doctors.js'
import { appointmentsRouter } from './routes/appointments.js'
import { departmentsRouter } from './routes/departments.js'
import { pharmacyRouter } from './routes/pharmacy.js'
import { billingRouter } from './routes/billing.js'
import { staffRouter } from './routes/staff.js'
import { dashboardRouter } from './routes/dashboard.js'
import { reportsRouter } from './routes/reports.js'
import { settingsRouter } from './routes/settings.js'

export const app = express()

app.disable('x-powered-by')

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no Origin (curl, server-to-server, same-origin).
      if (!origin) {
        callback(null, true)
        return
      }
      // In dev, allow any localhost origin (Vite picks ports dynamically).
      if (!isProd && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        callback(null, true)
        return
      }
      if (env.CORS_ORIGIN.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new ApiError('Origin not allowed by CORS', 403))
    },
    credentials: true,
  }),
)

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(morgan(isProd ? 'combined' : 'dev'))

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

app.use('/api', globalLimiter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'healsync-api', time: new Date().toISOString() })
})

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/patients', patientsRouter)
app.use('/api/doctors', doctorsRouter)
app.use('/api/appointments', appointmentsRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/pharmacy', pharmacyRouter)
app.use('/api/billing', billingRouter)
app.use('/api/staff', staffRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/settings', settingsRouter)

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' })
})

app.use(requireErrorHandler)
