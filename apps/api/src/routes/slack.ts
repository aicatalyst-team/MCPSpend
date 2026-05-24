// Slack slash commands — `/mcpspend today`, `/mcpspend top`, `/mcpspend budget`, etc.
//
// Auth: the user creates an MCPSpend API key, then in their Slack workspace
// sets up a slash command with URL like:
//   https://api.mcpspend.com/api/slack/cmd?key=mcps_live_xxx
//
// This avoids the OAuth installer + App-store flow we'd otherwise need.
// Slack POSTs application/x-www-form-urlencoded; we respond with their
// Block Kit JSON shape within their 3-second timeout.

import express, { Router } from 'express'
import { prisma } from '../lib/prisma'
import { hashApiKey } from '../lib/apiKey'

const router = Router()

// Slack sends form-encoded, not JSON. Add a body parser that runs only on
// this route (avoid breaking the global json parser elsewhere).
router.use(express.urlencoded({ extended: false }))

// Block Kit helper
interface SlackResp {
  response_type: 'in_channel' | 'ephemeral'
  text?: string
  blocks?: unknown[]
}

function ephemeralText(text: string): SlackResp {
  return { response_type: 'ephemeral', text }
}

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '$0.0000'
  return '$' + n.toFixed(4)
}

router.post('/cmd', async (req, res) => {
  const apiKey =
    (typeof req.query.key === 'string' && req.query.key) ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.replace('Bearer ', '').trim() : null)

  if (!apiKey || !apiKey.startsWith('mcps_')) {
    res.json(ephemeralText('MCPSpend slash command requires an API key in the URL — see https://mcpspend.com/docs#slack'))
    return
  }

  const keyHash = hashApiKey(apiKey)
  const key = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, organizationId: true, revokedAt: true },
  })
  if (!key || key.revokedAt) {
    res.json(ephemeralText('That MCPSpend API key is invalid or revoked. Generate a new one at https://mcpspend.com/dashboard/keys.'))
    return
  }
  const organizationId = key.organizationId

  // Slack form fields
  const text = ((req.body?.text as string) || '').trim().toLowerCase()
  const userName = (req.body?.user_name as string) || 'someone'
  // First token is the sub-command, rest is args
  const [sub, ...argsArr] = text.split(/\s+/).filter(Boolean)
  const args = argsArr.join(' ')

  try {
    switch (sub || 'today') {
      case 'today':
      case 'cost': {
        const since = new Date()
        since.setUTCHours(0, 0, 0, 0)
        const agg = await prisma.toolCall.aggregate({
          where: { organizationId, calledAt: { gte: since } },
          _sum: { costUsd: true },
          _count: { _all: true },
        })
        const errs = await prisma.toolCall.count({
          where: { organizationId, calledAt: { gte: since }, success: false },
        })
        const r: SlackResp = {
          response_type: 'in_channel',
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: '📊 MCPSpend — today' } },
            { type: 'section', fields: [
              { type: 'mrkdwn', text: `*Cost*\n${fmtUsd(agg._sum.costUsd)}` },
              { type: 'mrkdwn', text: `*Tool calls*\n${agg._count._all.toLocaleString()}` },
              { type: 'mrkdwn', text: `*Errors*\n${errs.toLocaleString()}` },
              { type: 'mrkdwn', text: `*Asked by*\n${userName}` },
            ] },
            { type: 'context', elements: [
              { type: 'mrkdwn', text: '<https://mcpspend.com/dashboard|Open dashboard>' },
            ] },
          ],
        }
        res.json(r)
        return
      }

      case 'top': {
        const days = Math.min(parseInt(args) || 7, 365)
        const since = new Date()
        since.setUTCDate(since.getUTCDate() - days)
        const groups = await prisma.dailyStats.groupBy({
          by: ['toolName', 'serverName'],
          where: { organizationId, date: { gte: since }, toolName: { not: null } },
          _sum: { callCount: true, costUsd: true },
          orderBy: { _sum: { costUsd: 'desc' } },
          take: 5,
        })
        const lines = groups.map((g, i) =>
          `${i + 1}. \`${g.serverName ?? '?'}/${g.toolName}\` — ${fmtUsd(g._sum.costUsd)} (${(g._sum.callCount ?? 0).toLocaleString()} calls)`,
        )
        res.json({
          response_type: 'in_channel',
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: `🔝 Top tools — last ${days} days` } },
            { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') || '_No data yet._' } },
            { type: 'context', elements: [{ type: 'mrkdwn', text: '<https://mcpspend.com/dashboard|Full breakdown>' }] },
          ],
        })
        return
      }

      case 'budget': {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true, plan: true, callsThisMonth: true, callsLimit: true, monthlyBudgetUsd: true },
        })
        if (!org) { res.json(ephemeralText('Organization not found')); return }
        const pctQuota = (org.callsThisMonth / org.callsLimit) * 100
        const fields = [
          { type: 'mrkdwn', text: `*Plan*\n${org.plan}` },
          { type: 'mrkdwn', text: `*Call quota*\n${org.callsThisMonth.toLocaleString()} / ${org.callsLimit.toLocaleString()} (${pctQuota.toFixed(1)}%)` },
        ]
        if (org.monthlyBudgetUsd) {
          const since = new Date(); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0)
          const spend = await prisma.toolCall.aggregate({
            where: { organizationId, calledAt: { gte: since } }, _sum: { costUsd: true },
          })
          const spendUsd = spend._sum.costUsd ?? 0
          const pctSpend = (spendUsd / org.monthlyBudgetUsd) * 100
          fields.push(
            { type: 'mrkdwn', text: `*Dollar budget*\n$${org.monthlyBudgetUsd.toFixed(2)} / mo` },
            { type: 'mrkdwn', text: `*MTD spend*\n$${spendUsd.toFixed(2)} (${pctSpend.toFixed(1)}%)` },
          )
        }
        res.json({
          response_type: 'in_channel',
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: `💸 ${org.name} — budget` } },
            { type: 'section', fields },
            { type: 'context', elements: [{ type: 'mrkdwn', text: '<https://mcpspend.com/dashboard/billing|Manage budget>' }] },
          ],
        })
        return
      }

      case 'help':
      case '': {
        res.json(ephemeralText(
          'MCPSpend slash commands:\n' +
          '• `/mcpspend today` — today\'s cost + call count + errors\n' +
          '• `/mcpspend top [days]` — top 5 tools by cost (default 7d)\n' +
          '• `/mcpspend budget` — plan, quota %, $ budget %\n' +
          '• `/mcpspend help` — this message',
        ))
        return
      }

      default:
        res.json(ephemeralText(`Unknown sub-command \`${sub}\`. Try \`/mcpspend help\`.`))
    }
  } catch (err) {
    console.error('[slack] command failed:', err)
    res.json(ephemeralText('MCPSpend hit an error — check the dashboard or email support@mcpspend.com.'))
  }
})

export { router as slackRouter }
