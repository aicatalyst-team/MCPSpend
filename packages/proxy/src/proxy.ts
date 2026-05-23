import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { Config } from './config.js'
import { Ingest } from './ingest.js'

interface PendingCall {
  toolName: string
  serverName: string
  startedAt: number
  inputTokens: number
}

// JSON-RPC 2.0 message shapes (only what we inspect)
interface RpcMessage {
  jsonrpc?: '2.0'
  id?: number | string | null
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string }
}

// Token estimation: ~4 chars per token for English/JSON content.
function estimateTokens(payload: unknown): number {
  if (payload === undefined || payload === null) return 0
  const s = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return Math.max(1, Math.ceil(s.length / 4))
}

function extractServerName(command: string, args: readonly string[]): string {
  // Best-effort: pick the most descriptive token from the command line.
  // Examples:
  //   npx @modelcontextprotocol/server-filesystem /path  →  "filesystem"
  //   node ./my-mcp-server.js                            →  "my-mcp-server"
  //   /usr/bin/uvx mcp-server-fetch                       →  "mcp-server-fetch"
  const tokens = [command, ...args]
  for (const t of tokens) {
    const m = t.match(/(?:server-|mcp-server-)([a-z0-9-]+)/i)
    if (m) return m[1]
  }
  for (const t of tokens) {
    const m = t.match(/([a-z0-9-]+)-mcp-server/i)
    if (m) return m[1]
  }
  // Fallback: last non-flag arg's basename without extension
  const lastArg = [...tokens].reverse().find((t) => !t.startsWith('-'))
  if (lastArg) {
    return lastArg.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, '')
  }
  return 'mcp'
}

export async function runProxy(opts: {
  command: string
  args: string[]
  config: Config
  model: string
}): Promise<number> {
  const { command, args, config, model } = opts
  const serverName = extractServerName(command, args)
  const sessionId = randomUUID()
  const ingest = new Ingest(config)

  if (!config.apiKey) {
    process.stderr.write('[mcpspend] no API key configured — running in passthrough mode (no tracking)\n')
  }

  const child = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env,
  })

  const pending = new Map<number | string, PendingCall>()

  function handleClientMessage(line: string) {
    if (!line.trim()) return
    try {
      const msg = JSON.parse(line) as RpcMessage
      if (msg.method === 'tools/call' && msg.id != null && msg.params && typeof msg.params === 'object') {
        const params = msg.params as { name?: string; arguments?: unknown }
        if (params.name) {
          pending.set(msg.id, {
            toolName: params.name,
            serverName,
            startedAt: Date.now(),
            inputTokens: estimateTokens(params.arguments),
          })
        }
      }
    } catch {
      // not JSON or partial — ignore, just forward
    }
  }

  function handleServerMessage(line: string) {
    if (!line.trim()) return
    try {
      const msg = JSON.parse(line) as RpcMessage
      if (msg.id != null && (msg.result !== undefined || msg.error)) {
        const call = pending.get(msg.id)
        if (call) {
          pending.delete(msg.id)
          const latencyMs = Date.now() - call.startedAt
          const success = !msg.error
          ingest.enqueue({
            serverName: call.serverName,
            toolName: call.toolName,
            model,
            inputTokens: call.inputTokens,
            outputTokens: estimateTokens(msg.result),
            latencyMs,
            success,
            errorCode: msg.error ? String(msg.error.code) : undefined,
            calledAt: new Date(call.startedAt).toISOString(),
            sessionId,
          })
        }
      }
    } catch {
      // not JSON or partial — ignore
    }
  }

  function pipeWithInspect(
    src: NodeJS.ReadableStream,
    dst: NodeJS.WritableStream,
    onLine: (line: string) => void,
  ) {
    let buf = ''
    src.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      // Pass through immediately — never block the MCP wire
      dst.write(chunk)

      buf += text
      let idx: number
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx)
        buf = buf.slice(idx + 1)
        onLine(line)
      }
    })
    src.on('end', () => {
      if (buf) onLine(buf)
    })
  }

  pipeWithInspect(process.stdin, child.stdin, handleClientMessage)
  pipeWithInspect(child.stdout, process.stdout, handleServerMessage)

  return new Promise<number>((resolve) => {
    child.on('exit', async (code, signal) => {
      // Final flush before exit
      await ingest.shutdown()
      resolve(code ?? (signal ? 128 : 0))
    })

    child.on('error', (err) => {
      process.stderr.write(`[mcpspend] failed to spawn ${command}: ${err.message}\n`)
      resolve(127)
    })

    // Propagate termination signals to the child so MCP servers shut down cleanly
    const propagate = (sig: NodeJS.Signals) => {
      if (!child.killed) child.kill(sig)
    }
    process.on('SIGINT', () => propagate('SIGINT'))
    process.on('SIGTERM', () => propagate('SIGTERM'))
  })
}
