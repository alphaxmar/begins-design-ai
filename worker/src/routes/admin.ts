
import { Hono } from 'hono'
import type { Env } from '../types'
import { all } from '../lib/d1'

const r = new Hono<{ Bindings: Env }>()

r.get('/jobs', async (c) => {
  const status = c.req.query('status')
  const rows = status 
    ? await all<any>(c.env.DB, "SELECT * FROM jobs WHERE status=?1 ORDER BY created_at DESC", [status])
    : await all<any>(c.env.DB, "SELECT * FROM jobs ORDER BY created_at DESC", [])
  return c.json({ jobs: rows })
})

export default r
