
import type { Env } from '../types'
import { Logger } from '../lib/logger'

export interface Img2ImgInput {
  r2Key: string
  prompt: string
  neg?: string
  strength?: number
  model?: string
  // Advanced parameters (similar to AUTOMATIC1111)
  cfg_scale?: number
  steps?: number
  seed?: number
  sampler?: string
}

export interface Text2ImgInput {
  prompt: string
  steps?: number
  seed?: number
  model?: string
  cfg_scale?: number
  sampler?: string
}

export interface FluxInput {
  prompt: string
  steps?: number
  aspect_ratio?: string
}

function decodeImage(res: any): Uint8Array {
  // Workers AI บางรุ่นคืน res.image (Uint8Array) หรือ res.images[0] (base64)
  if (res?.image instanceof Uint8Array) return res.image
  
  // Handle base64 response (FLUX.1 [schnell])
  if (res && typeof res === 'object' && 'image' in res && typeof res.image === 'string') {
    const binaryString = atob(res.image)
    return Uint8Array.from(binaryString, (m) => m.codePointAt(0) || 0)
  }
  
  const b64 = res?.images?.[0] || res?.image
  if (typeof b64 === 'string') {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }
  
  throw new Error('AI: unknown image payload shape')
}

// ฟังก์ชันสำหรับเรียกใช้ Text-to-Image API ผ่าน FLUX Worker
export async function generateWithFlux(env: Env, input: FluxInput): Promise<Uint8Array> {
  const logger = new Logger({ model: 'FLUX-1-schnell' })
  
  try {
    logger.info('Calling FLUX Worker for text-to-image generation', {
      prompt: input.prompt.substring(0, 100),
      steps: input.steps || 4,
      aspect_ratio: input.aspect_ratio || '1:1'
    })
    
    // Call the deployed FLUX worker
    const response = await fetch('https://flux-image-generator.alphaxmar.workers.dev/api/flux', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: input.prompt,
        steps: input.steps || 4,
        aspectRatio: input.aspect_ratio || '1:1'
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      logger.error('FLUX Worker API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      throw new Error(`FLUX Worker API error: ${response.status} ${response.statusText}`)
    }
    
    // Get the image data as ArrayBuffer
    const arrayBuffer = await response.arrayBuffer()
    const result = new Uint8Array(arrayBuffer)
    
    if (result.byteLength === 0) {
      logger.error('FLUX Worker returned empty response')
      throw new Error('FLUX Worker returned empty image data')
    }
    
    logger.info('FLUX Worker generation successful', {
      imageSize: result.byteLength
    })
    return result
    
  } catch (error) {
    logger.error('FLUX Worker generation failed', {
      error: error instanceof Error ? error.message : String(error),
      prompt: input.prompt.substring(0, 100)
    })
    throw new Error(`FLUX generation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function generate(env: Env, input: {
  r2Key?: string           // ถ้ามี => พยายาม img2img
  prompt: string
  neg?: string
  strength?: number
  model?: string
  // Advanced parameters
  cfg_scale?: number
  steps?: number
  seed?: number
  sampler?: string
  // FLUX specific parameters
  aspect_ratio?: string
}): Promise<Uint8Array> {
  const logger = new Logger({ r2Key: input.r2Key, model: input.model })
  const model = input.model ?? '@cf/black-forest-labs/flux-1-schnell'

  try {
    // 1) ถ้ามี r2Key พยายาม img2img
    if (input.r2Key) {
      logger.info('Attempting image-to-image processing')
      const obj = await env.R2.get(input.r2Key)
      if (!obj) throw new Error('original not found: ' + input.r2Key)
      const bytes = new Uint8Array(await obj.arrayBuffer())

      try {
        // Build AI parameters with advanced controls
        const aiParams: any = {
          prompt: input.prompt,
          image: [...bytes],
          strength: input.strength ?? 0.6,
          negative_prompt: input.neg ?? ''
        }

        // Add advanced parameters if provided
        if (input.cfg_scale !== undefined) aiParams.guidance_scale = input.cfg_scale
        if (input.steps !== undefined) aiParams.num_inference_steps = input.steps
        if (input.seed !== undefined) aiParams.seed = input.seed
        if (input.sampler !== undefined) aiParams.scheduler = input.sampler

        const res: any = await env.AI.run(model as any, aiParams)
        logger.info('Image-to-image processing successful')
        return decodeImage(res)
      } catch (e) {
        // 2) ถ้าล้ม (รุ่นไม่รองรับ img2img) → fallback เป็น FLUX text-to-image
        logger.warn('Image-to-image failed, falling back to FLUX text-to-image', e)
        
        return await generateWithFlux(env, {
           prompt: input.prompt,
           steps: input.steps || 4,
           aspect_ratio: input.aspect_ratio || '1:1'
         })
      }
    }

    // 3) text-to-image ปกติ ใช้ FLUX API
    logger.info('Using FLUX text-to-image processing')
    
    return await generateWithFlux(env, {
       prompt: input.prompt,
       steps: input.steps || 4,
       aspect_ratio: input.aspect_ratio || '1:1'
     })
  } catch (error) {
    logger.error('AI processing failed', error)
    throw error
  }
}

export async function text2img(env: Env, input: Text2ImgInput): Promise<Uint8Array> {
  return generate(env, {
    prompt: input.prompt,
    model: input.model
  })
}

export async function img2img(env: Env, input: Img2ImgInput): Promise<Uint8Array> {
  const logger = new Logger({ r2Key: input.r2Key, model: input.model })
  
  try {
    logger.info('Starting image-to-image processing')

    // Retrieve image from R2
    let obj
    try {
      obj = await env.R2.get(input.r2Key)
      if (!obj) {
        throw new Error(`Image not found in storage: ${input.r2Key}`)
      }
      logger.info('Image retrieved from R2 successfully', { size: obj.size })
    } catch (r2Error) {
      logger.error('Failed to retrieve image from R2', r2Error)
      throw new Error(`Failed to retrieve image from storage: ${r2Error instanceof Error ? r2Error.message : 'Unknown storage error'}`)
    }

    // Convert to bytes
    let bytes: Uint8Array
    try {
      const arrayBuffer = await obj.arrayBuffer()
      bytes = new Uint8Array(arrayBuffer)
      
      // Validate image data
      if (bytes.length === 0) {
        throw new Error('Image file is empty')
      }
      
      // Basic image format validation (check for common image headers)
      const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
      const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
      const isWebP = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
      
      if (!isPNG && !isJPEG && !isWebP) {
        logger.warn('Potentially unsupported image format detected', { 
          firstBytes: Array.from(bytes.slice(0, 12)).map(b => b.toString(16)).join(' ') 
        })
      }
      
      logger.info('Image converted to bytes successfully', { byteLength: bytes.length })
    } catch (conversionError) {
      logger.error('Failed to convert image to bytes', conversionError)
      throw new Error(`Failed to process image data: ${conversionError instanceof Error ? conversionError.message : 'Unknown conversion error'}`)
    }

    // Prepare AI model parameters
    const model = input.model ?? '@cf/runwayml/stable-diffusion-v1-5-img2img'
    const aiParams = {
      prompt: input.prompt,
      image: [...bytes], // Convert Uint8Array to regular array for AI API
      strength: input.strength ?? 0.6,
      negative_prompt: input.neg ?? ''
    }

    logger.info('Calling AI model', { 
      model, 
      promptLength: input.prompt.length, 
      imageSize: bytes.length,
      strength: aiParams.strength 
    })

    // Call Workers AI
    let res: any
    try {
      res = await env.AI.run(model as any, aiParams)
      
      if (!res) {
        throw new Error('AI model returned empty response')
      }
      
      logger.info('AI model processing completed successfully')
    } catch (aiError) {
      logger.error('AI model processing failed', aiError)
      
      // Handle specific AI errors
      if (aiError instanceof Error) {
        const errorMessage = aiError.message.toLowerCase()
        
        if (errorMessage.includes('5012') || errorMessage.includes('bytes_type')) {
          throw new Error('5012: Image format not supported by AI model. Please use PNG or JPEG format.')
        }
        if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
          throw new Error('AI processing quota exceeded. Please try again later.')
        }
        if (errorMessage.includes('timeout')) {
          throw new Error('AI processing timed out. Please try again with a smaller image.')
        }
        if (errorMessage.includes('model') && errorMessage.includes('not found')) {
          throw new Error(`AI model not available: ${model}`)
        }
      }
      
      throw new Error(`AI processing failed: ${aiError instanceof Error ? aiError.message : 'Unknown AI error'}`)
    }

    // Process AI response
    try {
      logger.info('AI response type:', typeof res)
      logger.info('AI response constructor:', res.constructor.name)
      
      // Handle ReadableStream response (stable-diffusion models)
      if (res instanceof ReadableStream) {
        logger.info('Processing ReadableStream response')
        const reader = res.getReader()
        const chunks: Uint8Array[] = []
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
        }
        
        // Combine all chunks into a single Uint8Array
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const output = new Uint8Array(totalLength)
        let offset = 0
        
        for (const chunk of chunks) {
          output.set(chunk, offset)
          offset += chunk.length
        }
        
        if (output.length === 0) {
          throw new Error('AI model returned empty image')
        }
        
        logger.info('Successfully processed ReadableStream, image size:', output.length)
        return output
      }
      
      // Handle object response with image property (flux models)
      if (res && typeof res === 'object' && 'image' in res) {
        logger.info('Processing object response with image property')
        const output = new Uint8Array(res.image)
        
        if (output.length === 0) {
          throw new Error('AI model returned empty image')
        }
        
        logger.info('Successfully processed object response, image size:', output.length)
        return output
      }
      
      // Unknown response format
       logger.error('Unknown AI response format. Type:', typeof res, 'Constructor:', res?.constructor?.name)
       throw new Error('AI model response format not supported')
    } catch (responseError) {
      logger.error('Failed to process AI response', responseError)
      throw new Error(`Failed to process AI response: ${responseError instanceof Error ? responseError.message : 'Unknown response error'}`)
    }

  } catch (error) {
    logger.error('Image-to-image processing failed', error)
    throw error
  }
}
