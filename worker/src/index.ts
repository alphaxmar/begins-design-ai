
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
import { withAccessAuth } from './lib/access'

const app = new Hono<{ Bindings: Env; Variables: { userEmail?: string } }>()

app.use('*', cors())
app.use('*', prettyJSON())

// Cloudflare Access auth
app.use('/api/*', withAccessAuth())

// Health
app.get('/api/health', (c) => c.json({ ok: true }))

// Routes
app.route('/api/uploads', uploads)
app.route('/api/jobs', jobs)
app.route('/api/staging', staging)
app.route('/api/billing', billing)
app.route('/api/admin', admin)

export default app
