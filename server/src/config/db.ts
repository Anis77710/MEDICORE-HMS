import mongoose from 'mongoose'

export async function connectDb(uri = process.env.MONGO_URI ?? ''): Promise<void> {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri)
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect()
}
