import { Queue, Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

export interface ToolCallPayload {
  organizationId: string
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
  customerLabel?: string
  calledAt: string
}

export const ingestQueue = new Queue<ToolCallPayload>('tool-call-ingest', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
})

export async function enqueueToolCalls(payloads: ToolCallPayload[]): Promise<void> {
  const jobs = payloads.map((p) => ({ name: 'ingest', data: p }))
  await ingestQueue.addBulk(jobs)
}

export { connection as queueConnection, Worker, Job }
