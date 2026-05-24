// Background jobs that the worker runs at fixed intervals.
//
//  - retention:    deletes ToolCall rows older than the org's plan allows.
//                  FREE=7d, PRO=30d, TEAM=90d, ENTERPRISE=unlimited.
//  - budgetAlerts: scans orgs whose usage crosses 80%/100% of monthly quota and
//                  sends an email (template lives in emails/templates.ts) plus
//                  an optional Slack webhook ping. De-duped via
//                  `lastBudgetAlertAt` + `lastBudgetAlertLevel`.
//
// These are *idempotent*: running them more often than necessary is harmless.

import { prisma } from './prisma'
import { sendEmail } from './email'
import { budgetAlertEmail, spendAlertEmail } from '../emails/templates'
import { decrypt } from './crypto'

const RETENTION_DAYS: Record<string, number | null> = {
  FREE: 7,
  PRO: 30,
  TEAM: 90,
  ENTERPRISE: null, // no auto-deletion
}

const RETENTION_BATCH = 5000

export async function runRetention(): Promise<{ plan: string; deleted: number }[]> {
  const summary: { plan: string; deleted: number }[] = []
  for (const [plan, days] of Object.entries(RETENTION_DAYS)) {
    if (days === null) continue
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - days)

    // Chunk deletions so a backfill doesn't hold a long row lock.
    let totalDeleted = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const ids = await prisma.toolCall.findMany({
        where: {
          calledAt: { lt: cutoff },
          organization: { plan: plan as 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE' },
        },
        select: { id: true },
        take: RETENTION_BATCH,
      })
      if (ids.length === 0) break
      await prisma.toolCall.deleteMany({ where: { id: { in: ids.map(r => r.id) } } })
      totalDeleted += ids.length
      if (ids.length < RETENTION_BATCH) break
    }
    summary.push({ plan, deleted: totalDeleted })
  }
  return summary
}

// Thresholds at which we emit alerts. Order matters — we send the highest
// crossed threshold, not every one below it.
const ALERT_THRESHOLDS = [100, 80] as const
type AlertLevel = (typeof ALERT_THRESHOLDS)[number]

// How long to wait before re-alerting at the SAME level for the same org.
const ALERT_THROTTLE_MS = 24 * 60 * 60 * 1000

async function sendSlack(url: string, payload: { text: string }): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return r.ok
  } catch {
    return false
  }
}

// Same 80/100 thresholds for $-budgets, plus a 50% early warning since people
// notice money sooner than they notice call counts.
const SPEND_THRESHOLDS = [100, 80, 50] as const
type SpendLevel = (typeof SPEND_THRESHOLDS)[number]

export async function runSpendAlerts(): Promise<{ orgId: string; level: SpendLevel; channels: string[] }[]> {
  const sent: { orgId: string; level: SpendLevel; channels: string[] }[] = []
  const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'

  // Only orgs that explicitly set a dollar budget. Free tier users can use
  // this too — it's a safety net.
  const orgs = await prisma.organization.findMany({
    where: { monthlyBudgetUsd: { not: null, gt: 0 } },
    select: {
      id: true, name: true, monthlyBudgetUsd: true,
      slackWebhookUrl: true,
      lastSpendAlertAt: true, lastSpendAlertLevel: true,
      members: {
        where: { role: { in: ['OWNER', 'ADMIN'] } },
        select: { user: { select: { email: true } } },
      },
    },
  })

  const now = new Date()
  const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)

  for (const org of orgs) {
    if (!org.monthlyBudgetUsd || org.monthlyBudgetUsd <= 0) continue

    // Month-to-date spend. Same query the dashboard does, scoped to this org.
    const agg = await prisma.dailyStats.aggregate({
      where: { organizationId: org.id, date: { gte: monthStart } },
      _sum: { costUsd: true },
    })
    const spend = agg._sum.costUsd ?? 0
    const percent = (spend / org.monthlyBudgetUsd) * 100
    const level = SPEND_THRESHOLDS.find(t => percent >= t)
    if (!level) continue

    if (
      org.lastSpendAlertAt &&
      org.lastSpendAlertLevel !== null &&
      org.lastSpendAlertLevel !== undefined &&
      org.lastSpendAlertLevel >= level &&
      (now.getTime() - org.lastSpendAlertAt.getTime()) < ALERT_THROTTLE_MS
    ) {
      continue
    }

    const channels: string[] = []
    const recipients = org.members.map(m => m.user.email).filter(Boolean)
    if (recipients.length > 0) {
      const { subject, html } = spendAlertEmail({
        organizationName: org.name,
        percentUsed: Math.round(percent),
        spendUsd: spend,
        budgetUsd: org.monthlyBudgetUsd,
        dashboardUrl: `${dashboardUrl}/dashboard/billing`,
      })
      const r = await sendEmail({ to: recipients, subject, html })
      if (!r.error) channels.push('email')
    }

    const slackUrl = decrypt(org.slackWebhookUrl)
    if (slackUrl) {
      const emoji = level >= 100 ? '🚨' : level >= 80 ? '⚠️' : 'ℹ️'
      const ok = await sendSlack(slackUrl, {
        text:
          `${emoji} *MCPSpend* — ${org.name} hit *${Math.round(percent)}%* of its $${org.monthlyBudgetUsd.toFixed(2)} cost budget ` +
          `($${spend.toFixed(2)} spent this month). ` +
          `<${dashboardUrl}/dashboard/billing|Manage budget>`,
      })
      if (ok) channels.push('slack')
    }

    await prisma.organization.update({
      where: { id: org.id },
      data: { lastSpendAlertAt: now, lastSpendAlertLevel: level },
    })

    sent.push({ orgId: org.id, level, channels })
  }
  return sent
}

