import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middleware/auth'
import { enqueueToolCalls, ToolCallPayload } from '../lib/queue'
import { prisma } from '../lib/prisma'
import { calculateCost } from '../lib/tokenCost'

const router = Router()

const singleCallSchema = z.object({
  projectId: z.string(),
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
// Returns 202 immediately — never blocks the proxy
router.post('/', async (req: AuthRequest, res) => {
  const userId = req.userId!

  // Check quota
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { callsThisMonth: true, callsLimit: true, plan: true },
  })

  if (!user) {
    res.status(401).json({ error: 'User not found' })
    return
  }

  const body = Array.isArray(req.body) ? req.body : [req.body]
  const parsed = batchSchema.safeParse(body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    return
  }

  const calls = parsed.data

  // Quota check (soft limit — warn, don't block PRO+)
  if (user.plan === 'FREE' && user.callsThisMonth + calls.length > user.callsLimit) {
    res.status(429).json({
      error: 'Monthly quota exceeded',
      used: user.callsThisMonth,
      limit: user.callsLimit,
      upgradeUrl: `${process.env.DASHBOARD_URL}/billing`,
    })
    return
  }

  const payloads: ToolCallPayload[] = calls.map((c) => ({
    userId,
    projectId: c.projectId,
    sessionId: c.sessionId,
    serverName: c.serverName,
    toolName: c.toolName,
    model: c.model,
    inputTokens: c.inputTokens,
    outputTokens: c.outputTokens,
    // Calculate cost server-side — never trust client
    costUsd: calculateCost(c.model, c.inputTokens, c.outputTokens),
    latencyMs: c.latencyMs,
    success: c.success,
    errorCode: c.errorCode,
    calledAt: c.calledAt || new Date().toISOString(),
  }))

  await enqueueToolCalls(payloads)

  // Return 202 — don't wait for DB write
  res.status(202).json({ queued: payloads.length })
})

export { router as ingestRouter }
