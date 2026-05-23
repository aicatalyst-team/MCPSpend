// Internal-only routes called by our own infra (mainly CI/CD).
//
// /redeploy lets the deploy workflow trigger a Coolify deployment without
// needing SSH tunnels into the VPS — Coolify isn't exposed publicly, but the
// API container shares the `coolify` Docker network so it can reach the
// Coolify API directly. CI hits this endpoint with a shared secret in
// X-Deploy-Token; we proxy the call internally.
//
// This is the canonical "deploy" path going forward. SSH-tunnel fallback
// in .github/workflows/deploy.yml can stay as a safety net but should not
// be the primary trigger.

import { Router } from 'express'
import { z } from 'zod'

const router = Router()

const COOLIFY_INTERNAL = process.env.COOLIFY_INTERNAL_URL || 'http://coolify:8080'

router.post('/redeploy', async (req, res) => {
  const sharedSecret = process.env.DEPLOY_SECRET
  if (!sharedSecret) {
    res.status(503).json({ error: 'DEPLOY_SECRET not configured on this server' })
    return
  }
  const provided = (req.headers['x-deploy-token'] as string | undefined)?.trim()
  if (!provided || provided !== sharedSecret) {
    res.status(403).json({ error: 'Invalid deploy token' })
    return
  }

  const schema = z.object({
    uuid: z.string().min(1),
    force: z.boolean().default(false),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'uuid is required' })
    return
  }

  const coolifyToken = process.env.COOLIFY_TOKEN
  if (!coolifyToken) {
    res.status(503).json({ error: 'COOLIFY_TOKEN not configured' })
    return
  }

  try {
    const url = `${COOLIFY_INTERNAL}/api/v1/deploy?uuid=${encodeURIComponent(parsed.data.uuid)}&force=${parsed.data.force}`
    const r = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${coolifyToken}` },
    })
    const body = await r.text()
    if (!r.ok) {
      res.status(502).json({ error: 'Coolify rejected the deploy', status: r.status, body })
      return
    }
    res.json({ triggered: true, coolifyStatus: r.status, body: body.slice(0, 500) })
  } catch (err) {
    res.status(502).json({ error: 'Could not reach Coolify', detail: (err as Error).message })
  }
})

export { router as internalRouter }
