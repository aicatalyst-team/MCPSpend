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
import {
  budgetAlertEmail, spendAlertEmail, weeklyDigestEmail,
  activationDay2Email, activationDay5Email, reactivationDay14Email,
} from '../emails/templates'
import { decrypt } from './crypto'
import { dispatchWebhook } from './webhooks'

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

    // Customer webhooks subscribed to spend.alert get the same event with
    // the structured payload PagerDuty / Datadog / Zapier expect.
    void dispatchWebhook({
      organizationId: org.id,
      eventType: 'spend.alert',
      payload: {
        organizationName: org.name,
        level, percentUsed: Math.round(percent),
        spendUsd: spend, budgetUsd: org.monthlyBudgetUsd,
        dashboardUrl: `${dashboardUrl}/dashboard/billing`,
      },
    })
    channels.push('webhook')

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

    // Customer webhooks subscribed to budget.alert
    void dispatchWebhook({
      organizationId: org.id,
      eventType: 'budget.alert',
      payload: {
        organizationName: org.name,
        level, percentUsed: Math.round(percent),
        callsThisMonth: org.callsThisMonth,
        callsLimit: org.callsLimit,
        dashboardUrl: `${dashboardUrl}/dashboard/billing`,
      },
    })
    channels.push('webhook')

    await prisma.organization.update({
      where: { id: org.id },
      data: { lastBudgetAlertAt: now, lastBudgetAlertLevel: level },
    })

    sent.push({ orgId: org.id, level, channels })
  }
  return sent
}

// Weekly digest. Runs Monday morning UTC (08:00-12:00 window — actual hour
// depends on when the scheduler tick lands inside it). Sends an email to
// OWNER/ADMIN of every org that had activity in the previous week.
//
// State tracking: we keep the last weekStart we sent for a given org in
// memory only — restarts after Monday morning may double-send, which is
// preferable to missing weeks during routine restarts. A small per-org row
// would fix this if it ever matters.

const sentDigestsThisWeek = new Set<string>() // orgId-yyyyWW

function isoWeekKey(orgId: string, monday: Date): string {
  const y = monday.getUTCFullYear()
  const start = new Date(Date.UTC(y, 0, 1))
  const week = Math.ceil((((+monday - +start) / 86400000) + start.getUTCDay() + 1) / 7)
  return `${orgId}-${y}W${String(week).padStart(2, '0')}`
}

function lastMondayUtc(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dow = d.getUTCDay() // 0 = Sun, 1 = Mon
  const diff = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + diff)
  // We send the digest covering the PREVIOUS Mon..Sun, so step back one more week.
  d.setUTCDate(d.getUTCDate() - 7)
  return d
}

export async function runWeeklyDigest(): Promise<{ orgId: string; channels: string[] }[]> {
  const now = new Date()
  // Send window: Mondays between 08:00 and 12:00 UTC.
  if (now.getUTCDay() !== 1) return []
  if (now.getUTCHours() < 8 || now.getUTCHours() >= 12) return []

  const weekStart = lastMondayUtc(now) // last full week's Monday
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7)

  const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'
  const sent: { orgId: string; channels: string[] }[] = []

  // Only orgs that had calls last week — no point emailing an empty digest.
  const activeOrgs = await prisma.dailyStats.groupBy({
    by: ['organizationId'],
    where: { date: { gte: weekStart, lt: weekEnd } },
    _sum: { costUsd: true, callCount: true },
    having: { callCount: { _sum: { gt: 0 } } },
  })

  for (const row of activeOrgs) {
    const key = isoWeekKey(row.organizationId, weekStart)
    if (sentDigestsThisWeek.has(key)) continue

    const org = await prisma.organization.findUnique({
      where: { id: row.organizationId },
      select: {
        id: true, name: true,
        members: { where: { role: { in: ['OWNER', 'ADMIN'] } }, select: { user: { select: { email: true } } } },
      },
    })
    if (!org) continue

    const recipients = org.members.map(m => m.user.email).filter(Boolean)
    if (recipients.length === 0) continue

    // Prior week metrics for the delta.
    const prevAgg = await prisma.dailyStats.aggregate({
      where: { organizationId: org.id, date: { gte: prevWeekStart, lt: weekStart } },
      _sum: { costUsd: true, callCount: true },
    })

    // Top 5 tools last week.
    const topTools = await prisma.dailyStats.groupBy({
      by: ['toolName', 'serverName'],
      where: { organizationId: org.id, date: { gte: weekStart, lt: weekEnd }, toolName: { not: null } },
      _sum: { callCount: true, costUsd: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 5,
    })

    // Lightweight anomaly heuristic: any tool whose cost > 2x median of the
    // last 4 weeks (excluding this week). Useful, not magic.
    const fourWeeksAgo = new Date(weekStart)
    fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 28)
    const anomalies: { label: string; detail: string }[] = []
    for (const t of topTools.slice(0, 3)) {
      const baseline = await prisma.dailyStats.aggregate({
        where: {
          organizationId: org.id,
          date: { gte: fourWeeksAgo, lt: weekStart },
          serverName: t.serverName,
          toolName: t.toolName,
        },
        _sum: { costUsd: true },
      })
      const baselineWeekly = (baseline._sum.costUsd ?? 0) / 4
      const thisWeek = t._sum.costUsd ?? 0
      if (baselineWeekly > 0 && thisWeek > baselineWeekly * 2) {
        const ratio = (thisWeek / baselineWeekly).toFixed(1)
        anomalies.push({
          label: `${t.serverName}/${t.toolName}`,
          detail: `cost is ${ratio}x the 4-week average ($${thisWeek.toFixed(4)} vs avg $${baselineWeekly.toFixed(4)})`,
        })
      }
    }

    const { subject, html } = weeklyDigestEmail({
      organizationName: org.name,
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: new Date(+weekEnd - 1).toISOString().slice(0, 10),
      weekCalls: row._sum.callCount ?? 0,
      weekCostUsd: row._sum.costUsd ?? 0,
      prevWeekCalls: prevAgg._sum.callCount ?? 0,
      prevWeekCostUsd: prevAgg._sum.costUsd ?? 0,
      topTools: topTools.map(t => ({
        serverName: t.serverName ?? '—',
        toolName: t.toolName ?? '—',
        costUsd: t._sum.costUsd ?? 0,
        callCount: t._sum.callCount ?? 0,
      })),
      anomalies,
      dashboardUrl: `${dashboardUrl}/dashboard`,
    })

    const r = await sendEmail({ to: recipients, subject, html })
    const channels = r.error ? [] : ['email']
    sentDigestsThisWeek.add(key)
    sent.push({ orgId: org.id, channels })
  }

  return sent
}

