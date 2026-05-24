import { Worker, Job } from 'bullmq'
import { queueConnection, ToolCallPayload } from './lib/queue'
import { prisma } from './lib/prisma'
import { cacheDelPattern, publishLiveEvent } from './lib/redis'
import { startMaintenanceScheduler } from './lib/maintenance'

const BATCH_SIZE = 100
const BATCH_INTERVAL_MS = 500

let batch: ToolCallPayload[] = []
let flushTimer: NodeJS.Timeout | null = null

async function flushBatch() {
  if (batch.length === 0) return
  const toProcess = batch.splice(0, batch.length)

  try {
    // Upsert Sessions referenced by this batch. The proxy generates a sessionId
    // at startup and reuses it for every tool call in that proxy lifetime. The
    // first batch that mentions a sessionId is the one that creates the Session
    // row; subsequent batches just bump the aggregates.
    const sessionFirstSeen = new Map<string, { organizationId: string; projectId: string; model: string; firstSeenAt: Date }>()
    const sessionAgg = new Map<string, { count: number; inTok: number; outTok: number; cost: number; lastSeenAt: Date }>()
    for (const p of toProcess) {
      if (!p.sessionId) continue
      const callDate = new Date(p.calledAt)
      if (!sessionFirstSeen.has(p.sessionId)) {
        sessionFirstSeen.set(p.sessionId, {
          organizationId: p.organizationId,
          projectId: p.projectId,
          model: p.model,
          firstSeenAt: callDate,
        })
      }
      const cur = sessionAgg.get(p.sessionId) ?? { count: 0, inTok: 0, outTok: 0, cost: 0, lastSeenAt: callDate }
      cur.count++
      cur.inTok += p.inputTokens
      cur.outTok += p.outputTokens
      cur.cost += p.costUsd
      if (callDate > cur.lastSeenAt) cur.lastSeenAt = callDate
      sessionAgg.set(p.sessionId, cur)
    }
    if (sessionAgg.size > 0) {
      await Promise.all(
        Array.from(sessionAgg.entries()).map(([id, agg]) => {
          const seed = sessionFirstSeen.get(id)!
          return prisma.session.upsert({
            where: { id },
            create: {
              id,
              organizationId: seed.organizationId,
              projectId: seed.projectId,
              model: seed.model,
              startedAt: seed.firstSeenAt,
              toolCallCount: agg.count,
              totalInputTokens: agg.inTok,
              totalOutputTokens: agg.outTok,
              totalCostUsd: agg.cost,
            },
            update: {
              toolCallCount: { increment: agg.count },
              totalInputTokens: { increment: agg.inTok },
              totalOutputTokens: { increment: agg.outTok },
              totalCostUsd: { increment: agg.cost },
            },
          })
        })
      )
    }

    await prisma.toolCall.createMany({
      data: toProcess.map((p) => ({
        organizationId: p.organizationId,
        projectId: p.projectId,
        sessionId: p.sessionId,
        serverName: p.serverName,
        toolName: p.toolName,
        model: p.model,
        inputTokens: p.inputTokens,
        outputTokens: p.outputTokens,
        costUsd: p.costUsd,
        latencyMs: p.latencyMs,
        success: p.success,
        errorCode: p.errorCode,
        customerLabel: p.customerLabel,
        calledAt: new Date(p.calledAt),
      })),
      skipDuplicates: true,
    })

    // Fan out live events to the SSE ticker. One publish per call so the user
    // sees them stream in instead of in batches of 100. Fire-and-forget; if
    // Redis hiccups the dashboard just misses a few events (data still saved).
    void Promise.all(
      toProcess.map((p) =>
        publishLiveEvent(p.organizationId, {
          type: 'tool-call',
          serverName: p.serverName,
          toolName: p.toolName,
          model: p.model,
          costUsd: p.costUsd,
          latencyMs: p.latencyMs,
          success: p.success,
          calledAt: p.calledAt,
        }),
      ),
    )

    const statsMap = new Map<string, {
      organizationId: string; projectId: string; date: Date
      serverName: string; toolName: string
      callCount: number; inputTokens: number; outputTokens: number
      costUsd: number; errorCount: number
    }>()

    for (const p of toProcess) {
      const date = new Date(p.calledAt)
      date.setUTCHours(0, 0, 0, 0)
      const key = `${p.organizationId}::${p.projectId}::${date.toISOString()}::${p.serverName}::${p.toolName}`

      const existing = statsMap.get(key)
      if (existing) {
        existing.callCount++
        existing.inputTokens += p.inputTokens
        existing.outputTokens += p.outputTokens
        existing.costUsd += p.costUsd
        if (!p.success) existing.errorCount++
      } else {
        statsMap.set(key, {
          organizationId: p.organizationId,
          projectId: p.projectId,
          date,
          serverName: p.serverName,
          toolName: p.toolName,
          callCount: 1,
          inputTokens: p.inputTokens,
          outputTokens: p.outputTokens,
          costUsd: p.costUsd,
          errorCount: p.success ? 0 : 1,
        })
      }
    }

    await Promise.all(
      Array.from(statsMap.values()).map((s) =>
        prisma.dailyStats.upsert({
          where: {
            organizationId_projectId_date_serverName_toolName: {
              organizationId: s.organizationId,
              projectId: s.projectId,
              date: s.date,
              serverName: s.serverName,
              toolName: s.toolName,
            },
          },
          create: s,
          update: {
            callCount: { increment: s.callCount },
            inputTokens: { increment: s.inputTokens },
            outputTokens: { increment: s.outputTokens },
            costUsd: { increment: s.costUsd },
            errorCount: { increment: s.errorCount },
          },
        })
      )
    )

    const orgCallCounts = new Map<string, number>()
    for (const p of toProcess) {
      orgCallCounts.set(p.organizationId, (orgCallCounts.get(p.organizationId) || 0) + 1)
    }
    await Promise.all(
      Array.from(orgCallCounts.entries()).map(([organizationId, count]) =>
        prisma.organization.update({
          where: { id: organizationId },
          data: { callsThisMonth: { increment: count } },
        })
      )
    )

    const affectedOrgs = [...new Set(toProcess.map((p) => p.organizationId))]
    await Promise.all(affectedOrgs.map((oid) => cacheDelPattern(`stats:${oid}:*`)))

    console.log(`[Worker] Flushed ${toProcess.length} tool calls`)
  } catch (err) {
    console.error('[Worker] Batch flush failed:', err)
    batch.unshift(...toProcess)
  }
}

const worker = new Worker<ToolCallPayload>(
  'tool-call-ingest',
  async (job: Job<ToolCallPayload>) => {
    batch.push(job.data)

    if (batch.length >= BATCH_SIZE) {
      if (flushTimer) clearTimeout(flushTimer)
      flushTimer = null
      await flushBatch()
    } else if (!flushTimer) {
      flushTimer = setTimeout(async () => {
        flushTimer = null
        await flushBatch()
      }, BATCH_INTERVAL_MS)
    }
  },
  {
    connection: queueConnection,
    concurrency: 10,
  }
)

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message)
})

worker.on('ready', () => {
  console.log('[Worker] MCPSpend ingest worker ready')
})

// Background maintenance: retention enforcement + budget alerts (email + Slack).
// Co-located with the worker so we only have one schedule-aware process.
const stopMaintenance = startMaintenanceScheduler()

async function shutdown() {
  console.log('[Worker] Shutting down — flushing remaining batch...')
  if (flushTimer) clearTimeout(flushTimer)
  stopMaintenance()
  await flushBatch()
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
