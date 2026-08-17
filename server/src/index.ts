import { app } from './app.js'
import { env, isProd } from './config/env.js'
import { connectDb } from './config/db.js'

const RETRY_BASE_MS = 5000
const RETRY_MAX_MS = 30000

/**
 * Connects to MongoDB in the background. A failed connection must never take
 * the HTTP server down: the app listens regardless, so the /api/health probe
 * keeps reporting the process as alive and UptimeRobot keeps the service from
 * idling out on Render. Mongoose auto-recovers buffered commands once the
 * connection is re-established.
 */
async function connectWithRetry(uri: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await connectDb(uri)
      console.log('Medicore HMS connected to MongoDB')
      return
    } catch (err) {
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * attempt)
      console.error(
        `MongoDB connection failed (attempt ${attempt}) - retrying in ${delay / 1000}s:`,
        err instanceof Error ? err.message : err,
      )
      await new Promise((r) => setTimeout(r, delay))
    }
  }
}

export async function start(server = app, uri = env.MONGO_URI): Promise<void> {
  // Strict email policy: production refuses to run without real SMTP.
  // The log transport is a test-only escape hatch and is never allowed
  // in production - authentic delivery only.
  if (isProd && (env.EMAIL_TRANSPORT === 'log' || !env.SMTP_HOST)) {
    throw new Error(
      'Production boot blocked: real SMTP delivery is mandatory. ' +
        'Set EMAIL_TRANSPORT=smtp and configure SMTP_HOST (plus SMTP_USER/SMTP_PASS) in server/.env.',
    )
  }
  server.listen(env.PORT, () => {
    console.log(`Medicore HMS API listening on http://localhost:${env.PORT}/api`)
  })
  void connectWithRetry(uri)
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start().catch((err) => {
    console.error('Failed to start Medicore HMS API:', err)
    process.exit(1)
  })
}