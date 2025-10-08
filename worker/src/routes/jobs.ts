
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

    const { originalAssetId, style, options, mode } = body as { 
      originalAssetId?: string; 
      style: string; 
      options?: {
        prompt?: string
        negative_prompt?: string
        strength?: number
        model?: string
        mode?: 'text-to-image' | 'image-to-image'
        // Advanced parameters (similar to AUTOMATIC1111)
        cfg_scale?: number
        steps?: number
        seed?: number
        sampler?: string
        // FLUX specific parameters
        aspect_ratio?: string
      };
      mode?: 'text-to-image' | 'image-to-image'
    }
    logger.info('Job creation request validated', { originalAssetId, style, mode, options })
    
    // Handle different modes
    let asset = null
    let r2Key = null
    let finalAssetId = originalAssetId || 'text-to-image-placeholder'
    
    if (mode === 'text-to-image') {
      // For text-to-image, we don't need an actual asset
      // The style parameter contains the custom prompt
      logger.info('Text-to-image mode detected', { customPrompt: style })
      
      // Validate custom prompt
      if (!style || style.trim() === '') {
        logger.warn('Missing custom prompt for text-to-image mode')
        return c.json({ error: 'Custom prompt is required for text-to-image mode' }, 400)
      }
      
      // Set placeholders for text-to-image
      finalAssetId = 'text-to-image-placeholder'
      r2Key = 'text-to-image-placeholder' // Use placeholder string for NOT NULL constraint
    } else {
      // For image-to-image mode, validate required fields
      if (!originalAssetId) {
        logger.warn('Missing originalAssetId in request')
        return c.json({ error: 'originalAssetId is required for image-to-image mode' }, 400)
      }
      if (!style) {
        logger.warn('Missing style in request')
        return c.json({ error: 'style is required for image-to-image mode' }, 400)
      }
      
      // Get asset information
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
      
      r2Key = asset.r2_key
    }

    // Create job
    const jobId = rid('job_')
    try {
      await run(c.env.DB, "INSERT INTO jobs (id, user_email, original_asset_id, original_r2_key, style, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6)", [
        jobId, 
        c.get('userEmail') || 'unknown@user', 
        finalAssetId, 
        r2Key, // Use null for text-to-image, actual key for image-to-image
        style, 
        'processing'
      ])
      logger.info('Job created successfully', { jobId, finalAssetId, style, mode })
    } catch (dbError) {
      logger.error('Database error during job creation', dbError, { jobId, originalAssetId })
      return c.json({ 
        error: 'Database error', 
        message: 'Failed to create job record' 
      }, 500)
    }

    try {
      logger.info('Starting AI pipeline processing', { jobId, mode })
      
      // Run AI pipeline with mode information
      const outputR2Key = await runPipeline(c.env, {
        id: jobId,
        originalAssetId: finalAssetId,
        style,
        userEmail: c.get('userEmail') || 'unknown@user',
        options: { ...options, mode },
        r2Key: r2Key // Pass the r2Key (null for text-to-image)
      })

      logger.info('AI pipeline completed successfully', { jobId, outputR2Key })

      // Update job status to succeeded
      await run(c.env.DB, "UPDATE jobs SET status=?1, output_r2_key=?2 WHERE id=?3", ['succeeded', outputR2Key, jobId])

      logger.info('Job completed successfully', { jobId, outputR2Key })
      return c.json({ jobId, status: 'succeeded', outputR2Key })
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
  const job = await c.env.DB.prepare("SELECT * FROM jobs WHERE id=?1").bind(id).first()
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
