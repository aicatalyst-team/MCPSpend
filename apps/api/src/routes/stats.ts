import { Router } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { cacheGet, cacheSet } from '../lib/redis'

const router = Router()

// GET /api/stats/overview?days=30&projectId=...
// Returns aggregated cost/call data from DailyStats (fast — pre-aggregated)
router.get('/overview', async (req: AuthRequest, res) => {
  const userId = req.userId!
  const days = Math.min(parseInt(req.query.days as string) || 30, 365)
  const projectId = req.query.projectId as string | undefined

  const cacheKey = `stats:${userId}:overview:${days}:${projectId || 'all'}`
  const cached = await cacheGet(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  since.setUTCHours(0, 0, 0, 0)

  const [daily, totals, topTools, topServers] = await Promise.all([
    // Daily cost trend
    prisma.dailyStats.groupBy({
      by: ['date'],
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
        serverName: null,  // top-level aggregates only
        toolName: null,
      },
      _sum: { callCount: true, costUsd: true, inputTokens: true, outputTokens: true },
      orderBy: { date: 'asc' },
    }),

    // Grand totals
    prisma.dailyStats.aggregate({
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
        serverName: null,
        toolName: null,
      },
      _sum: { callCount: true, costUsd: true, inputTokens: true, outputTokens: true, errorCount: true },
    }),

    // Top tools by cost
    prisma.dailyStats.groupBy({
      by: ['toolName', 'serverName'],
      where: {
        userId,
        ...(projectId ? { projectId } : {}),
        date: { gte: since },
        toolName: { not: null },
      },
      _sum: { callCount: true, costUsd: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 10,
    }),

    // Top servers by cost
    prisma.dailyStats.groupBy({
      by: ['serverName'],
      where: {
        userId,
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
  await cacheSet(cacheKey, result, 300) // 5 min cache
  res.json(result)
})

// GET /api/stats/sessions?limit=20&offset=0
router.get('/sessions', async (req: AuthRequest, res) => {
  const userId = req.userId!
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
  const offset = parseInt(req.query.offset as string) || 0
  const projectId = req.query.projectId as string | undefined

  const sessions = await prisma.session.findMany({
    where: { userId, ...(projectId ? { projectId } : {}) },
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

// GET /api/stats/sessions/:id — full session detail with tool calls
router.get('/sessions/:id', async (req: AuthRequest, res) => {
  const userId = req.userId!
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId },
    include: {
      toolCalls: {
        orderBy: { calledAt: 'asc' },
        take: 500, // cap at 500 calls per session view
      },
    },
  })

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  res.json(session)
})

export { router as statsRouter }
