
import type { Env } from '../types'

export async function img2img(env: Env, input: { r2Key: string; prompt: string; neg?: string; strength?: number; model?: string }) {
  const obj = await env.R2.get(input.r2Key)
  if (!obj) throw new Error('original not found: ' + input.r2Key)
  const bytes = new Uint8Array(await obj.arrayBuffer())
  const model = input.model ?? '@cf/black-forest-labs/flux-1-schnell'
  // Workers AI img2img signature may vary per model; this is a common pattern
  const res: any = await env.AI.run(model as any, {
    prompt: input.prompt,
    image: [...bytes],
    strength: input.strength ?? 0.6,
    negative_prompt: input.neg ?? ''
  })
  // Assuming `res.image` bytes
  const output = new Uint8Array(res.image)
  return output
}
