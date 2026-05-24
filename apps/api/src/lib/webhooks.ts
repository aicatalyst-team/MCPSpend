// Webhook dispatcher — fan-out events to customer-defined URLs.
//
// Design:
//   - Fire-and-forget: callers `void dispatchWebhook(...)`, never block on it
//   - HMAC-SHA256 signature over the raw body, sent as X-MCPSpend-Signature
//   - 5s timeout per request, no retry on the hot path (we record the failure
//     and the maintenance scheduler can re-attempt later if needed)
//   - Auto-disable after 5 consecutive failures so a permanently broken URL
//     stops draining capacity on every event
//   - Every attempt logged to WebhookEvent so users can debug from the UI

import crypto from 'node:crypto'
import { prisma } from './prisma'

export const SUPPORTED_EVENTS = [
  'budget.alert',
  'spend.alert',
  'anomaly.detected',
  'key.create',
  'key.revoke',
  'member.invite',
  'member.remove',
  'project.create',
  'project.delete',
] as const

export type WebhookEventType = (typeof SUPPORTED_EVENTS)[number]

const FAILURE_THRESHOLD = 5
const REQUEST_TIMEOUT_MS = 5000

export interface DispatchArgs {
  organizationId: string
  eventType: WebhookEventType
  payload: Record<string, unknown>
}

/**
 * Sign a JSON body with the webhook's secret. Receivers verify by re-running
 * this with the same secret + body and comparing to X-MCPSpend-Signature.
 */
export function signBody(body: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex')
}

/**
 * Generate a fresh signing secret. Shown to the user ONCE on webhook creation,
 * then stored plaintext (it's a signing key, not a credential we hash). Acts
 * like a Stripe webhook secret — receivers paste it into their verifier.
 */
export function generateWebhookSecret(): string {
  return 'whsec_' + crypto.randomBytes(32).toString('hex')
}

/**
 * Fan out a single event to every active webhook subscribed to its type.
 * Never throws — webhook delivery failures must not break the business path
 * that triggered the event.
 */
export async function dispatchWebhook(args: DispatchArgs): Promise<void> {
  try {
    const hooks = await prisma.webhook.findMany({
      where: {
        organizationId: args.organizationId,
        isActive: true,
        events: { has: args.eventType },
      },
    })

    if (hooks.length === 0) return

    const envelope = {
      id: crypto.randomUUID(),
      type: args.eventType,
      organizationId: args.organizationId,
      createdAt: new Date().toISOString(),
      data: args.payload,
    }
    const body = JSON.stringify(envelope)

    await Promise.all(hooks.map((hook) => deliverOne(hook, envelope, body)))
  } catch (err) {
    console.error('[webhooks] dispatch failed:', err)
  }
}

interface HookRow {
  id: string
  organizationId: string
  targetUrl: string
  secret: string
  consecutiveFailures: number
}

async function deliverOne(hook: HookRow, envelope: { id: string; type: string }, body: string): Promise<void> {
  const signature = signBody(body, hook.secret)
  let httpStatus: number | null = null
  let responseBody: string | undefined
  let succeeded = false

  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS)
    const resp = await fetch(hook.targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCPSpend-Webhook/1.0',
        'X-MCPSpend-Signature': signature,
        'X-MCPSpend-Event': envelope.type,
        'X-MCPSpend-Delivery': envelope.id,
      },
      body,
      signal: ac.signal,
    }).finally(() => clearTimeout(timer))

    httpStatus = resp.status
    succeeded = resp.ok
    try {
      const txt = await resp.text()
      responseBody = txt.slice(0, 500)
    } catch {
      // ignore — we just care about the status
    }
  } catch (err) {
    responseBody = err instanceof Error ? err.message.slice(0, 500) : 'unknown error'
  }

  const nextFailures = succeeded ? 0 : hook.consecutiveFailures + 1
  const shouldDisable = nextFailures >= FAILURE_THRESHOLD

  await Promise.all([
    prisma.webhookEvent.create({
      data: {
        webhookId: hook.id,
        organizationId: hook.organizationId,
        eventType: envelope.type,
        payload: envelope,
        httpStatus: httpStatus ?? undefined,
        responseBody,
        succeeded,
      },
    }),
    prisma.webhook.update({
      where: { id: hook.id },
      data: {
        lastDeliveryAt: new Date(),
        lastDeliveryStatus: httpStatus ?? undefined,
        consecutiveFailures: nextFailures,
        ...(shouldDisable ? { isActive: false } : {}),
      },
    }),
  ])
}