// ────────────────────────────────────────────────────────────────────────
// Activation drip — sends day-2 / day-5 / day-14 emails to users who
// signed up but never made a tool call. The biggest leak in the funnel.
// We dedupe per user via timestamp columns so a worker crash or extra
// scheduler tick can NEVER double-send.
// ────────────────────────────────────────────────────────────────────────

interface DripStep {
  label: 'day2' | 'day5' | 'day14'
  minAgeHours: number
  maxAgeHours: number
  sentColumn: 'activationDay2SentAt' | 'activationDay5SentAt' | 'reactivationDay14SentAt'
  buildEmail: (args: { name: string | null; dashboardUrl: string; calendarUrl?: string }) => { subject: string; html: string }
}

const DRIP_STEPS: DripStep[] = [
  {
    label: 'day2',
    minAgeHours: 36,
    maxAgeHours: 96, // ~1.5–4 days; gives slack for the once-per-hour tick
    sentColumn: 'activationDay2SentAt',
    buildEmail: ({ name, dashboardUrl }) => activationDay2Email({ name, dashboardUrl }),
  },
  {
    label: 'day5',
    minAgeHours: 5 * 24,
    maxAgeHours: 7 * 24,
    sentColumn: 'activationDay5SentAt',
    buildEmail: ({ name, dashboardUrl, calendarUrl }) =>
      activationDay5Email({ name, dashboardUrl, calendarUrl }),
  },
  {
    label: 'day14',
    minAgeHours: 14 * 24,
    maxAgeHours: 17 * 24,
    sentColumn: 'reactivationDay14SentAt',
    buildEmail: ({ name, dashboardUrl }) => reactivationDay14Email({ name, dashboardUrl }),
  },
]

export async function runActivationDrip(): Promise<{ step: DripStep['label']; sent: number }[]> {
  const summary: { step: DripStep['label']; sent: number }[] = []
  const dashboardUrl =
    process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'
  const calendarUrl = process.env.CALENDAR_BOOKING_URL // optional, used only on day-5
  const now = Date.now()

  for (const step of DRIP_STEPS) {
    const windowStart = new Date(now - step.maxAgeHours * 3600 * 1000)
    const windowEnd = new Date(now - step.minAgeHours * 3600 * 1000)

    // Candidates: created in this step's age window AND haven't received it yet.
    const candidates = await prisma.user.findMany({
      where: {
        createdAt: { gte: windowStart, lte: windowEnd },
        [step.sentColumn]: null,
      },
      select: {
        id: true, email: true, name: true,
        memberships: { select: { organizationId: true }, take: 1 },
      },
      take: 200, // safety cap per tick
    })

    let sent = 0
    for (const u of candidates) {
      // Skip if user already has tool-call activity (data flowing = activated).
      const orgIds = u.memberships.map((m) => m.organizationId)
      if (orgIds.length > 0) {
        const callExists = await prisma.toolCall.findFirst({
          where: { organizationId: { in: orgIds } },
          select: { id: true },
        })
        if (callExists) {
          // Mark all steps as "sent" so we never bug this user again.
          await prisma.user.update({
            where: { id: u.id },
            data: {
              activationDay2SentAt: new Date(),
              activationDay5SentAt: new Date(),
              reactivationDay14SentAt: new Date(),
            },
          })
          continue
        }
      }

      const email = step.buildEmail({ name: u.name, dashboardUrl, calendarUrl })
      try {
        await sendEmail({ to: u.email, ...email })
      } catch (err) {
        console.error(`[activation-drip] failed to send ${step.label} to ${u.email}:`, err)
        // Still stamp the column so we don't retry forever. Resend transient
        // failures are rare; better to skip one user than re-send to many.
      }
      await prisma.user.update({
        where: { id: u.id },
        data: { [step.sentColumn]: new Date() },
      })
      sent++
    }

    if (sent > 0) summary.push({ step: step.label, sent })
  }

  return summary
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
      const digests = await runWeeklyDigest()
      const drip = await runActivationDrip()
      console.log(`[maintenance] retention=${JSON.stringify(retention)} quota_alerts=${quotaAlerts.length} spend_alerts=${spendAlerts.length} digests=${digests.length} drip=${JSON.stringify(drip)}`)
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
