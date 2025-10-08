
import { Hono } from 'hono'
import type { Env } from '../types'
import { rid } from '../lib/ids'
import { run } from '../lib/d1'
import { createRequestLogger } from '../lib/logger'

const r = new Hono<{ Bindings: Env; Variables: { userEmail?: string } }>()

r.post('/presign', async (c) => {
  const logger = createRequestLogger(c)
  
  try {
    logger.info('Presign request started')
    // Validate request body
    const body = await c.req.json().catch(() => null)
    if (!body) {
      return c.json({ error: 'Invalid JSON in request body' }, 400)
    }

    const { filename, mime, kind } = body as { filename: string; mime: string; kind: string }
    
    // Validate required fields
    if (!filename) {
      return c.json({ error: 'filename is required' }, 400)
    }
    if (!mime) {
      return c.json({ error: 'mime type is required' }, 400)
    }

    // Validate file extension and mime type
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'image/svg+xml' // Allow SVG but warn about compatibility
    ]
    if (!allowedMimes.includes(mime)) {
      return c.json({ 
        error: 'Unsupported file type', 
        message: 'Only image files (JPEG, PNG, WebP, GIF, SVG) are supported.',
        supportedTypes: allowedMimes 
      }, 400)
    }

    // Validate filename
    if (filename.length > 255) {
      return c.json({ error: 'Filename too long', message: 'Filename must be less than 255 characters.' }, 400)
    }

    const id = rid('ast_')
    const key = `${kind || 'original'}/${id}-${filename}`
    
    // Instead of presigned URL, return upload endpoint
    const uploadUrl = `${new URL(c.req.url).origin}/api/uploads/upload/${id}`
    
    try {
      await run(c.env.DB, "INSERT INTO assets (id, user_email, kind, r2_key, mime) VALUES (?1, ?2, ?3, ?4, ?5)", [
        id, c.get('userEmail') || 'unknown@user', kind || 'original', key, mime
      ])
    } catch (dbError) {
      console.error('Database error during presign:', dbError)
      return c.json({ 
        error: 'Database error', 
        message: 'Failed to create asset record in database.' 
      }, 500)
    }
    
    const response: any = { uploadUrl, r2Key: key, assetId: id }
    
    // Add warning for SVG files
    if (mime === 'image/svg+xml') {
      response.warning = 'SVG files may not be compatible with AI processing. Consider using PNG or JPEG for better results.'
    }
    
    return c.json(response)
  } catch (error) {
    console.error('Presign error:', error)
    return c.json({ 
      error: 'Failed to create presigned URL',
      message: 'An unexpected error occurred while preparing the upload.' 
    }, 500)
  }
})

r.put('/upload/:id', async (c) => {
  const logger = createRequestLogger(c)
  
  try {
    logger.info('Upload request started', { assetId: c.req.param('id') })
    const id = c.req.param('id')
    
    // Validate asset ID format
    if (!id || !id.startsWith('ast_')) {
      return c.json({ 
        error: 'Invalid asset ID', 
        message: 'Asset ID must be provided and start with "ast_"' 
      }, 400)
    }
    
    // Get request body as stream
    const body = await c.req.raw.body
    if (!body) {
      return c.json({ 
        error: 'No file data', 
        message: 'Request body must contain file data' 
      }, 400)
    }
    
    // Get asset info from database
    let asset
    try {
      asset = await c.env.DB.prepare("SELECT * FROM assets WHERE id = ?").bind(id).first()
    } catch (dbError) {
      console.error('Database error during upload lookup:', dbError)
      return c.json({ 
        error: 'Database error', 
        message: 'Failed to retrieve asset information from database' 
      }, 500)
    }
    
    if (!asset) {
      return c.json({ 
        error: 'Asset not found', 
        message: `No asset found with ID: ${id}. Please create a presigned URL first.` 
      }, 404)
    }
    
    // Validate that asset has required fields
    if (!asset.r2_key || !asset.mime) {
      return c.json({ 
        error: 'Invalid asset record', 
        message: 'Asset record is missing required information (r2_key or mime)' 
      }, 500)
    }
    
    // Upload to R2
    try {
      await c.env.R2.put(asset.r2_key, body, {
        httpMetadata: {
          contentType: asset.mime
        }
      })
    } catch (r2Error) {
      console.error('R2 upload error:', r2Error)
      return c.json({ 
        error: 'Storage upload failed', 
        message: 'Failed to upload file to cloud storage' 
      }, 500)
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ 
      error: 'Upload failed',
      message: 'An unexpected error occurred during file upload' 
    }, 500)
  }
})

r.post('/commit', async (c) => {
  const logger = createRequestLogger(c)
  
  try {
    logger.info('Commit request started')
    // Validate request body
    const body = await c.req.json().catch(() => null)
    if (!body) {
      return c.json({ error: 'Invalid JSON in request body' }, 400)
    }

    // Validate required fields
    const { assetId, width, height, bytes, checksum } = body
    if (!assetId) {
      return c.json({ error: 'assetId is required' }, 400)
    }
    if (!assetId.startsWith('ast_')) {
      return c.json({ 
        error: 'Invalid asset ID format', 
        message: 'Asset ID must start with "ast_"' 
      }, 400)
    }

    // Validate numeric fields
    if (width !== undefined && (typeof width !== 'number' || width < 0)) {
      return c.json({ error: 'width must be a non-negative number' }, 400)
    }
    if (height !== undefined && (typeof height !== 'number' || height < 0)) {
      return c.json({ error: 'height must be a non-negative number' }, 400)
    }
    if (bytes !== undefined && (typeof bytes !== 'number' || bytes < 0)) {
      return c.json({ error: 'bytes must be a non-negative number' }, 400)
    }

    // Check if asset exists before updating
    let existingAsset
    try {
      existingAsset = await c.env.DB.prepare("SELECT id FROM assets WHERE id = ?").bind(assetId).first()
    } catch (dbError) {
      console.error('Database error during commit lookup:', dbError)
      return c.json({ 
        error: 'Database error', 
        message: 'Failed to verify asset existence' 
      }, 500)
    }

    if (!existingAsset) {
      return c.json({ 
        error: 'Asset not found', 
        message: `No asset found with ID: ${assetId}` 
      }, 404)
    }

    // Update asset with metadata
    try {
      await run(c.env.DB, "UPDATE assets SET width=?1, height=?2, bytes=?3, checksum=?4, meta=?5 WHERE id=?6",
        [width, height, bytes, checksum, JSON.stringify(body.meta || {}), assetId])
    } catch (dbError) {
      console.error('Database error during commit update:', dbError)
      return c.json({ 
        error: 'Database error', 
        message: 'Failed to update asset metadata' 
      }, 500)
    }

    return c.json({ ok: true })
  } catch (error) {
    console.error('Commit error:', error)
    return c.json({ 
      error: 'Commit failed',
      message: 'An unexpected error occurred while committing asset metadata' 
    }, 500)
  }
})

export default r
