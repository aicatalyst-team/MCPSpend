// Transactional email via Resend. Activates when RESEND_API_KEY is set in env.
// All callers should be tolerant of disabled email (returns { skipped: true }).

const FROM = process.env.EMAIL_FROM || 'MCPSpend <noreply@mcpspend.com>'
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@mcpspend.com'
const API = 'https://api.resend.com/emails'

interface SendArgs {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export async function sendEmail(args: SendArgs): Promise<{ id?: string; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email "${args.subject}" → ${args.to}`)
    return { skipped: true }
  }

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(args.to) ? args.to : [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo || REPLY_TO,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[email] Resend rejected:', res.status, errBody)
      return { error: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as { id?: string }
    return { id: data.id }
  } catch (err) {
    console.error('[email] Send failed:', err)
    return { error: err instanceof Error ? err.message : 'unknown' }
  }
}
