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
    prisma.dailyStats.groupBy({
      by: ['date'],
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
        serverName: null,
        toolName: null,
      },
      _sum: { callCount: true, costUsd: true, inputTokens: true, outputTokens: true },
      orderBy: { date: 'asc' },
    }),
    prisma.dailyStats.aggregate({
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
        serverName: null,
        toolName: null,
      },
      _sum: { callCount: true, costUsd: true, inputTokens: true, outputTokens: true, errorCount: true },
    }),
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
    prisma.dailyStats.groupBy({
      by: ['serverName'],
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
        serverName: { not: null },
        toolName: null,
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
