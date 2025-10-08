
import { Hono } from 'hono'
import type { Env } from '../types'
import { rid } from '../lib/ids'
import { one, run } from '../lib/d1'

const r = new Hono<{ Bindings: Env; Variables: { userEmail?: string } }>()

r.post('/', async (c) => {
  const { originalAssetId, style, options } = await c.req.json<{ originalAssetId: string; style: string; options?: any }>()
  const asset = await one<any>(c.env.DB, "SELECT * FROM assets WHERE id=?1", [originalAssetId])
  if (!asset) return c.json({ error: 'asset not found' }, 404)
  const id = rid('job_')
  const prompt = stylePrompt(style)
  await run(c.env.DB, "INSERT INTO jobs (id, user_email, original_asset_id, original_r2_key, status, style, prompt, model) VALUES (?1, ?2, ?3, ?4, 'queued', ?5, ?6, ?7)",
    [id, c.get('userEmail') || 'unknown@user', originalAssetId, asset.r2_key, style, prompt.prompt, options?.model || '@cf/black-forest-labs/flux-1-schnell'])
  // Enqueue
  await c.env.JOB_OUT.send({ id })
  return c.json({ jobId: id })
})

r.get('/:id', async (c) => {
  const { id } = c.req.param()
  const job = await one<any>(c.env.DB, "SELECT * FROM jobs WHERE id=?1", [id])
  if (!job) return c.json({ error: 'not found' }, 404)
  return c.json({ job })
})

function stylePrompt(style: string) {
  const presets: Record<string, {prompt: string}> = {
    scandinavian: { prompt: "bright scandinavian interior, light oak wood, white walls, minimalist, natural light, magazine grade" },
    japandi: { prompt: "japandi interior, warm wood, linen, neutral palette, low profile furniture, zen, soft ambient light" },
    luxury: { prompt: "contemporary luxury, marble, brass accents, designer lighting, cinematic" },
    industrial: { prompt: "industrial loft, concrete, black steel frames, leather sofa, matte surfaces" }
  }
  return presets[style] || { prompt: "realistic interior, clean, minimal, soft light" }
}

export default r
