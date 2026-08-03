import 'dotenv/config'

function num(name: string, fallback: number): number {
  const raw = process.env[name]
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? n : fallback
}

function str(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback
}

function csv(name: string, fallback: string): string[] {
  return str(name, fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export const env = {
  NODE_ENV: str('NODE_ENV', 'development'),
  PORT: num('PORT', 8080),
  MONGO_URI: str('MONGO_URI', 'mongodb://127.0.0.1:27017/healsync'),
  CORS_ORIGIN: csv('CORS_ORIGIN', 'http://localhost:5173,http://localhost:5174'),
  JWT_SECRET: str('JWT_SECRET', 'dev-only-secret-change-me'),
  ACCESS_TOKEN_TTL_MIN: num('ACCESS_TOKEN_TTL_MIN', 15),
  REFRESH_TOKEN_TTL_DAYS: num('REFRESH_TOKEN_TTL_DAYS', 7),
  EMAIL_CONSOLE_ONLY: str('EMAIL_CONSOLE_ONLY', 'true') === 'true',
  SMTP_HOST: str('SMTP_HOST', ''),
  SMTP_PORT: num('SMTP_PORT', 587),
  SMTP_USER: str('SMTP_USER', ''),
  SMTP_PASS: str('SMTP_PASS', ''),
  EMAIL_FROM: str('EMAIL_FROM', 'HealSync HMS <no-reply@healsync.health>'),
} as const

export const isProd = env.NODE_ENV === 'production'