export async function runBudgetAlerts(): Promise<{ orgId: string; level: AlertLevel; channels: string[] }[]> {
  const sent: { orgId: string; level: AlertLevel; channels: string[] }[] = []
  const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'

  // We only alert ORGs with limits (Enterprise has effectively unlimited).
  const orgs = await prisma.organization.findMany({
    where: {
      callsLimit: { gt: 0 },
      plan: { not: 'ENTERPRISE' },
    },
    select: {
      id: true, name: true, plan: true,
      callsThisMonth: true, callsLimit: true,
      slackWebhookUrl: true,
      lastBudgetAlertAt: true,
      lastBudgetAlertLevel: true,
      members: {
        where: { role: { in: ['OWNER', 'ADMIN'] } },
        select: { user: { select: { email: true } } },
      },
    },
  })

  const now = new Date()
  for (const org of orgs) {
    const percent = (org.callsThisMonth / org.callsLimit) * 100
    const level = ALERT_THRESHOLDS.find(t => percent >= t)
    if (!level) continue

    // De-dup: if we already alerted at this OR higher level within the
    // throttle window, skip.
    if (
      org.lastBudgetAlertAt &&
      org.lastBudgetAlertLevel !== null &&
      org.lastBudgetAlertLevel !== undefined &&
      org.lastBudgetAlertLevel >= level &&
      (now.getTime() - org.lastBudgetAlertAt.getTime()) < ALERT_THROTTLE_MS
    ) {
      continue
    }

    const channels: string[] = []

    // Email — to OWNER/ADMIN members
    const recipients = org.members.map(m => m.user.email).filter(Boolean)
    if (recipients.length > 0) {
      const { subject, html } = budgetAlertEmail({
        organizationName: org.name,
        percentUsed: Math.round(percent),
        callsUsed: org.callsThisMonth,
        callsLimit: org.callsLimit,
        dashboardUrl: `${dashboardUrl}/dashboard/billing`,
      })
      const result = await sendEmail({ to: recipients, subject, html })
      if (!result.error) channels.push('email')
    }

    // Slack — if configured (decrypt the at-rest ciphertext before POST)
    const slackUrl = decrypt(org.slackWebhookUrl)
    if (slackUrl) {
      const ok = await sendSlack(slackUrl, {
        text:
          `*MCPSpend* — ${org.name} has used *${Math.round(percent)}%* of this month's quota ` +
          `(${org.callsThisMonth.toLocaleString()} / ${org.callsLimit.toLocaleString()} calls). ` +
          `<${dashboardUrl}/dashboard/billing|Manage plan>`,
      })
      if (ok) channels.push('slack')
    }

    await prisma.organization.update({
      where: { id: org.id },
      data: { lastBudgetAlertAt: now, lastBudgetAlertLevel: level },
    })

    sent.push({ orgId: org.id, level, channels })
  }
  return sent
}

export interface MaintenanceSchedulerOptions {
  // ms between runs. Default 1h.
  intervalMs?: number
  // Run on start too, not only after first interval. Default true.
  runOnStart?: boolean
}

// Start an interval-based scheduler. Returns a stop() function.
export function startMaintenanceScheduler(opts: MaintenanceSchedulerOptions = {}): () => void {
  const intervalMs = opts.intervalMs ?? 60 * 60 * 1000
  let running = false

  async function tick() {
    if (running) return
    running = true
    try {
      const retention = await runRetention()
      const quotaAlerts = await runBudgetAlerts()
      const spendAlerts = await runSpendAlerts()
      console.log(`[maintenance] retention=${JSON.stringify(retention)} quota_alerts=${quotaAlerts.length} spend_alerts=${spendAlerts.length}`)
    } catch (err) {
      console.error('[maintenance] tick failed:', err)
    } finally {
      running = false
    }
  }

  const handle = setInterval(tick, intervalMs)
  if (opts.runOnStart !== false) {
    // Defer first run so worker has time to fully boot.
    setTimeout(() => { void tick() }, 30_000)
  }
  return () => clearInterval(handle)
}
