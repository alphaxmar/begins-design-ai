
import type { Env } from '../types'
import { img2img } from './workers-ai'
import { putR2 } from '../lib/r2'

export async function runPipeline(env: Env, job: {
  id: string, original_r2_key: string, prompt?: string, negative_prompt?: string, strength?: number, model?: string
}) {
  const out = await img2img(env, {
    r2Key: job.original_r2_key,
    prompt: job.prompt || 'magazine-grade interior, realistic, soft light, clean layout',
    neg: job.negative_prompt || 'clutter, artifacts, distorted geometry',
    strength: job.strength ?? 0.6,
    model: job.model
  })
  const outKey = `outputs/${job.id}.png`
  await putR2(env.R2, outKey, out, { httpMetadata: { contentType: 'image/png' } })
  return outKey
}
