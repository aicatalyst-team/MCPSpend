import { Queue, Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

// ─── Ingest Queue ──────────────────────────────────────────
// Receives raw tool call payloads from the API
// Worker batches them into the DB every 500ms or 100 items

export interface ToolCallPayload {
  userId: string
  projectId: string
  sessionId?: string
  serverName: string
  toolName: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs?: number
  success: boolean
  errorCode?: string
  calledAt: string
}

export const ingestQueue = new Queue<ToolCallPayload>('tool-call-ingest', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 1000,   // keep last 1K completed jobs for debugging
    removeOnFail: 5000,       // keep 5K failed for inspection
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
})

// Batch ingestion: up to 500 items at once for efficiency
export async function enqueueToolCalls(payloads: ToolCallPayload[]): Promise<void> {
  const jobs = payloads.map((p) => ({ name: 'ingest', data: p }))
  await ingestQueue.addBulk(jobs)
}

export { connection as queueConnection, Worker, Job }
