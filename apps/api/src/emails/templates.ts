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
