// Terminal dashboard for MCPSpend — `npx @mcpspend/proxy stats`.
//
// Lightweight TUI built with raw ANSI codes (no `blessed` / `ink` dependency
// to keep the proxy small). Refreshes every 5 seconds, ESC or Ctrl-C exits.
//
// Layout (terminal-friendly, 80 cols wide):
//
//   ┌─ MCPSpend ─ acme-corp ─ PRO ───────────────── 14:32:08 ─┐
//   │  Today          Calls    Cost      Errors    Latency p95 │
//   │  ───────────────────────────────────────────────────────  │
//   │  Live           312      $0.42     0         84ms         │
//   │  Yesterday      287      $0.39     2         91ms         │
//   │                                                            │
//   │  Top tools (7d)                                            │
//   │  playwright/browser_navigate  ████████████████  $4.81      │
//   │  filesystem/read_file         █████             $1.71      │
//   │  github/search_repos          ████              $1.40      │
//   │                                                            │
//   │  Live stream                                               │
//   │  14:32:07  ✓ playwright/browser_navigate  $0.0042  240ms   │
//   │  14:32:05  ✓ filesystem/read_file         $0.0014   42ms   │
//   │  14:32:03  ✓ github/search_repos          $0.0023  180ms   │
//   └──────────────────────────────────────── q to quit ──────────┘

import { loadConfig } from './config.js'

interface OverviewResp {
  daily: { date: string; _sum: { costUsd: number | null; callCount: number | null } }[]
  totals: {
    costUsd: number | null
    callCount: number | null
    inputTokens: number | null
    outputTokens: number | null
    errorCount: number | null
  }
  topTools: { toolName: string; serverName: string | null; _sum: { costUsd: number | null; callCount: number | null } }[]
  topServers: { serverName: string; _sum: { costUsd: number | null; callCount: number | null } }[]
}

interface OrgResp {
  name: string
  plan: string
  callsThisMonth: number
  callsLimit: number
}

// ANSI helpers
const ESC = '\x1b['
const C = {
  reset: ESC + '0m',
  bold: ESC + '1m',
  dim: ESC + '2m',
  cyan: ESC + '36m',
  green: ESC + '32m',
  amber: ESC + '33m',
  red: ESC + '31m',
  brand: ESC + '38;5;39m',  // Tailwind brand-500 approx
  gray: ESC + '38;5;245m',
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null || n === 0) return '$0.0000'
  return '$' + n.toFixed(4)
}

