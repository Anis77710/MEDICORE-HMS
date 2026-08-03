import 'dotenv/config'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { connectDb } from '../config/db.js'
import { seedData } from '../seed/run.js'
import { start } from '../index.js'

const mongo = await MongoMemoryServer.create()
await connectDb(mongo.getUri())
await seedData()
await start(undefined, mongo.getUri())
