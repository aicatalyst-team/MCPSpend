import spawn from 'cross-spawn'
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

// Strip an npm package spec down to its identifying core. We do this in stages
// so each rule is auditable and reviewers can extend it without unwinding a
// monster regex.
//
//   @playwright/mcp@latest             → playwright
//   @modelcontextprotocol/server-fs    → fs
//   @owner/foo-mcp                     → foo
//   github-mcp-server                  → github
//   mcp-server-fetch                   → fetch
//   firecrawl-mcp                      → firecrawl
function stripMcpAffixes(s: string): string {
  let t = s
  t = t.replace(/^mcp-server-/i, '').replace(/-mcp-server$/i, '')
  t = t.replace(/^server-/i, '').replace(/-server$/i, '')
  t = t.replace(/^mcp-/i, '').replace(/-mcp$/i, '')
  return t.toLowerCase().trim()
}

function isDegenerate(t: string): boolean {
  return !t || t === 'mcp' || t === 'server' || t === 'latest'
}

function normaliseServerToken(raw: string): string | null {
  let t = raw
  // Drop everything after the version separator, but only when it's a version,
  // not a scope marker. `@playwright/mcp@latest` → `@playwright/mcp`.
  const lastAt = t.lastIndexOf('@')
  if (lastAt > 0) t = t.slice(0, lastAt)

  // If this is a scoped npm spec like `@playwright/mcp`, try the unscoped
  // name first; if that strips down to something generic ("mcp", "server"),
  // fall back to the scope itself. That gives "playwright" instead of "mcp"
  // for `@playwright/mcp@latest`, while still preferring the specific name
  // for `@modelcontextprotocol/server-filesystem` → "filesystem".
  let scope: string | null = null
  if (t.startsWith('@')) {
    const slash = t.indexOf('/')
    if (slash > 0) {
      scope = t.slice(1, slash).toLowerCase()
      t = t.slice(slash + 1)
    }
  }

  // Path basename when this is a script path.
  t = t.split(/[\\/]/).pop() || t
  t = t.replace(/\.(js|cjs|mjs|ts|tsx|py)$/i, '')

  let name = stripMcpAffixes(t)
  if (isDegenerate(name) && scope) {
    name = stripMcpAffixes(scope)
  }

  if (isDegenerate(name)) return null
  return name
}

// Exported only for tests — see proxy.test.ts. Kept off the public surface to
// avoid implying it's a stable API.
export const __testExtractServerName = (command: string, args: string[]) => extractServerName(command, args)

function extractServerName(command: string, args: readonly string[]): string {
  // Skip well-known shims that never carry the server identity themselves.
  const skipPrefix = new Set(['npx', 'npx.cmd', 'npx.exe', 'uvx', 'pnpx', 'bunx', 'pipx', 'node', 'bun', 'deno', 'python', 'python3'])

  const tokens = [command, ...args].filter((t) => {
    if (!t) return false
    if (t.startsWith('-')) return false // flags
    const base = t.split(/[\\/]/).pop()?.toLowerCase() || ''
    return !skipPrefix.has(base) && !skipPrefix.has(t.toLowerCase())
  })

  for (const t of tokens) {
    const name = normaliseServerToken(t)
    if (name) return name
  }

  // Last resort — last raw token basename.
  const lastArg = [...args].reverse().find((t) => !t.startsWith('-')) || command
  return (lastArg.split(/[\\/]/).pop() || lastArg).replace(/\.[^.]+$/, '') || 'mcp'
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

  // cross-spawn handles Windows .cmd/.bat resolution and argument quoting
  // properly, avoiding both spawn ENOENT (no shell) and backslash mangling
  // (shell: true). See https://github.com/moxystudio/node-cross-spawn.
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

  // stdio: ['pipe', 'pipe', 'inherit'] guarantees stdin/stdout exist
  pipeWithInspect(process.stdin, child.stdin!, handleClientMessage)
  pipeWithInspect(child.stdout!, process.stdout, handleServerMessage)

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
