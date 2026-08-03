import { app } from './app.js'
import { env } from './config/env.js'
import { connectDb } from './config/db.js'

export async function start(server = app, uri = env.MONGO_URI): Promise<void> {
  await connectDb(uri)
  server.listen(env.PORT, () => {
    console.log(`HealSync API listening on http://localhost:${env.PORT}/api`)
  })
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  start().catch((err) => {
    console.error('Failed to start HealSync API:', err)
    process.exit(1)
  })
}
