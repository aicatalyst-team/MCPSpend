// Public, unauthenticated status data for mcpspend.com/status.
//
// Aggregates the raw StatusCheck rows into:
//   - current state per probe (last result)
//   - 24h uptime %
//   - 30-day bar chart (1 cell per day, 'operational' / 'degraded' / 'down' /
//     'no-data')
//
// Cached 60s on the API side because the dashboard polls and we don't want
// to hammer the DB on every refresh.

import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { probeDefinitions } from '../lib/status-probes'
import { getAllModelPricing } from '../lib/tokenCost'

const router = Router()

// Public price table — auditable cost math. Lets customers verify our
// estimates against their provider invoices without an API key.
router.get('/pricing-models', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.json({
    formula: 'cost = (inputTokens / 1000000) * inputPer1M + (outputTokens / 1000000) * outputPer1M',
    currency: 'USD',
    lastUpdated: '2026-05-24',
    fallbackForUnknownModel: { inputPer1M: 3.00, outputPer1M: 15.00, note: 'Claude Sonnet baseline' },
    models: getAllModelPricing(),
  })
})

// In-memory cache so we don't hit Postgres on every page view.
let cached: { ts: number; payload: unknown } | null = null
const CACHE_MS = 60_000

router.get('/', async (_req, res) => {
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.json(cached.payload)
    return
  }

  const probes = probeDefinitions()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000)

  // Pull the last 30 days of checks across every probe in one query.
  const allRows = await prisma.statusCheck.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { probe: true, status: true, latencyMs: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  // Group by probe id
  const byProbe: Record<string, typeof allRows> = {}
  for (const row of allRows) {
    if (!byProbe[row.probe]) byProbe[row.probe] = []
    byProbe[row.probe].push(row)
  }

  const result = probes.map((def) => {
    const rows = byProbe[def.id] || []
    const last = rows[rows.length - 1]

    // 24h uptime %
    const recent = rows.filter((r) => r.createdAt >= oneDayAgo)
    const upCount = recent.filter((r) => r.status === 'operational').length
    const uptime24h = recent.length > 0 ? upCount / recent.length : null

    // 30-day daily bar — one bar per day, worst status of that day wins.
    const days: Array<{ date: string; status: 'operational' | 'degraded' | 'down' | 'no-data' }> = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000)
      const dayStart = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000)
      const dayRows = rows.filter((r) => r.createdAt >= dayStart && r.createdAt < dayEnd)
      if (dayRows.length === 0) {
        days.push({ date: dayStart.toISOString().slice(0, 10), status: 'no-data' })
        continue
      }
      // Worst-status-of-day wins for the bar color
      const hasDown = dayRows.some((r) => r.status === 'down')
      const hasDegraded = dayRows.some((r) => r.status === 'degraded')
      days.push({
        date: dayStart.toISOString().slice(0, 10),
        status: hasDown ? 'down' : hasDegraded ? 'degraded' : 'operational',
      })
    }

    return {
      id: def.id,
      name: def.name,
      currentStatus: (last?.status ?? 'no-data') as 'operational' | 'degraded' | 'down' | 'no-data',
      lastLatencyMs: last?.latencyMs ?? null,
      lastCheckedAt: last?.createdAt?.toISOString() ?? null,
      uptime24h, // 0..1 or null
      sampleSize24h: recent.length,
      days, // 30 entries oldest → newest
    }
  })

  const payload = {
    probes: result,
    overall: deriveOverall(result),
    generatedAt: now.toISOString(),
  }
  cached = { ts: Date.now(), payload }
  res.setHeader('Cache-Control', 'public, max-age=60')
  res.json(payload)
})

type ProbeAggregate = { currentStatus: 'operational' | 'degraded' | 'down' | 'no-data' }

function deriveOverall(probes: ProbeAggregate[]): 'operational' | 'degraded' | 'down' | 'no-data' {
  const live = probes.filter((p) => p.currentStatus !== 'no-data')
  if (live.length === 0) return 'no-data'
  if (live.some((p) => p.currentStatus === 'down')) return 'down'
  if (live.some((p) => p.currentStatus === 'degraded')) return 'degraded'
  return 'operational'
}

export { router as publicStatusRouter }
