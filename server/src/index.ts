import { app } from './app.js'
import { env, isProd } from './config/env.js'
import { connectDb } from './config/db.js'

export async function start(server = app, uri = env.MONGO_URI): Promise<void> {
  // Strict email policy: production refuses to run without real SMTP.
  // The log transport is a test-only escape hatch and is never allowed
  // in production — authentic delivery only.
  if (isProd && (env.EMAIL_TRANSPORT === 'log' || !env.SMTP_HOST)) {
    throw new Error(
      'Production boot blocked: real SMTP delivery is mandatory. ' +
        'Set EMAIL_TRANSPORT=smtp and configure SMTP_HOST (plus SMTP_USER/SMTP_PASS) in server/.env.',
    )
  }
  await connectDb(uri)
  server.listen(env.PORT, () => {
    console.log(`Medicore HMS API listening on http://localhost:${env.PORT}/api`)
  })
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start().catch((err) => {
    console.error('Failed to start Medicore HMS API:', err)
    process.exit(1)
  })
}

