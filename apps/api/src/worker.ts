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
        calledAt: new Date(p.calledAt),
      })),
      skipDuplicates: true,
    })

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
