
import type { Env } from '../types'
import { Logger } from '../lib/logger'

export interface Img2ImgInput {
  r2Key: string
  prompt: string
  neg?: string
  strength?: number
  model?: string
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
    const model = input.model ?? '@cf/black-forest-labs/flux-1-schnell'
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
      
      if (!res.image) {
        throw new Error('AI model response missing image data')
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
      const output = new Uint8Array(res.image)
      
      if (output.length === 0) {
        throw new Error('AI model returned empty image')
      }
      
      logger.info('AI response processed successfully', { outputSize: output.length })
      return output
    } catch (responseError) {
      logger.error('Failed to process AI response', responseError)
      throw new Error(`Failed to process AI response: ${responseError instanceof Error ? responseError.message : 'Unknown response error'}`)
    }

  } catch (error) {
    logger.error('Image-to-image processing failed', error)
    throw error
  }
}