function bar(value: number, max: number, width: number): string {
  if (max <= 0) return ''
  const filled = Math.round((value / max) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function clearScreen() {
  process.stdout.write(ESC + '2J' + ESC + 'H')
}

function hideCursor() { process.stdout.write(ESC + '?25l') }
function showCursor() { process.stdout.write(ESC + '?25h') }

async function fetchOverview(endpoint: string, apiKey: string): Promise<OverviewResp> {
  const r = await fetch(`${endpoint}/api/stats/overview?days=7`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!r.ok) throw new Error(`overview HTTP ${r.status}`)
  return (await r.json()) as OverviewResp
}

async function fetchOrg(endpoint: string, apiKey: string): Promise<OrgResp> {
  const r = await fetch(`${endpoint}/api/organizations/current`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!r.ok) throw new Error(`org HTTP ${r.status}`)
  return (await r.json()) as OrgResp
}

function render(org: OrgResp | null, overview: OverviewResp | null, errMsg: string | null, liveLines: string[]) {
  clearScreen()
  const now = new Date().toLocaleTimeString('en-US', { hour12: false })

  if (errMsg) {
    console.log(`${C.red}MCPSpend: ${errMsg}${C.reset}`)
    console.log(`${C.dim}Press Ctrl-C to quit. Will retry in 5s.${C.reset}`)
    return
  }

  if (!org || !overview) {
    console.log(`${C.dim}Loading…${C.reset}`)
    return
  }

  const today = overview.daily[overview.daily.length - 1]?._sum ?? { costUsd: 0, callCount: 0 }
  const yesterday = overview.daily[overview.daily.length - 2]?._sum ?? { costUsd: 0, callCount: 0 }
  const pctQuota = ((org.callsThisMonth / org.callsLimit) * 100).toFixed(1)
  const quotaColor = org.callsThisMonth >= org.callsLimit * 0.8 ? C.amber : C.dim

  console.log(`${C.brand}${C.bold}MCPSpend${C.reset} ${C.dim}·${C.reset} ${org.name} ${C.dim}·${C.reset} ${C.cyan}${org.plan}${C.reset} ${C.dim}·${C.reset} ${quotaColor}${org.callsThisMonth.toLocaleString()}/${org.callsLimit.toLocaleString()} (${pctQuota}%)${C.reset} ${C.dim}·${C.reset} ${now}`)
  console.log(C.dim + '─'.repeat(78) + C.reset)
  console.log('')

  // Today vs yesterday row
  console.log(`${C.bold}Today${C.reset}      ${C.cyan}${(today.callCount ?? 0).toString().padStart(8)}${C.reset} calls   ${C.green}${fmtUsd(today.costUsd).padStart(10)}${C.reset}`)
  console.log(`${C.dim}Yesterday  ${(yesterday.callCount ?? 0).toString().padStart(8)} calls   ${fmtUsd(yesterday.costUsd).padStart(10)}${C.reset}`)
  console.log('')

  // Top tools (7d) with bars
  const top = overview.topTools.slice(0, 8)
  const maxCost = Math.max(...top.map((t) => t._sum.costUsd ?? 0), 0.0001)
  console.log(`${C.bold}Top tools (7d)${C.reset}`)
  for (const t of top) {
    const label = `${t.serverName ?? '?'}/${t.toolName}`.slice(0, 36).padEnd(36)
    const c = t._sum.costUsd ?? 0
    const b = bar(c, maxCost, 18)
    console.log(`  ${label} ${C.brand}${b}${C.reset} ${fmtUsd(c).padStart(10)}`)
  }
  console.log('')

  // Live stream (newest first)
  console.log(`${C.bold}Live stream${C.reset}  ${C.dim}(SSE, refreshes as calls land)${C.reset}`)
  for (const line of liveLines.slice(0, 8)) {
    console.log('  ' + line)
  }
  if (liveLines.length === 0) {
    console.log(`  ${C.dim}waiting for a tool call…${C.reset}`)
  }
  console.log('')
  console.log(C.dim + '─'.repeat(78) + ` press q to quit ` + '─'.repeat(2) + C.reset)
}

export async function runStatsTui(): Promise<void> {
  const cfg = loadConfig()
  if (!cfg.apiKey) {
    console.error('mcpspend: no API key configured. Run `mcpspend config set apiKey mcps_live_…` or export MCPSPEND_API_KEY.')
    process.exit(1)
  }

  hideCursor()
  let org: OrgResp | null = null
  let overview: OverviewResp | null = null
  let errMsg: string | null = null
  const liveLines: string[] = []

  async function refresh() {
    try {
      const [o, ov] = await Promise.all([
        fetchOrg(cfg.endpoint, cfg.apiKey!),
        fetchOverview(cfg.endpoint, cfg.apiKey!),
      ])
      org = o
      overview = ov
      errMsg = null
    } catch (err) {
      errMsg = err instanceof Error ? err.message : 'unknown error'
    }
    render(org, overview, errMsg, liveLines)
  }

  // SSE connection for live calls
  let sseAbort: AbortController | null = null
  async function connectSse() {
    sseAbort = new AbortController()
    try {
      // Native fetch supports streaming bodies — read line-by-line.
      const resp = await fetch(`${cfg.endpoint}/api/stats/live?token=${encodeURIComponent(cfg.apiKey!)}`, {
        signal: sseAbort.signal,
        headers: { Accept: 'text/event-stream' },
      })
      if (!resp.body) return
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const raw of events) {
          if (!raw.startsWith('data:')) continue
          try {
            const payload = JSON.parse(raw.replace(/^data:\s*/, '')) as {
              serverName: string; toolName: string; costUsd: number; latencyMs: number | null; success: boolean; calledAt: string
            }
            const time = new Date(payload.calledAt).toLocaleTimeString('en-US', { hour12: false })
            const ok = payload.success ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`
            const label = `${payload.serverName}/${payload.toolName}`.slice(0, 38).padEnd(38)
            liveLines.unshift(`${C.dim}${time}${C.reset}  ${ok}  ${label} ${fmtUsd(payload.costUsd).padStart(10)}  ${(payload.latencyMs ?? 0).toString().padStart(4)}ms`)
            while (liveLines.length > 20) liveLines.pop()
            render(org, overview, errMsg, liveLines)
          } catch {
            // skip malformed
          }
        }
      }
    } catch {
      // SSE often closes on idle proxies — reconnect in 5s
      setTimeout(connectSse, 5000)
    }
  }

  // Keyboard exit
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', (key) => {
      const ch = key.toString()
      if (ch === 'q' || ch === 'Q' || ch === '\x03' /* Ctrl-C */ || ch === '\x1b' /* ESC */) {
        showCursor()
        clearScreen()
        process.exit(0)
      }
    })
  }
  // Always show cursor on exit
  process.on('exit', () => { showCursor() })
  process.on('SIGINT', () => { showCursor(); clearScreen(); process.exit(0) })

  await refresh()
  void connectSse()
  const tick = setInterval(refresh, 5000)
  process.on('exit', () => clearInterval(tick))

  // Keep alive
  await new Promise(() => {}) // never resolves; SIGINT exits the process
}
