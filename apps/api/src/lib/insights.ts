// Auto-generated "what changed this week?" insights.
//
// Reads ToolCall data for the last 14 days and produces a small list of
// human-language insights comparing the most recent 7 days to the prior 7.
// Rule-based — no LLM, no ML. Deterministic + cheap.
//
// Categories of insight we surface:
//   1. Overall cost trend (up/down %)
//   2. New tools that appeared this week
//   3. Tools that surged in cost (>2x WoW)
//   4. Tools that disappeared
//   5. Error-rate spike
//   6. Projects with the biggest week-over-week swings
//   7. End-of-month forecast (linked to /api/stats/forecast)

import { prisma } from './prisma'
import { forecastMonth, DailyPoint } from './forecast'

export interface Insight {
  id: string                // stable hash so the UI can dedupe / track dismiss
  severity: 'positive' | 'neutral' | 'warning' | 'critical'
  category: 'cost' | 'tool' | 'error' | 'project' | 'forecast'
  headline: string          // one-line bold header
  body: string              // 1-2 sentence explanation
  metric?: { label: string; value: string }
}

const SURGE_MULTIPLIER = 2 // 2x cost = "surged"
const MIN_TOOL_USD = 0.10  // skip tiny tools to avoid noise
const ERROR_RATE_FLOOR = 0.05 // 5% — below this, error-rate insight skipped

interface ToolStats {
  serverName: string
  toolName: string
  cost: number
  count: number
  errors: number
}

