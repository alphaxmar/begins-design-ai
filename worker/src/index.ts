
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { prettyJSON } from 'hono/pretty-json'
import { bearerAuth } from 'hono/bearer-auth'
import type { Env } from './types'
import uploads from './routes/uploads'
import jobs from './routes/jobs'
import staging from './routes/staging'
import billing from './routes/billing'
import admin from './routes/admin'
import assets from './routes/assets'
import { withAccessAuth } from './lib/access'
import { runPipeline } from './ai/pipeline'
import { one, run } from './lib/d1'

const app = new Hono<{ Bindings: Env; Variables: { userEmail?: string } }>()

app.use('*', cors())
app.use('*', prettyJSON())

// Cloudflare Access auth with dev bypass
app.use('/api/*', async (c, next) => {
  if (c.req.header('CF-Access-Jwt-Assertion')) {
    return (await withAccessAuth())(c, next)
  } else {
    // *** DEV ONLY: bypass เพื่อดีบัก AI/R2 (อย่าลืมเอาออกเวลา deploy) ***
    if (c.env?.ASSET_BASE) c.set('userEmail', 'dev@example.com')
    return next()
  }
})

// Health
app.get('/api/health', (c) => c.json({ ok: true }))

// Diagnostic AI endpoint
app.get('/api/diag/ai', async (c) => {
  try {
    // sanity text2img
    const res: any = await c.env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
      prompt: 'minimalist room, soft light, white walls'
    })
    return c.json({ ok: true, got: !!(res?.image || res?.images?.[0]) })
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500)
  }
})

// Routes
app.route('/api/uploads', uploads)
app.route('/api/jobs', jobs)
app.route('/api/staging', staging)
app.route('/api/billing', billing)
app.route('/api/admin', admin)
app.route('/api/assets', assets)

// Serve static files for web app
app.get('*', async (c) => {
  const url = new URL(c.req.url)
  const path = url.pathname
  
  // For root path, serve index.html
  if (path === '/') {
    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BeginsDesign AI</title>
    <script type="module" crossorigin src="/assets/index-BAZ-ZCe2.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-DRkkzFsH.css">
  </head>
  <body class="bg-slate-50">
    <div id="root"></div>
  </body>
</html>`)
  }
  
  // For static assets, we need to bundle them with the worker
  // For now, return 404 for assets - they need to be bundled separately
  if (path.startsWith('/assets/')) {
    return c.text('Asset not found - needs to be bundled with worker', 404)
  }
  
  // For other paths, return 404
  return c.text('Not Found', 404)
})

// Queue handler for job processing
async function queueHandler(batch: MessageBatch, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      const { jobId } = message.body
      
      // Get job details
      const job = await one(env.DB, 'SELECT * FROM jobs WHERE id = ?', [jobId])
      if (!job) {
        console.error(`Job ${jobId} not found`)
        continue
      }

      // Update status to processing
      await run(env.DB, 'UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['processing', jobId])

      // Run the AI pipeline
      const outputKey = await runPipeline(env, job.input_r2_key, job.prompt, job.negative_prompt, job.strength)

      // Update job with success
      await run(env.DB, 'UPDATE jobs SET status = ?, output_r2_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['succeeded', outputKey, jobId])
      
      console.log(`Job ${jobId} completed successfully`)
    } catch (error) {
      console.error('Queue processing error:', error)
      
      // Update job with failure
      if (message.body?.jobId) {
        await run(env.DB, 'UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['failed', message.body.jobId])
      }
    }
  }
}

export default {
  fetch: app.fetch
  // queue: queueHandler // Temporarily disabled
}
