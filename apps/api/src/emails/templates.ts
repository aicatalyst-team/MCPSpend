// Inline HTML templates — kept simple, no template engine needed.
// All emails follow the same shell: NewRzs SRL footer, support@mcpspend.com reply-to.

const BRAND_COLOR = '#0ea5e9'

function shell(opts: { title: string; body: string; ctaText?: string; ctaUrl?: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e5e7eb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111827;border:1px solid #1f2937;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:28px 32px 0;">
          <div style="font-weight:700;font-size:20px;color:#fff;letter-spacing:-0.02em;">MCPSpend</div>
        </td></tr>
        <tr><td style="padding:18px 32px 24px;color:#e5e7eb;font-size:15px;line-height:1.6;">
          ${opts.body}
          ${
            opts.ctaText && opts.ctaUrl
              ? `<div style="margin:24px 0;"><a href="${opts.ctaUrl}" style="display:inline-block;background:#fff;color:#0a0a0a;font-weight:600;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:14px;">${opts.ctaText}</a></div>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid #1f2937;color:#6b7280;font-size:11px;line-height:1.5;">
          Sent by NewRzs SRL · CUI RO48756557 · <a href="mailto:support@mcpspend.com" style="color:${BRAND_COLOR};text-decoration:none;">support@mcpspend.com</a><br/>
          You are receiving this because of activity on your MCPSpend account.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function welcomeEmail(args: { name?: string | null; dashboardUrl: string }) {
  const greeting = args.name ? `Hi ${args.name},` : 'Hi,'
  return {
    subject: 'Welcome to MCPSpend',
    html: shell({
      title: 'Welcome to MCPSpend',
      body: `
        <p>${greeting}</p>
        <p>Your MCPSpend account is ready. Next steps to start tracking MCP tool costs:</p>
        <ol style="padding-left:20px;">
          <li>Create an API key under Settings → API Keys.</li>
          <li>Install the proxy: <code style="background:#0a0a0a;padding:2px 6px;border-radius:4px;font-size:13px;">npm install -g @mcpspend/proxy</code></li>
          <li>Wrap your MCP server with the key — see the dashboard for the exact command.</li>
        </ol>
        <p>If you get stuck, reply to this email and a human will respond.</p>
      `,
      ctaText: 'Open dashboard',
      ctaUrl: args.dashboardUrl,
    }),
  }
}

export function invitationEmail(args: {
  organizationName: string
  invitedByName: string
  acceptUrl: string
}) {
  return {
    subject: `You're invited to ${args.organizationName} on MCPSpend`,
    html: shell({
      title: 'Invitation to join',
      body: `
        <p><strong>${args.invitedByName}</strong> invited you to join <strong>${args.organizationName}</strong> on MCPSpend.</p>
        <p>The invitation link expires in 14 days.</p>
      `,
      ctaText: 'Accept invitation',
      ctaUrl: args.acceptUrl,
    }),
  }
}

export function passwordResetEmail(args: { resetUrl: string }) {
  return {
    subject: 'Reset your MCPSpend password',
    html: shell({
      title: 'Reset your password',
      body: `
        <p>We received a request to reset your MCPSpend password. The link below expires in 30 minutes.</p>
        <p>If you didn&apos;t request this, you can safely ignore the email.</p>
      `,
      ctaText: 'Reset password',
      ctaUrl: args.resetUrl,
    }),
  }
}

export function budgetAlertEmail(args: {
  organizationName: string
  percentUsed: number
  callsUsed: number
  callsLimit: number
  dashboardUrl: string
}) {
  return {
    subject: `${args.percentUsed}% of your MCPSpend quota used`,
    html: shell({
      title: 'Budget alert',
      body: `
        <p><strong>${args.organizationName}</strong> has used <strong>${args.percentUsed}%</strong> of this month&apos;s tool-call quota.</p>
        <p style="background:#0a0a0a;border-left:3px solid ${BRAND_COLOR};padding:10px 14px;border-radius:4px;">
          <span style="color:#9ca3af;">Calls this month:</span> <strong>${args.callsUsed.toLocaleString()}</strong> / ${args.callsLimit.toLocaleString()}
        </p>
        <p>Consider upgrading your plan or applying budget throttles before you hit the cap.</p>
      `,
      ctaText: 'View dashboard',
      ctaUrl: args.dashboardUrl,
    }),
  }
}

// Admin-side notification: someone new just signed up. Sent to whoever
// ADMIN_NOTIFY_EMAIL points to (defaults to support@mcpspend.com). Gives the
// founder a real-time signal of every new account without watching the DB.
export function adminSignupNotifyEmail(args: {
  userEmail: string
  userName: string | null
  orgName: string
  plan: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE'
  source: 'register' | 'checkout'
  totalUsers: number
  totalOrgs: number
}) {
  const planEmoji = { FREE: '🌱', PRO: '💎', TEAM: '🏢', ENTERPRISE: '🏛️' }[args.plan] || ''
  return {
    subject: `${planEmoji} New ${args.plan} signup — ${args.userEmail}`,
    html: shell({
      title: 'New signup',
      body: `
        <p><strong>${args.userName || args.userEmail}</strong> just signed up.</p>
        <p style="background:#0a0a0a;border-left:3px solid ${BRAND_COLOR};padding:10px 14px;border-radius:4px;">
          <span style="color:#9ca3af;">Email:</span> <strong>${args.userEmail}</strong><br>
          <span style="color:#9ca3af;">Org:</span> <strong>${args.orgName}</strong><br>
          <span style="color:#9ca3af;">Plan:</span> <strong>${args.plan}</strong><br>
          <span style="color:#9ca3af;">Source:</span> ${args.source === 'checkout' ? 'Stripe Checkout (paid)' : 'Free signup'}
        </p>
        <p style="color:#6b7280;font-size:13px;">Totals after this signup: ${args.totalUsers.toLocaleString()} users · ${args.totalOrgs.toLocaleString()} orgs.</p>
      `,
      ctaText: 'View admin dashboard',
      ctaUrl: 'https://mcpspend.com/dashboard/admin',
    }),
  }
}

// Subscription started — sent to the customer when an upgrade lands. Stripe
// sends a receipt automatically; this is the friendly "you're in" message
// from MCPSpend with a clear next step (install + first call).
export function subscriptionStartedEmail(args: {
  organizationName: string
  plan: 'PRO' | 'TEAM' | 'ENTERPRISE'
  cadence: 'monthly' | 'yearly' | null
  callsLimit: number
  dashboardUrl: string
}) {
  const cadenceLabel = args.cadence === 'yearly' ? 'yearly' : 'monthly'
  return {
    subject: `Welcome to MCPSpend ${args.plan} 🎉`,
    html: shell({
      title: `You're on ${args.plan}`,
      body: `
        <p>Subscription active for <strong>${args.organizationName}</strong> on the <strong>${args.plan}</strong> plan (${cadenceLabel} billing).</p>
        <p style="background:#0a0a0a;border-left:3px solid ${BRAND_COLOR};padding:10px 14px;border-radius:4px;">
          You now have <strong>${args.callsLimit.toLocaleString()}</strong> tool calls per month, longer retention, CSV + Slack/email budget alerts, and team attribution.
        </p>
        <p>If you haven&apos;t installed the proxy yet, this is the one command that wires up Claude Desktop, Cursor, Windsurf, and VS Code in one shot:</p>
        <pre style="background:#0a0a0a;padding:12px 14px;border-radius:4px;font-size:13px;overflow:auto;">npx --yes @mcpspend/proxy@latest init --key mcps_live_…</pre>
        <p>Any question, just reply to this email — it reaches a human.</p>
      `,
      ctaText: 'Open dashboard',
      ctaUrl: args.dashboardUrl,
    }),
  }
}

// Subscription cancelled (scheduled at period end). Confirms what happens
// next so the user isn't surprised when the plan drops to Free.
export function subscriptionCancelledEmail(args: {
  organizationName: string
  plan: string
  endsAtIso: string | null
  dashboardUrl: string
}) {
  const endsAt = args.endsAtIso ? new Date(args.endsAtIso).toLocaleDateString('en-GB') : 'the end of your current period'
  return {
    subject: `MCPSpend: cancellation scheduled for ${args.organizationName}`,
    html: shell({
      title: 'Cancellation scheduled',
      body: `
        <p><strong>${args.organizationName}</strong>&apos;s ${args.plan} plan will end on <strong>${endsAt}</strong>.</p>
        <p>Until then everything works as before — tracking, dashboard, exports, alerts. After that date the org drops to the Free tier (25,000 calls/month) automatically.</p>
        <p>Change your mind any time before ${endsAt} and we&apos;ll keep you on the current plan with no interruption.</p>
      `,
      ctaText: 'Resume subscription',
      ctaUrl: args.dashboardUrl,
    }),
  }
}

// Weekly digest — sent every Monday morning to OWNER/ADMIN of every org with
// any activity last week. The retention killer: reminds people the product
// exists, surfaces anomalies, drives them back to the dashboard.
export function weeklyDigestEmail(args: {
  organizationName: string
  weekStart: string  // ISO date (Monday)
  weekEnd: string    // ISO date (Sunday)
  weekCalls: number
  weekCostUsd: number
  prevWeekCalls: number
  prevWeekCostUsd: number
  topTools: { serverName: string; toolName: string; costUsd: number; callCount: number }[]
  anomalies: { label: string; detail: string }[]
  dashboardUrl: string
}) {
  const deltaPercent = args.prevWeekCostUsd > 0
    ? Math.round(((args.weekCostUsd - args.prevWeekCostUsd) / args.prevWeekCostUsd) * 100)
    : null
  const deltaLabel = deltaPercent === null
    ? '(no prior week to compare)'
    : `(${deltaPercent >= 0 ? '+' : ''}${deltaPercent}% vs prior week)`

  const toolRows = args.topTools.slice(0, 5).map((t, i) => `
    <tr>
      <td style="padding:6px 0;color:#9ca3af;width:24px;">${i + 1}.</td>
      <td style="padding:6px 0;color:#e5e7eb;">${t.serverName}/${t.toolName}</td>
      <td style="padding:6px 0;color:#e5e7eb;text-align:right;">$${t.costUsd.toFixed(4)}</td>
      <td style="padding:6px 0;color:#6b7280;text-align:right;padding-left:14px;">${t.callCount.toLocaleString()}</td>
    </tr>
  `).join('')

  const anomalyBlock = args.anomalies.length === 0 ? '' : `
    <p style="margin-top:24px;"><strong>⚠️ Things to look at:</strong></p>
    <ul style="padding-left:20px;margin:0;">
      ${args.anomalies.map(a => `<li style="margin-bottom:6px;"><strong>${a.label}</strong> — <span style="color:#9ca3af;">${a.detail}</span></li>`).join('')}
    </ul>
  `

  return {
    subject: `${args.organizationName} — $${args.weekCostUsd.toFixed(2)} on ${args.weekCalls.toLocaleString()} MCP calls last week`,
    html: shell({
      title: 'Your MCPSpend week',
      body: `
        <p>Hi — here&apos;s last week for <strong>${args.organizationName}</strong>.</p>
        <p style="background:#0a0a0a;border-left:3px solid ${BRAND_COLOR};padding:10px 14px;border-radius:4px;">
          <strong>$${args.weekCostUsd.toFixed(2)}</strong> on <strong>${args.weekCalls.toLocaleString()}</strong> tool calls <span style="color:#9ca3af;">${deltaLabel}</span>
        </p>

        <p style="margin-top:24px;"><strong>Top 5 tools by cost</strong></p>
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">
          ${toolRows || '<tr><td style="color:#6b7280;padding:6px 0;">No tools recorded this week.</td></tr>'}
        </table>

        ${anomalyBlock}

        <p style="margin-top:24px;color:#6b7280;font-size:12px;">
          Reporting window: ${args.weekStart} → ${args.weekEnd} (UTC).
          You can turn this email off by going to <a href="${args.dashboardUrl}" style="color:${BRAND_COLOR};">your dashboard</a>.
        </p>
      `,
      ctaText: 'Open full dashboard',
      ctaUrl: args.dashboardUrl,
    }),
  }
}

// Dollar-budget alert — separate from the call-quota one above. Fires when
// month-to-date spend crosses 50/80/100% of the user's monthlyBudgetUsd.
export function spendAlertEmail(args: {
  organizationName: string
  percentUsed: number
  spendUsd: number
  budgetUsd: number
  dashboardUrl: string
}) {
  const exceeded = args.percentUsed >= 100
  return {
    subject: exceeded
      ? `MCPSpend: ${args.organizationName} exceeded its $${args.budgetUsd.toFixed(2)} budget`
      : `${args.percentUsed}% of your $${args.budgetUsd.toFixed(2)} MCPSpend budget used`,
    html: shell({
      title: exceeded ? 'Budget exceeded' : 'Spend alert',
      body: `
        <p><strong>${args.organizationName}</strong> has used <strong>${args.percentUsed}%</strong> of this month&apos;s ${'$' + args.budgetUsd.toFixed(2)} cost budget.</p>
        <p style="background:#0a0a0a;border-left:3px solid ${BRAND_COLOR};padding:10px 14px;border-radius:4px;">
          <span style="color:#9ca3af;">Spent this month:</span> <strong>${'$' + args.spendUsd.toFixed(2)}</strong> / ${'$' + args.budgetUsd.toFixed(2)}
        </p>
        <p>${exceeded
          ? 'Tool tracking continues, but consider auditing which agents are driving the spike or raising the budget.'
          : 'Heads up so you can act before the cap.'}</p>
      `,
      ctaText: 'Manage budget',
      ctaUrl: args.dashboardUrl,
    }),
  }
}
