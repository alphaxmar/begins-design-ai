
import type { Env } from '../types'
import { generate } from './workers-ai'
import { putR2 } from '../lib/r2'
import { Logger } from '../lib/logger'

export interface PipelineJob {
  id: string
  originalAssetId: string
  style: string
  userEmail?: string
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
  }
  r2Key?: string | null // Add r2Key parameter
}

export async function runPipeline(env: Env, job: PipelineJob): Promise<string> {
  const logger = new Logger({ jobId: job.id, originalAssetId: job.originalAssetId })
  
  try {
    const mode = job.options?.mode || 'image-to-image'
    logger.info('Pipeline processing started', { style: job.style, mode })

    let asset = null
    let r2Key = job.r2Key // Use the r2Key passed from jobs.ts

    if (mode === 'image-to-image' && r2Key && r2Key !== 'text-to-image-placeholder') {
      // Get asset information from database for image-to-image mode
      try {
        asset = await env.DB.prepare("SELECT * FROM assets WHERE id = ?").bind(job.originalAssetId).first()
        if (!asset) {
          throw new Error(`Asset not found: ${job.originalAssetId}`)
        }
        if (!asset.r2_key) {
          throw new Error(`Asset missing R2 key: ${job.originalAssetId}`)
        }
        // Verify r2Key matches
        if (asset.r2_key !== r2Key) {
          throw new Error(`R2 key mismatch for asset: ${job.originalAssetId}`)
        }
        logger.info('Asset retrieved successfully', { r2Key: asset.r2_key, mime: asset.mime })
      } catch (dbError) {
        logger.error('Database error during asset lookup', dbError)
        throw new Error(`Failed to retrieve asset: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`)
      }

      // Validate image format
      const supportedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      if (!supportedMimes.includes(asset.mime)) {
        logger.warn('Unsupported image format', { mime: asset.mime, supportedMimes })
        throw new Error(`Unsupported image format: ${asset.mime}. Supported formats: ${supportedMimes.join(', ')}`)
      }
    } else {
      // For text-to-image mode, we don't need an asset
      logger.info('Text-to-image mode - no asset required')
    }

    // Generate prompt based on mode
    let prompt: string
    let negativePrompt: string
    
    if (mode === 'text-to-image') {
      // For text-to-image, use the style parameter as the custom prompt
      prompt = job.style
      negativePrompt = job.options?.negative_prompt || 'blurry, low quality, distorted, ugly, bad anatomy'
    } else {
      // For image-to-image, use style-based prompts
      const stylePrompts = {
        modern: 'modern interior design, clean lines, minimalist, contemporary furniture, bright lighting',
        vintage: 'vintage interior design, retro furniture, warm colors, classic elements, nostalgic atmosphere',
        industrial: 'industrial interior design, exposed brick, metal fixtures, raw materials, urban loft style',
        scandinavian: 'scandinavian interior design, light wood, white walls, cozy textiles, hygge atmosphere',
        luxury: 'luxury interior design, high-end furniture, elegant decor, premium materials, sophisticated lighting',
        japandi: 'japandi interior design, warm wood, linen, neutral palette, low profile furniture, zen, soft ambient light'
      }
      
      prompt = job.options?.prompt || stylePrompts[job.style as keyof typeof stylePrompts] || stylePrompts.modern
      negativePrompt = job.options?.negative_prompt || 'clutter, artifacts, distorted geometry, poor lighting, low quality'
    }

    const strength = job.options?.strength ?? 0.6
    const model = job.options?.model ?? '@cf/black-forest-labs/flux-1-schnell'

    logger.info('AI processing parameters', { prompt, strength, model, mode })

     // Run AI processing
     let processedImage: Uint8Array
     try {
       processedImage = await generate(env, {
         r2Key: (r2Key === 'text-to-image-placeholder') ? undefined : r2Key, // undefined for text-to-image, actual key for image-to-image
         prompt: prompt || 'magazine-grade interior, realistic, soft light, clean layout',
         neg: negativePrompt || 'clutter, artifacts, distorted geometry',
         strength: strength ?? 0.6,
         model,
         // Pass advanced parameters
         cfg_scale: job.options?.cfg_scale,
         steps: job.options?.steps,
         seed: job.options?.seed,
         sampler: job.options?.sampler,
         // FLUX specific parameters
         aspect_ratio: job.options?.aspect_ratio
       })
       logger.info('AI processing completed successfully')
     } catch (aiError) {
      logger.error('AI processing failed', aiError)
      
      // Handle specific AI errors
      if (aiError instanceof Error) {
        if (aiError.message.includes('5012') || aiError.message.includes('bytes_type')) {
          throw new Error('Image format not supported by AI model. Please use PNG or JPEG format.')
        }
        if (aiError.message.includes('not found')) {
          throw new Error('Image file not found in storage. Please re-upload the image.')
        }
        if (aiError.message.includes('quota') || aiError.message.includes('limit')) {
          throw new Error('AI processing quota exceeded. Please try again later.')
        }
      }
      
      throw new Error(`AI processing failed: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`)
    }

    // Save output to R2
    const outputKey = `outputs/${job.id}.png`
    try {
      await putR2(env.R2, outputKey, processedImage, { 
        httpMetadata: { contentType: 'image/png' } 
      })
      logger.info('Output saved to R2 successfully', { outputKey })
    } catch (r2Error) {
      logger.error('Failed to save output to R2', r2Error)
      throw new Error(`Failed to save processed image: ${r2Error instanceof Error ? r2Error.message : 'Unknown storage error'}`)
    }

    // Create output asset record
    try {
      const outputAssetId = `ast_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`
      
      // Get user email - prioritize job.userEmail, then asset.user_email, then default
      let userEmail = job.userEmail || 'unknown@user'
      if (mode === 'image-to-image' && asset?.user_email) {
        userEmail = asset.user_email
      }
      
      await env.DB.prepare(`
        INSERT INTO assets (id, user_email, kind, r2_key, mime, width, height, bytes) 
        VALUES (?1, ?2, 'output', ?3, 'image/png', ?4, ?5, ?6)
      `).bind(
        outputAssetId,
        userEmail,
        outputKey,
        asset?.width || null,
        asset?.height || null,
        processedImage.length
      ).run()
      
      logger.info('Output asset record created', { outputAssetId, userEmail, mode })
      return outputAssetId
    } catch (dbError) {
      logger.error('Failed to create output asset record', dbError)
      throw new Error(`Failed to create output asset record: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`)
    }

  } catch (error) {
    logger.error('Pipeline processing failed', error)
    throw error
  }
}
