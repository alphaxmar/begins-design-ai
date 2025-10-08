
import { Hono } from 'hono'
import type { Env } from '../types'
import { rid } from '../lib/ids'
import { run } from '../lib/d1'

const r = new Hono<{ Bindings: Env; Variables: { userEmail?: string } }>()

r.post('/presign', async (c) => {
  const { filename, mime, kind } = await c.req.json<{ filename: string; mime: string; kind: string }>()
  const id = rid('ast_')
  const key = `${kind || 'original'}/${id}-${filename}`
  // Signed upload URL — using R2 multipart upload URLs available in new API; fallback simple key
  const url = await c.env.R2.createSignedUploadUrl(key, { expiresIn: 900, headers: { 'content-type': mime } })
  await run(c.env.DB, "INSERT INTO assets (id, user_email, kind, r2_key, mime) VALUES (?1, ?2, ?3, ?4, ?5)", [
    id, c.get('userEmail') || 'unknown@user', kind || 'original', key, mime
  ])
  return c.json({ uploadUrl: url, r2Key: key, assetId: id })
})

r.post('/commit', async (c) => {
  const body = await c.req.json()
  await run(c.env.DB, "UPDATE assets SET width=?1, height=?2, bytes=?3, checksum=?4, meta=?5 WHERE id=?6",
    [body.width, body.height, body.bytes, body.checksum, JSON.stringify(body.meta||{}), body.assetId])
  return c.json({ ok: true })
})

export default r
