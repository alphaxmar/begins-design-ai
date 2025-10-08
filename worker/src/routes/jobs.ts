
import { Hono } from 'hono'
import type { Env } from '../types'
import { rid } from '../lib/ids'
import { run } from '../lib/d1'
import { runPipeline } from '../ai/pipeline'
import { createRequestLogger } from '../lib/logger'

const r = new Hono<{ Bindings: Env; Variables: { userEmail?: string } }>()

r.post('/', async (c) => {
  const logger = createRequestLogger(c)
  
  try {
    logger.info('Job creation request started')
    // Validate request body
    const body = await c.req.json().catch(() => null)
    if (!body) {
      logger.warn('Invalid JSON in request body')
      return c.json({ error: 'Invalid JSON in request body' }, 400)
    }

    const { originalAssetId, style, options } = body as { originalAssetId: string; style: string; options?: any }
    logger.info('Job creation request validated', { originalAssetId, style })
    
    // Validate required fields
    if (!originalAssetId) {
      logger.warn('Missing originalAssetId in request')
      return c.json({ error: 'originalAssetId is required' }, 400)
    }
    if (!style) {
      logger.warn('Missing style in request')
      return c.json({ error: 'style is required' }, 400)
    }

    // Get asset information
    let asset
    try {
      asset = await c.env.DB.prepare("SELECT * FROM assets WHERE id = ?").bind(originalAssetId).first()
      logger.info('Asset lookup completed', { assetFound: !!asset })
    } catch (dbError) {
      logger.error('Database error during asset lookup', dbError, { originalAssetId })
      return c.json({ 
        error: 'Database error', 
        message: 'Failed to retrieve asset information' 
      }, 500)
    }

    if (!asset) {
      logger.warn('Asset not found', { originalAssetId })
      return c.json({ 
        error: 'Asset not found', 
        message: `No asset found with ID: ${originalAssetId}` 
      }, 404)
    }

    if (!asset.r2_key) {
      logger.warn('Asset incomplete - missing R2 key', { originalAssetId })
      return c.json({ 
        error: 'Asset incomplete', 
        message: 'Asset has not been uploaded to storage yet' 
      }, 400)
    }

    // Create job
    const jobId = rid('job_')
    try {
      await run(c.env.DB, "INSERT INTO jobs (id, user_email, original_asset_id, style, status, options) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", [
        jobId, c.get('userEmail') || 'unknown@user', originalAssetId, style, 'processing', JSON.stringify(options || {})
      ])
      logger.info('Job created successfully', { jobId, originalAssetId, style })
    } catch (dbError) {
      logger.error('Database error during job creation', dbError, { jobId, originalAssetId })
      return c.json({ 
        error: 'Database error', 
        message: 'Failed to create job record' 
      }, 500)
    }

    try {
      logger.info('Starting AI pipeline processing', { jobId })
      
      // Run AI pipeline
      const outputAssetId = await runPipeline(c.env, {
        id: jobId,
        originalAssetId,
        style,
        options: options || {}
      })

      logger.info('AI pipeline completed successfully', { jobId, outputAssetId })

      // Update job status to succeeded
      await run(c.env.DB, "UPDATE jobs SET status=?1, output_asset_id=?2 WHERE id=?3", ['succeeded', outputAssetId, jobId])

      logger.info('Job completed successfully', { jobId, outputAssetId })
      return c.json({ jobId, status: 'succeeded', outputAssetId })
    } catch (error) {
      logger.error('Pipeline processing failed', error, { jobId, originalAssetId, style })
      
      // Update job status to failed
      try {
        await run(c.env.DB, "UPDATE jobs SET status=?1 WHERE id=?2", ['failed', jobId])
        logger.info('Job status updated to failed', { jobId })
      } catch (updateError) {
        logger.error('Failed to update job status to failed', updateError, { jobId })
      }
      
      // Return specific error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('5012')) {
          logger.warn('Unsupported image format detected', { jobId, errorMessage: error.message })
          return c.json({ 
            error: 'Processing failed', 
            message: 'Unsupported image format. Please use PNG or JPEG files for AI processing.',
            details: 'SVG and other vector formats are not supported by the AI model.'
          }, 400)
        }
        if (error.message.includes('not found')) {
          logger.warn('Image file not found in storage', { jobId, errorMessage: error.message })
          return c.json({ 
            error: 'Processing failed', 
            message: 'Image file not found in storage. Please re-upload the image.',
            details: 'The uploaded image could not be retrieved from cloud storage.'
          }, 404)
        }
      }
      
      return c.json({ 
        error: 'Processing failed', 
        message: 'AI processing encountered an error. Please try again or contact support.',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }, 500)
    }
  } catch (error) {
    logger.error('Unexpected error during job creation', error)
    return c.json({ 
      error: 'Failed to create job',
      message: 'An unexpected error occurred. Please try again.'
    }, 500)
  }
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
