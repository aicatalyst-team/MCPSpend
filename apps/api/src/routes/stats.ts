import { Router } from 'express'
import { AuthRequest, requireOrg } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { cacheGet, cacheSet } from '../lib/redis'

const router = Router()

router.get('/overview', requireOrg, async (req: AuthRequest, res) => {
  const organizationId = req.organizationId!
  const days = Math.min(parseInt(req.query.days as string) || 30, 365)
  const projectId = req.query.projectId as string | undefined

  const cacheKey = `stats:${organizationId}:overview:${days}:${projectId || 'all'}`
  const cached = await cacheGet(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  since.setUTCHours(0, 0, 0, 0)

  const [daily, totals, topTools, topServers] = await Promise.all([
    // Daily totals: aggregate all per-tool rows by date (no special "total" row needed). v2

    prisma.dailyStats.groupBy({
      by: ['date'],
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
      },
      _sum: { callCount: true, costUsd: true, inputTokens: true, outputTokens: true },
      orderBy: { date: 'asc' },
    }),
    // Grand totals across the whole window
    prisma.dailyStats.aggregate({
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
      },
      _sum: { callCount: true, costUsd: true, inputTokens: true, outputTokens: true, errorCount: true },
    }),
    // Top tools by cost
    prisma.dailyStats.groupBy({
      by: ['toolName', 'serverName'],
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
        toolName: { not: null },
      },
      _sum: { callCount: true, costUsd: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 10,
    }),
    // Top servers by cost: collapse per-tool rows by serverName
    prisma.dailyStats.groupBy({
      by: ['serverName'],
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
        serverName: { not: null },
      },
      _sum: { callCount: true, costUsd: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 10,
    }),
  ])

  const result = { daily, totals: totals._sum, topTools, topServers }
  await cacheSet(cacheKey, result, 300)
  res.json(result)
})

// Top end-customers by cost (per-customer attribution for agencies / SaaS-on-MCP).
// Queries ToolCall directly because DailyStats doesn't carry customerLabel —
// 30-day query against the partial index on (org, customerLabel, calledAt).
// Cached 5 min like /overview to keep dashboard snappy.
router.get('/customers', requireOrg, async (req: AuthRequest, res) => {
  const organizationId = req.organizationId!
  const days = Math.min(parseInt(req.query.days as string) || 30, 365)
  const projectId = req.query.projectId as string | undefined
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 100)

  const cacheKey = `stats:${organizationId}:customers:${days}:${projectId || 'all'}:${limit}`
  const cached = await cacheGet(cacheKey)
  if (cached) { res.json(cached); return }

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  since.setUTCHours(0, 0, 0, 0)

  const customers = await prisma.toolCall.groupBy({
    by: ['customerLabel'],
    where: {
      organizationId,
      ...(projectId ? { projectId } : {}),
      calledAt: { gte: since },
      customerLabel: { not: null },
    },
    _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    _count: { _all: true },
    orderBy: { _sum: { costUsd: 'desc' } },
    take: limit,
  })

  const result = {
    days,
    customers: customers.map((c) => ({
      customerLabel: c.customerLabel,
      callCount: c._count._all,
      costUsd: c._sum.costUsd ?? 0,
      inputTokens: c._sum.inputTokens ?? 0,
      outputTokens: c._sum.outputTokens ?? 0,
    })),
  }
  await cacheSet(cacheKey, result, 300)
  res.json(result)
})

router.get('/sessions', requireOrg, async (req: AuthRequest, res) => {
  const organizationId = req.organizationId!
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
  const offset = parseInt(req.query.offset as string) || 0
  const projectId = req.query.projectId as string | undefined

  const sessions = await prisma.session.findMany({
    where: { organizationId, ...(projectId ? { projectId } : {}) },
    orderBy: { startedAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true, agentName: true, model: true,
      startedAt: true, endedAt: true,
      totalInputTokens: true, totalOutputTokens: true,
      totalCostUsd: true, toolCallCount: true,
      project: { select: { id: true, name: true } },
    },
  })
  res.json(sessions)
})

router.get('/sessions/:id', requireOrg, async (req: AuthRequest, res) => {
  const organizationId = req.organizationId!
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, organizationId },
    include: {
      toolCalls: { orderBy: { calledAt: 'asc' }, take: 500 },
    },
  })
  if (!session) { res.status(404).json({ error: 'Session not found' }); return }
  res.json(session)
})

export { router as statsRouter }