export async function generateInsights(organizationId: string, projectId?: string): Promise<Insight[]> {
  const insights: Insight[] = []
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000)

  // Pull two windows in parallel
  const [currentWindow, priorWindow, dailyForForecast] = await Promise.all([
    fetchWindow(organizationId, sevenDaysAgo, now, projectId),
    fetchWindow(organizationId, fourteenDaysAgo, sevenDaysAgo, projectId),
    prisma.dailyStats.groupBy({
      by: ['date'],
      where: { organizationId, ...(projectId ? { projectId } : {}), date: { gte: fourteenDaysAgo } },
      _sum: { costUsd: true, callCount: true },
      orderBy: { date: 'asc' },
    }),
  ])

  // ── 1. Overall cost trend ─────────────────────────────────
  const currentTotal = currentWindow.totalCost
  const priorTotal = priorWindow.totalCost
  if (currentTotal > 0 || priorTotal > 0) {
    const diff = currentTotal - priorTotal
    const pct = priorTotal > 0 ? (diff / priorTotal) * 100 : (currentTotal > 0 ? 100 : 0)
    const absPct = Math.abs(pct)
    if (absPct >= 10) {
      insights.push({
        id: 'cost-trend',
        severity: diff > 0 ? 'warning' : 'positive',
        category: 'cost',
        headline: diff > 0
          ? `Weekly spend up ${absPct.toFixed(0)}% vs last week`
          : `Weekly spend down ${absPct.toFixed(0)}% vs last week`,
        body: `Last 7 days: $${currentTotal.toFixed(2)}. Prior 7 days: $${priorTotal.toFixed(2)}.`,
        metric: { label: 'WoW change', value: `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}` },
      })
    } else {
      insights.push({
        id: 'cost-trend',
        severity: 'neutral',
        category: 'cost',
        headline: `Weekly spend stable (within ${absPct.toFixed(0)}% of last week)`,
        body: `Last 7 days: $${currentTotal.toFixed(2)}. Prior 7 days: $${priorTotal.toFixed(2)}.`,
      })
    }
  }

  // ── 2. New tools this week ────────────────────────────────
  const newTools = currentWindow.tools.filter(
    (t) => t.cost >= MIN_TOOL_USD && !priorWindow.tools.some((p) => p.serverName === t.serverName && p.toolName === t.toolName),
  )
  if (newTools.length > 0) {
    const top = newTools.sort((a, b) => b.cost - a.cost).slice(0, 3)
    insights.push({
      id: 'new-tools',
      severity: 'neutral',
      category: 'tool',
      headline: `${newTools.length} new tool${newTools.length === 1 ? '' : 's'} used this week`,
      body: top.map((t) => `${t.serverName}/${t.toolName} ($${t.cost.toFixed(2)})`).join(', ') + (newTools.length > 3 ? ` and ${newTools.length - 3} more` : ''),
    })
  }

  // ── 3. Surging tools ──────────────────────────────────────
  const surges: { tool: ToolStats; prior: ToolStats; multiplier: number }[] = []
  for (const t of currentWindow.tools) {
    if (t.cost < MIN_TOOL_USD) continue
    const prior = priorWindow.tools.find((p) => p.serverName === t.serverName && p.toolName === t.toolName)
    if (!prior || prior.cost <= 0) continue
    const mult = t.cost / prior.cost
    if (mult >= SURGE_MULTIPLIER) surges.push({ tool: t, prior, multiplier: mult })
  }
  for (const s of surges.sort((a, b) => b.tool.cost - a.tool.cost).slice(0, 3)) {
    insights.push({
      id: `surge-${s.tool.serverName}-${s.tool.toolName}`,
      severity: s.multiplier >= 5 ? 'critical' : 'warning',
      category: 'tool',
      headline: `${s.tool.serverName}/${s.tool.toolName} cost up ${s.multiplier.toFixed(1)}× WoW`,
      body: `$${s.tool.cost.toFixed(2)} this week vs $${s.prior.cost.toFixed(2)} last week. ${s.tool.count} calls.`,
      metric: { label: 'WoW multiplier', value: `${s.multiplier.toFixed(1)}×` },
    })
  }

  // ── 4. Tools that disappeared ─────────────────────────────
  const dropped = priorWindow.tools.filter(
    (p) => p.cost >= MIN_TOOL_USD && !currentWindow.tools.some((t) => t.serverName === p.serverName && t.toolName === p.toolName),
  )
  if (dropped.length > 0) {
    const top = dropped.sort((a, b) => b.cost - a.cost).slice(0, 3)
    insights.push({
      id: 'dropped-tools',
      severity: 'neutral',
      category: 'tool',
      headline: `${dropped.length} tool${dropped.length === 1 ? '' : 's'} stopped being used`,
      body: top.map((t) => `${t.serverName}/${t.toolName} (was $${t.cost.toFixed(2)}/wk)`).join(', '),
    })
  }

  // ── 5. Error-rate insight ─────────────────────────────────
  const currentErrorRate = currentWindow.totalCalls > 0 ? currentWindow.totalErrors / currentWindow.totalCalls : 0
  if (currentErrorRate >= ERROR_RATE_FLOOR) {
    insights.push({
      id: 'error-rate',
      severity: currentErrorRate >= 0.15 ? 'critical' : 'warning',
      category: 'error',
      headline: `${(currentErrorRate * 100).toFixed(1)}% of tool calls failed this week`,
      body: `${currentWindow.totalErrors} errors across ${currentWindow.totalCalls} calls. Drill into top failing tools to find the cause.`,
      metric: { label: 'Error rate', value: `${(currentErrorRate * 100).toFixed(1)}%` },
    })
  }

  // ── 6. Forecast ────────────────────────────────────────────
  const daily: DailyPoint[] = dailyForForecast.map((d) => ({
    date: d.date.toISOString().slice(0, 10),
    costUsd: d._sum.costUsd ?? 0,
    callCount: d._sum.callCount ?? 0,
  }))
  if (daily.length >= 3) {
    const f = forecastMonth(daily)
    insights.push({
      id: 'forecast',
      severity: 'neutral',
      category: 'forecast',
      headline: `Projected month-end spend: $${f.projectedMonthEndUsd.toFixed(2)}`,
      body: `Based on the last week's rhythm and day-of-week pattern. So far this month: $${f.monthToDateUsd.toFixed(2)} across ${f.daysElapsed} days.`,
      metric: { label: '± uncertainty', value: `$${f.uncertaintyUsd.toFixed(2)}` },
    })
  }

  return insights
}

async function fetchWindow(
  organizationId: string,
  start: Date,
  end: Date,
  projectId?: string,
): Promise<{ tools: ToolStats[]; totalCost: number; totalCalls: number; totalErrors: number }> {
  const rows = await prisma.toolCall.groupBy({
    by: ['serverName', 'toolName'],
    where: {
      organizationId,
      ...(projectId ? { projectId } : {}),
      calledAt: { gte: start, lt: end },
    },
    _sum: { costUsd: true },
    _count: { _all: true },
  })

  const tools: ToolStats[] = rows.map((r) => ({
    serverName: r.serverName,
    toolName: r.toolName,
    cost: r._sum.costUsd ?? 0,
    count: r._count._all,
    errors: 0,
  }))

  // Counts for totals + error totals — one extra aggregate
  const totals = await prisma.toolCall.aggregate({
    where: {
      organizationId,
      ...(projectId ? { projectId } : {}),
      calledAt: { gte: start, lt: end },
    },
    _sum: { costUsd: true },
    _count: { _all: true },
  })
  const errorTotals = await prisma.toolCall.count({
    where: {
      organizationId,
      ...(projectId ? { projectId } : {}),
      calledAt: { gte: start, lt: end },
      success: false,
    },
  })

  return {
    tools,
    totalCost: totals._sum.costUsd ?? 0,
    totalCalls: totals._count._all,
    totalErrors: errorTotals,
  }
}
