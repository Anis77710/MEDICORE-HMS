import mongoose from 'mongoose'
import { loadRegistry, syncDefaultTenantToRegistry } from './tenants.js'
import { ensureMasterAdmin } from './platform.js'

export async function connectDb(uri = process.env.MONGO_URI ?? ''): Promise<void> {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri)
  await loadRegistry()
  await syncDefaultTenantToRegistry()
  await ensureMasterAdmin()
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect()
}
