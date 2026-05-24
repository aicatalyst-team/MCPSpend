import type { Config } from './config.js'

export interface ToolCallEvent {
  serverName: string
  toolName: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
  errorCode?: string
  calledAt: string
  projectId?: string
  sessionId?: string
  customerLabel?: string
}

const MAX_BATCH = 50
const FLUSH_INTERVAL_MS = 1000
const MAX_QUEUE = 1000 // drop events if we exceed this (protects memory if API is down)

export class Ingest {
  private queue: ToolCallEvent[] = []
  private timer: NodeJS.Timeout | null = null
  private inflight = false
  private dropped = 0

  constructor(private cfg: Config) {}

  enqueue(event: ToolCallEvent) {
    if (this.cfg.disabled || !this.cfg.apiKey) return
    if (this.queue.length >= MAX_QUEUE) {
      this.dropped++
      return
    }
    this.queue.push({
      ...event,
      projectId: event.projectId || this.cfg.projectId,
      customerLabel: event.customerLabel || this.cfg.customerLabel,
    })
    this.scheduleFlush()
  }

  private scheduleFlush() {
    if (this.timer) return
    if (this.queue.length >= MAX_BATCH) {
      void this.flush()
      return
    }
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, FLUSH_INTERVAL_MS)
  }

  async flush(): Promise<void> {
    if (this.inflight || this.queue.length === 0) return
    if (this.timer) { clearTimeout(this.timer); this.timer = null }

    const batch = this.queue.splice(0, MAX_BATCH)
    this.inflight = true

    try {
      const res = await fetch(`${this.cfg.endpoint}/api/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        // 4xx: don't requeue (bad data / unauthorized) — log and drop
        // 5xx: requeue once at the front for retry
        if (res.status >= 500 && this.queue.length + batch.length <= MAX_QUEUE) {
          this.queue.unshift(...batch)
        }
        // Avoid logging high-volume errors to stdout (would pollute MCP protocol stream)
        // Errors go to stderr; the parent process can choose to surface them.
        process.stderr.write(`[mcpspend] ingest HTTP ${res.status}\n`)
      }
    } catch (err) {
      // Network error — requeue if there's room
      if (this.queue.length + batch.length <= MAX_QUEUE) {
        this.queue.unshift(...batch)
      }
      process.stderr.write(`[mcpspend] ingest failed: ${err instanceof Error ? err.message : 'unknown'}\n`)
    } finally {
      this.inflight = false
      if (this.queue.length > 0) this.scheduleFlush()
    }
  }

  async shutdown(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    while (this.queue.length > 0 && !this.inflight) {
      // try one final flush
      await this.flush()
    }
    if (this.dropped > 0) {
      process.stderr.write(`[mcpspend] dropped ${this.dropped} events (queue overflow)\n`)
    }
  }
}
