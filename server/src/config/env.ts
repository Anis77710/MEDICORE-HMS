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
  // Email delivery. Default 'smtp' — all emails go through a real SMTP
  // server. 'log' is an explicit test-only escape hatch (captures messages
  // in memory and prints them); it must never be used in production.
  EMAIL_TRANSPORT: str('EMAIL_TRANSPORT', 'smtp') === 'log' ? 'log' : 'smtp',
  SMTP_HOST: str('SMTP_HOST', ''),
  SMTP_PORT: num('SMTP_PORT', 587),
  SMTP_USER: str('SMTP_USER', ''),
  SMTP_PASS: str('SMTP_PASS', ''),
  EMAIL_FROM: str('EMAIL_FROM', 'Medicore HMS <no-reply@medicore.health>'),
  // eSewa online payments. Empty PRODUCT_CODE/SECRET_KEY means payments
  // are not configured — the payment endpoint refuses to start (503) so
  // a public booking can never be created without a verified payment.
  ESEWA_ENV: str('ESEWA_ENV', 'test') === 'live' ? 'live' : 'test',
  ESEWA_PRODUCT_CODE: str('ESEWA_PRODUCT_CODE', ''),
  ESEWA_SECRET_KEY: str('ESEWA_SECRET_KEY', ''),
  // Public frontend origin (success/failure redirect target) and API
  // origin (eSewa callback URLs). Same value in production.
  APP_BASE_URL: str('APP_BASE_URL', 'http://localhost:5173'),
  APP_API_URL: str('APP_API_URL', 'http://localhost:8080'),
} as const

export const isProd = env.NODE_ENV === 'production'
