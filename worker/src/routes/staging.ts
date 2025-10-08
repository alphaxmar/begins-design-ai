
import { Hono } from 'hono'
import type { Env } from '../types'
import { one, run } from '../lib/d1'
import { runPipeline } from '../ai/pipeline'

const r = new Hono<{ Bindings: Env; Variables: { userEmail?: string } }>()

r.post('/:id/run', async (c) => {
  const { id } = c.req.param()
  const job = await one<any>(c.env.DB, "SELECT * FROM jobs WHERE id=?1", [id])
  if (!job) return c.json({ error: 'not found' }, 404)
  await run(c.env.DB, "UPDATE jobs SET status='processing', updated_at=strftime('%s','now') WHERE id=?1", [id])
  try {
    const outKey = await runPipeline(c.env, job)
    await run(c.env.DB, "UPDATE jobs SET status='succeeded', output_r2_key=?1, updated_at=strftime('%s','now') WHERE id=?2", [outKey, id])
    return c.json({ ok: true, outKey })
  } catch (e: any) {
    await run(c.env.DB, "UPDATE jobs SET status='failed', error=?1, updated_at=strftime('%s','now') WHERE id=?2", [String(e), id])
    return c.json({ ok: false, error: String(e) }, 500)
  }
})

export default r

// Note: In production, consume `staging-jobs` queue and call the same pipeline.
// Wrangler's consumers binding will call an exported `queue` handler in index.ts if added.
