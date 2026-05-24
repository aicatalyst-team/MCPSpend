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
  // Free-form end-customer identifier (e.g. "customer-acme", "team-platform").
  // Optional. Lets resellers / agencies / SaaS-on-MCP attribute calls to their
  // own end-customer. Truncated to 80 chars defensively.
  customerLabel: z.string().max(80).optional(),
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
  let fallbackProjectId = req.projectId

  // If neither the call nor the API key specifies a project, auto-resolve to
  // the org's first project (auto-creating "Default" if the org has none).
  // This makes the proxy "just work" for new users without forcing them to
  // create a project + scope a key before they can ingest.
  const needsFallback = calls.some(c => !c.projectId) && !fallbackProjectId
  if (needsFallback) {
    let project = await prisma.project.findFirst({
      where: { organizationId }, orderBy: { createdAt: 'asc' }, select: { id: true },
    })
    if (!project) {
      project = await prisma.project.create({
        data: { organizationId, name: 'Default', slug: 'default' },
        select: { id: true },
      })
    }
    fallbackProjectId = project.id
  }

  // Resolve projectId for each call: explicit > apiKey-scoped > org default
  const resolved: ToolCallPayload[] = []
  for (const c of calls) {
    const projectId = c.projectId ?? fallbackProjectId
    if (!projectId) {
      // Should be unreachable now, but kept as a defensive guard
      res.status(400).json({ error: 'projectId could not be resolved' })
      return
    }
    // Customer label resolution: per-call payload > header > unset.
    // Header form lets a reverse proxy stamp every call with a tenant id
    // without each caller bothering to include it in the JSON body.
    const headerLabel = (req.headers['x-mcpspend-customer'] as string | undefined)?.slice(0, 80)
    const customerLabel = c.customerLabel ?? headerLabel
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
      customerLabel,
      calledAt: c.calledAt || new Date().toISOString(),
    })
  }

  // Hard quota enforcement for ALL plans. Once an org is over its monthly limit,
  // we block until they upgrade or the cycle resets. Paid users hitting their cap
  // should upgrade; free users hitting 25k should either upgrade or wait.
  if (org.callsThisMonth + resolved.length > org.callsLimit) {
    res.status(429).json({
      error: org.plan === 'FREE' ? 'Free quota exceeded — upgrade to keep tracking calls' : 'Monthly quota exceeded — upgrade your plan',
      plan: org.plan,
      used: org.callsThisMonth,
      limit: org.callsLimit,
      upgradeUrl: `${process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'}/dashboard/billing`,
    })
    return
  }

  await enqueueToolCalls(resolved)
  res.status(202).json({ queued: resolved.length })
})

export { router as ingestRouter }
