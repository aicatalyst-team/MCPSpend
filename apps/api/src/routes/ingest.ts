import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middleware/auth'
import { enqueueToolCalls, ToolCallPayload } from '../lib/queue'
import { prisma } from '../lib/prisma'
import { calculateCost } from '../lib/tokenCost'

const router = Router()

const singleCallSchema = z.object({
  projectId: z.string().optional(), // optional — if API key is project-scoped, projectId is inferred
  sessionId: z.string().optional(),
  serverName: z.string().max(100),
  toolName: z.string().max(100),
  model: z.string().max(100).default('claude-sonnet-4-6'),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative().optional(),
  success: z.boolean().default(true),
  errorCode: z.string().optional(),
  calledAt: z.string().datetime().optional(),
})

const batchSchema = z.array(singleCallSchema).max(500)

// POST /api/ingest — single or batch (array)
// Requires API-key auth: req.organizationId is set by the auth middleware.
router.post('/', async (req: AuthRequest, res) => {
  const organizationId = req.organizationId
  if (!organizationId) {
    res.status(401).json({ error: 'API key required' })
    return
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { callsThisMonth: true, callsLimit: true, plan: true },
  })
  if (!org) {
    res.status(401).json({ error: 'Organization not found' })
    return
  }

  const body = Array.isArray(req.body) ? req.body : [req.body]
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    return
  }

  const calls = parsed.data
  const fallbackProjectId = req.projectId

  // Resolve projectId for each call: explicit > apiKey-scoped > error
  const resolved: ToolCallPayload[] = []
  for (const c of calls) {
    const projectId = c.projectId ?? fallbackProjectId
    if (!projectId) {
      res.status(400).json({ error: 'projectId required when API key is not project-scoped' })
      return
    }
    resolved.push({
      organizationId,
      projectId,
      sessionId: c.sessionId,
      serverName: c.serverName,
      toolName: c.toolName,
      model: c.model,
      inputTokens: c.inputTokens,
      outputTokens: c.outputTokens,
      costUsd: calculateCost(c.model, c.inputTokens, c.outputTokens),
      latencyMs: c.latencyMs,
      success: c.success,
      errorCode: c.errorCode,
      calledAt: c.calledAt || new Date().toISOString(),
    })
  }

  // Soft quota enforcement for FREE plan; otherwise just track usage
  if (org.plan === 'FREE' && org.callsThisMonth + resolved.length > org.callsLimit) {
    res.status(429).json({
      error: 'Monthly quota exceeded',
      used: org.callsThisMonth,
      limit: org.callsLimit,
      upgradeUrl: `${process.env.DASHBOARD_URL}/billing`,
    })
    return
  }

  await enqueueToolCalls(resolved)
  res.status(202).json({ queued: resolved.length })
})

export { router as ingestRouter }
