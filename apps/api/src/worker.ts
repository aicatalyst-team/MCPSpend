import { Worker, Job } from 'bullmq'
import { queueConnection, ToolCallPayload } from './lib/queue'
import { prisma } from './lib/prisma'
import { cacheDelPattern } from './lib/redis'

const BATCH_SIZE = 100
const BATCH_INTERVAL_MS = 500

let batch: ToolCallPayload[] = []
let flushTimer: NodeJS.Timeout | null = null

async function flushBatch() {
  if (batch.length === 0) return
  const toProcess = batch.splice(0, batch.length)

  try {
    // Batch INSERT
    await prisma.toolCall.createMany({
      data: toProcess.map((p) => ({
        userId: p.userId,
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
        calledAt: new Date(p.calledAt),
      })),
      skipDuplicates: true,
    })

    // Update DailyStats (upsert per user/project/date/server/tool)
    const statsMap = new Map<string, {
      userId: string; projectId: string; date: Date
      serverName: string; toolName: string
      callCount: number; inputTokens: number; outputTokens: number
      costUsd: number; errorCount: number
    }>()

    for (const p of toProcess) {
      const date = new Date(p.calledAt)
      date.setUTCHours(0, 0, 0, 0)
      const key = `${p.userId}::${p.projectId}::${date.toISOString()}::${p.serverName}::${p.toolName}`

      const existing = statsMap.get(key)
      if (existing) {
        existing.callCount++
        existing.inputTokens += p.inputTokens
        existing.outputTokens += p.outputTokens
        existing.costUsd += p.costUsd
        if (!p.success) existing.errorCount++
      } else {
        statsMap.set(key, {
          userId: p.userId,
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

    // Upsert all stats in parallel
    await Promise.all(
      Array.from(statsMap.values()).map((s) =>
        prisma.dailyStats.upsert({
          where: {
            userId_projectId_date_serverName_toolName: {
              userId: s.userId,
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

    // Update monthly usage counters (for quota enforcement)
    const userCallCounts = new Map<string, number>()
    for (const p of toProcess) {
      userCallCounts.set(p.userId, (userCallCounts.get(p.userId) || 0) + 1)
    }
    await Promise.all(
      Array.from(userCallCounts.entries()).map(([userId, count]) =>
        prisma.user.update({
          where: { id: userId },
          data: { callsThisMonth: { increment: count } },
        })
      )
    )

    // Invalidate dashboard caches for affected users
    const affectedUsers = [...new Set(toProcess.map((p) => p.userId))]
    await Promise.all(affectedUsers.map((uid) => cacheDelPattern(`stats:${uid}:*`)))

    console.log(`[Worker] Flushed ${toProcess.length} tool calls`)
  } catch (err) {
    console.error('[Worker] Batch flush failed:', err)
    // Re-add to batch for retry
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
    concurrency: 10,  // process 10 jobs in parallel per worker instance
  }
)

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message)
})

worker.on('ready', () => {
  console.log('[Worker] MCPSpend ingest worker ready')
})

// Graceful shutdown
async function shutdown() {
  console.log('[Worker] Shutting down — flushing remaining batch...')
  if (flushTimer) clearTimeout(flushTimer)
  await flushBatch()
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
