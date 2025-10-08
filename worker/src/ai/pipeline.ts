
import type { Env } from '../types'
import { img2img } from './workers-ai'
import { putR2 } from '../lib/r2'
import { Logger } from '../lib/logger'

export interface PipelineJob {
  id: string
  originalAssetId: string
  style: string
  options?: {
    prompt?: string
    negative_prompt?: string
    strength?: number
    model?: string
  }
}

export async function runPipeline(env: Env, job: PipelineJob): Promise<string> {
  const logger = new Logger({ jobId: job.id, originalAssetId: job.originalAssetId })
  
  try {
    logger.info('Pipeline processing started', { style: job.style })

    // Get asset information from database
    let asset
    try {
      asset = await env.DB.prepare("SELECT * FROM assets WHERE id = ?").bind(job.originalAssetId).first()
      if (!asset) {
        throw new Error(`Asset not found: ${job.originalAssetId}`)
      }
      if (!asset.r2_key) {
        throw new Error(`Asset missing R2 key: ${job.originalAssetId}`)
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

    // Generate style-based prompt
    const stylePrompts = {
      modern: 'modern interior design, clean lines, minimalist, contemporary furniture, bright lighting',
      vintage: 'vintage interior design, retro furniture, warm colors, classic elements, nostalgic atmosphere',
      industrial: 'industrial interior design, exposed brick, metal fixtures, raw materials, urban loft style',
      scandinavian: 'scandinavian interior design, light wood, white walls, cozy textiles, hygge atmosphere',
      luxury: 'luxury interior design, high-end furniture, elegant decor, premium materials, sophisticated lighting'
    }

    const prompt = job.options?.prompt || stylePrompts[job.style as keyof typeof stylePrompts] || stylePrompts.modern
    const negativePrompt = job.options?.negative_prompt || 'clutter, artifacts, distorted geometry, poor lighting, low quality'
    const strength = job.options?.strength ?? 0.6
    const model = job.options?.model ?? '@cf/black-forest-labs/flux-1-schnell'

    logger.info('AI processing parameters', { prompt, strength, model })

    // Run AI processing
    let processedImage: Uint8Array
    try {
      processedImage = await img2img(env, {
        r2Key: asset.r2_key,
        prompt,
        neg: negativePrompt,
        strength,
        model
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
      await env.DB.prepare(`
        INSERT INTO assets (id, user_email, kind, r2_key, mime, width, height, bytes) 
        VALUES (?1, ?2, 'output', ?3, 'image/png', ?4, ?5, ?6)
      `).bind(
        outputAssetId,
        asset.user_email,
        outputKey,
        asset.width || null,
        asset.height || null,
        processedImage.length
      ).run()
      
      logger.info('Output asset record created', { outputAssetId })
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
