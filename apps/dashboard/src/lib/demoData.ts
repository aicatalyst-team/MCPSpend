// Deterministic demo data shown on the dashboard before the user has any
// real tool calls. The goal is to make the empty-state look like the future
// — so a brand-new user sees a populated chart, top tools, and an error rate
// instead of "no data yet". Combined with a clear banner that says "this is
// demo data", it lifts activation dramatically.
//
// Numbers are plausible for a single developer using Cursor + Claude Code
// with a handful of common MCP servers. Seeded so the layout is identical
// across reloads — predictable demos are calmer than random demos.

interface DemoDaily {
  date: string
  _sum: { costUsd: number; callCount: number; inputTokens: number; outputTokens: number }
}

interface DemoOverview {
  daily: DemoDaily[]
  totals: {
    costUsd: number
    callCount: number
    inputTokens: number
    outputTokens: number
    errorCount: number
  }
  topTools: { toolName: string; serverName: string; _sum: { costUsd: number; callCount: number } }[]
  topServers: { serverName: string; _sum: { costUsd: number; callCount: number } }[]
}

// A simple seeded PRNG so chart layout is stable across reloads. Mulberry32.
function seedRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildDemoOverview(days = 30): DemoOverview {
  const rand = seedRandom(20260524) // fixed seed → identical demo every render

  const daily: DemoDaily[] = []
  let totalCost = 0
  let totalCalls = 0
  let totalIn = 0
  let totalOut = 0

  // Slight upward trend + weekday spikes so the chart isn't flat.
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    d.setUTCHours(0, 0, 0, 0)
    const dayOfWeek = d.getUTCDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const trendFactor = 1 + (days - i) / days * 0.6 // gentle upward
    const weekendDip = isWeekend ? 0.4 : 1
    const noise = 0.6 + rand() * 0.8

    const callCount = Math.round(180 * trendFactor * weekendDip * noise)
    const costUsd = +(callCount * (0.0018 + rand() * 0.0009)).toFixed(4)
    const inputTokens = Math.round(callCount * (45 + rand() * 15))
    const outputTokens = Math.round(callCount * (160 + rand() * 90))

    daily.push({
      date: d.toISOString(),
      _sum: { costUsd, callCount, inputTokens, outputTokens },
    })
    totalCost += costUsd
    totalCalls += callCount
    totalIn += inputTokens
    totalOut += outputTokens
  }

  // Tools modeled after the realistic mix a Cursor + Claude Code user has.
  const topTools = [
    { serverName: 'playwright', toolName: 'browser_navigate', _sum: { costUsd: +(totalCost * 0.31).toFixed(4), callCount: Math.round(totalCalls * 0.08) } },
    { serverName: 'filesystem', toolName: 'read_file', _sum: { costUsd: +(totalCost * 0.18).toFixed(4), callCount: Math.round(totalCalls * 0.42) } },
    { serverName: 'github', toolName: 'search_code', _sum: { costUsd: +(totalCost * 0.14).toFixed(4), callCount: Math.round(totalCalls * 0.06) } },
    { serverName: 'filesystem', toolName: 'list_directory', _sum: { costUsd: +(totalCost * 0.09).toFixed(4), callCount: Math.round(totalCalls * 0.18) } },
    { serverName: 'brave-search', toolName: 'web_search', _sum: { costUsd: +(totalCost * 0.08).toFixed(4), callCount: Math.round(totalCalls * 0.03) } },
    { serverName: 'github', toolName: 'get_pull_request', _sum: { costUsd: +(totalCost * 0.06).toFixed(4), callCount: Math.round(totalCalls * 0.04) } },
    { serverName: 'fetch', toolName: 'fetch', _sum: { costUsd: +(totalCost * 0.05).toFixed(4), callCount: Math.round(totalCalls * 0.05) } },
    { serverName: 'postgres', toolName: 'query', _sum: { costUsd: +(totalCost * 0.05).toFixed(4), callCount: Math.round(totalCalls * 0.04) } },
    { serverName: 'filesystem', toolName: 'write_file', _sum: { costUsd: +(totalCost * 0.03).toFixed(4), callCount: Math.round(totalCalls * 0.07) } },
    { serverName: 'slack', toolName: 'post_message', _sum: { costUsd: +(totalCost * 0.01).toFixed(4), callCount: Math.round(totalCalls * 0.03) } },
  ]

  const topServers = [
    { serverName: 'playwright', _sum: { costUsd: +(totalCost * 0.32).toFixed(4), callCount: Math.round(totalCalls * 0.09) } },
    { serverName: 'filesystem', _sum: { costUsd: +(totalCost * 0.30).toFixed(4), callCount: Math.round(totalCalls * 0.67) } },
    { serverName: 'github', _sum: { costUsd: +(totalCost * 0.20).toFixed(4), callCount: Math.round(totalCalls * 0.10) } },
    { serverName: 'brave-search', _sum: { costUsd: +(totalCost * 0.08).toFixed(4), callCount: Math.round(totalCalls * 0.03) } },
    { serverName: 'fetch', _sum: { costUsd: +(totalCost * 0.05).toFixed(4), callCount: Math.round(totalCalls * 0.05) } },
    { serverName: 'postgres', _sum: { costUsd: +(totalCost * 0.04).toFixed(4), callCount: Math.round(totalCalls * 0.04) } },
    { serverName: 'slack', _sum: { costUsd: +(totalCost * 0.01).toFixed(4), callCount: Math.round(totalCalls * 0.02) } },
  ]

  return {
    daily,
    totals: {
      costUsd: +totalCost.toFixed(4),
      callCount: totalCalls,
      inputTokens: totalIn,
      outputTokens: totalOut,
      errorCount: Math.round(totalCalls * 0.014), // ~1.4% error rate
    },
    topTools,
    topServers,
  }
}

export type { DemoOverview }
