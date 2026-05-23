// Stdio→HTTP bridge for remote MCP servers.
//
// `mcpspend wrap-http --url https://figma.com/mcp --key mcps_live_xxx` exposes
// a local stdio MCP server that proxies every JSON-RPC message to the remote
// HTTP endpoint and records each tools/call to MCPSpend — same metadata pipeline
// as the stdio wrap (server name, latency, token estimate). The MCP client (any
// of them) sees a normal stdio server; the user never has to know it's HTTP
// behind the scenes.
//
// We deliberately do not implement SSE/Streamable response streaming yet — most
// remote MCP servers in 2026 accept simple POST + JSON response. When we hit
// a server that needs streaming we'll bolt it on here without changing the
// stdio surface.

import { randomUUID } from 'node:crypto'
import type { Config } from './config.js'
import { Ingest } from './ingest.js'

interface PendingCall {
  toolName: string
  serverName: string
  startedAt: number
  inputTokens: number
}

interface RpcMessage {
  jsonrpc?: '2.0'
  id?: number | string | null
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string }
}

function estimateTokens(payload: unknown): number {
  if (payload === undefined || payload === null) return 0
  const s = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return Math.max(1, Math.ceil(s.length / 4))
}

function inferServerNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    // figma.com → figma · api.notion.com → notion · mcp.foo.dev → foo
    const host = u.hostname.replace(/^(api|mcp)\./, '')
    const parts = host.split('.')
    return parts.length >= 2 ? parts[parts.length - 2] : host
  } catch {
    return 'remote-mcp'
  }
}

export interface HttpWrapOptions {
  url: string
  config: Config
  model: string
  // Optional auth header forwarded to the remote MCP. Pass-through, never logged.
  remoteAuthHeader?: string
}

export async function runHttpBridge(opts: HttpWrapOptions): Promise<number> {
  const serverName = inferServerNameFromUrl(opts.url)
  const sessionId = randomUUID()
  const ingest = new Ingest(opts.config)
  const pending = new Map<number | string, PendingCall>()

  if (!opts.config.apiKey) {
    process.stderr.write('[mcpspend wrap-http] no API key configured — running in passthrough mode (no tracking)\n')
  }

  async function forward(msg: RpcMessage): Promise<RpcMessage | null> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts.remoteAuthHeader) headers['Authorization'] = opts.remoteAuthHeader

    const r = await fetch(opts.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(msg),
    })
    const text = await r.text()
    if (!text.trim()) return null

    // The remote may return a single JSON-RPC envelope OR a batch (array).
    // We pass through whatever we got — stdio readers handle batches fine.
    try {
      return JSON.parse(text) as RpcMessage
    } catch {
      process.stderr.write(`[mcpspend wrap-http] bad response from ${opts.url}: ${text.slice(0, 200)}\n`)
      return null
    }
  }

  function onCallStart(msg: RpcMessage) {
    if (msg.method !== 'tools/call' || msg.id == null || !msg.params) return
    const params = msg.params as { name?: string; arguments?: unknown }
    if (!params.name) return
    pending.set(msg.id, {
      toolName: params.name,
      serverName,
      startedAt: Date.now(),
      inputTokens: estimateTokens(params.arguments),
    })
  }

  function onCallEnd(msg: RpcMessage) {
    if (msg.id == null) return
    const call = pending.get(msg.id)
    if (!call) return
    pending.delete(msg.id)
    const latencyMs = Date.now() - call.startedAt
    const success = !msg.error
    const outputTokens = estimateTokens(success ? msg.result : msg.error)
    void ingest.enqueue({
      sessionId,
      serverName: call.serverName,
      toolName: call.toolName,
      model: opts.model,
      inputTokens: call.inputTokens,
      outputTokens,
      latencyMs,
      success,
      errorCode: msg.error?.code ? String(msg.error.code) : undefined,
      calledAt: new Date(call.startedAt).toISOString(),
    })
  }

  // Stdio loop: read line-delimited JSON from stdin, forward to HTTP, write
  // response back to stdout.
  let buf = ''
  process.stdin.setEncoding('utf-8')
  process.stdin.on('data', async (chunk: string) => {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      try {
        const msg = JSON.parse(line) as RpcMessage
        onCallStart(msg)
        const resp = await forward(msg)
        if (resp) {
          onCallEnd(resp)
          process.stdout.write(JSON.stringify(resp) + '\n')
        }
      } catch (err) {
        process.stderr.write(`[mcpspend wrap-http] error: ${(err as Error).message}\n`)
      }
    }
  })

  return new Promise<number>((resolve) => {
    process.stdin.on('end', async () => {
      await ingest.flush()
      resolve(0)
    })
    process.on('SIGTERM', () => { void ingest.flush().then(() => resolve(0)) })
    process.on('SIGINT', () => { void ingest.flush().then(() => resolve(0)) })
  })
}
