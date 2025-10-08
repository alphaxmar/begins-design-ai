
import { Hono } from 'hono'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Env } from '../types'

export function withAccessAuth() {
  return async (c: Hono<{ Bindings: Env }>['Context'], next: Function) => {
    const token = c.req.header('CF-Access-Jwt-Assertion')
    if (!token) return c.json({ error: 'missing CF-Access-Jwt-Assertion' }, 401)
    const jwks = createRemoteJWKSet(new URL(c.env.ACCESS_JWKS_URL))
    try {
      const { payload } = await jwtVerify(token, jwks, { audience: c.env.ACCESS_AUD })
      // Cloudflare sets email in payload per Access policy
      // @ts-ignore
      const email = payload.email || payload['cf_access_identity.email'] || 'unknown@user'
      c.set('userEmail', String(email))
      await next()
    } catch (e) {
      return c.json({ error: 'invalid access token', details: String(e) }, 401)
    }
  }
}
