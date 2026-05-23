import { Router } from 'express'
import { AuthRequest, requireOrg, requireUserSession } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()

// Plans allowed to export. Promised in Pricing.tsx — Pro and up.
const EXPORT_PLANS = new Set(['PRO', 'TEAM', 'ENTERPRISE'])

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// GET /api/export/tool-calls.csv
//   ?days=30 (1..365, default 30)
//   ?projectId=... (optional, scope to a project)
//
// Streams ToolCall rows for the org as CSV. Headers:
//   calledAt, project, server, tool, model, inputTokens, outputTokens,
//   costUsd, latencyMs, success, errorCode, sessionId
//
// Free plan is rejected with 402 + upgradeUrl — Pricing.tsx promises CSV
// export starting at Pro, and we enforce it here.
router.get('/tool-calls.csv', requireOrg, requireUserSession, async (req: AuthRequest, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365)
  const projectId = (req.query.projectId as string) || undefined

  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { plan: true, slug: true },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }
  if (!EXPORT_PLANS.has(org.plan)) {
    res.status(402).json({
      error: 'CSV export requires Pro or higher',
      currentPlan: org.plan,
      upgradeUrl: `${process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'}/dashboard/billing`,
    })
    return
  }

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)

  const filename = `mcpspend-${org.slug}-${days}d.csv`
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  // Header row
  res.write([
    'calledAt', 'project', 'server', 'tool', 'model',
    'inputTokens', 'outputTokens', 'costUsd', 'latencyMs',
    'success', 'errorCode', 'sessionId',
  ].join(',') + '\n')

  // Stream in 5k chunks so we don't materialise huge result sets in memory.
  // Cursor-based pagination on (calledAt, id) — calledAt may have ties so
  // we tiebreak on id which is unique.
  const PAGE = 5000
  let cursor: { calledAt: Date; id: string } | undefined
  let total = 0

  // Limit pulls to 1M rows to guard against runaway exports
  const HARD_LIMIT = 1_000_000

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await prisma.toolCall.findMany({
      where: {
        organizationId: req.organizationId!,
        calledAt: { gte: since },
        ...(projectId ? { projectId } : {}),
        ...(cursor
          ? {
              OR: [
                { calledAt: { lt: cursor.calledAt } },
                { calledAt: cursor.calledAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ calledAt: 'desc' }, { id: 'desc' }],
      take: PAGE,
      select: {
        id: true,
        calledAt: true,
        serverName: true,
        toolName: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        costUsd: true,
        latencyMs: true,
        success: true,
        errorCode: true,
        sessionId: true,
        project: { select: { name: true } },
      },
    })

    if (rows.length === 0) break

    for (const r of rows) {
      res.write([
        escapeCsv(r.calledAt.toISOString()),
        escapeCsv(r.project?.name ?? ''),
        escapeCsv(r.serverName),
        escapeCsv(r.toolName),
        escapeCsv(r.model),
        escapeCsv(r.inputTokens),
        escapeCsv(r.outputTokens),
        escapeCsv(r.costUsd),
        escapeCsv(r.latencyMs),
        escapeCsv(r.success ? '1' : '0'),
        escapeCsv(r.errorCode),
        escapeCsv(r.sessionId),
      ].join(',') + '\n')
    }

    total += rows.length
    if (rows.length < PAGE) break
    if (total >= HARD_LIMIT) break

    const last = rows[rows.length - 1]
    cursor = { calledAt: last.calledAt, id: last.id }
  }

  res.end()
})

export { router as exportRouter }
