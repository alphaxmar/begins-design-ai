import { Hono } from 'hono'
import type { Env } from '../types'

const r = new Hono<{ Bindings: Env; Variables: { userEmail?: string } }>()

// GET /api/assets/:assetId - ดาวน์โหลดไฟล์จาก R2
r.get('/:assetId', async (c) => {
  try {
    const { assetId } = c.req.param()
    
    // ดึงข้อมูล asset จากฐานข้อมูล
    const asset = await c.env.DB.prepare("SELECT * FROM assets WHERE id = ?").bind(assetId).first()
    
    if (!asset) {
      return c.json({ error: 'Asset not found' }, 404)
    }
    
    if (!asset.r2_key) {
      return c.json({ error: 'Asset file not available' }, 404)
    }
    
    // ดึงไฟล์จาก R2
    const obj = await c.env.R2.get(asset.r2_key)
    
    if (!obj) {
      return c.json({ error: 'File not found in storage' }, 404)
    }
    
    // ส่งไฟล์กลับ
    return new Response(obj.body, {
      headers: {
        'Content-Type': asset.mime || 'application/octet-stream',
        'Content-Length': obj.size.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache 1 year
        'ETag': obj.etag
      }
    })
    
  } catch (error) {
    console.error('Asset download error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default r