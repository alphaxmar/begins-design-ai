
import { Hono } from 'hono'
import type { Env } from '../types'
import { run } from '../lib/d1'

const r = new Hono<{ Bindings: Env; Variables: { userEmail?: string } }>()

// Create checkout (stub; integrate Stripe as needed)
r.post('/create-checkout', async (c) => {
  const { product } = await c.req.json<{ product: string }>()
  // In a real impl, create Stripe checkout session; here we just grant credits immediately for demo.
  const user = c.get('userEmail') || 'unknown@user'
  const grant = product === 'pack_200' ? 200 : 60
  await run(c.env.DB, "INSERT INTO usage_logs (id, user_email, amount, reason) VALUES (?1, ?2, ?3, 'purchase')",
    [crypto.randomUUID(), user, grant])
  return c.json({ ok: true, granted: grant, note: "Stubbed: credits granted directly." })
})

export default r
