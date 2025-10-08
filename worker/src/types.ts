
export interface Env {
  R2: R2Bucket
  DB: D1Database
  AI: Ai
  JOB_OUT: Queue
  JWT_SECRET: string
  ASSET_BASE: string
  ACCESS_AUD: string
  ACCESS_JWKS_URL: string
  STRIPE_SECRET: string
  STRIPE_WEBHOOK_SECRET: string
}
