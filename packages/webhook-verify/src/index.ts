// MCPSpend webhook signature verifier.
//
// Zero dependencies. Works in any Node ≥18 / Bun / Deno / edge runtime that
// exposes the standard `crypto.subtle` (WebCrypto) or Node's `crypto` module.
//
// Usage (Express):
//
//   import express from 'express'
//   import { verifyWebhook } from '@mcpspend/webhook-verify'
//
//   const app = express()
//   app.post('/mcpspend',
//     express.raw({ type: 'application/json' }),
//     async (req, res) => {
//       const ok = await verifyWebhook({
//         body: req.body,                                      // raw Buffer
//         signature: req.header('X-MCPSpend-Signature') ?? '',
//         secret: process.env.MCPSPEND_WEBHOOK_SECRET!,
//       })
//       if (!ok) return res.status(401).send('bad signature')
//       const event = JSON.parse(req.body.toString('utf8'))
//       // …handle event…
//       res.status(204).end()
//     },
//   )
//
// Usage (Next.js Route Handler):
//
//   export async function POST(req: Request) {
//     const body = await req.text()
//     const ok = await verifyWebhook({
//       body,
//       signature: req.headers.get('x-mcpspend-signature') ?? '',
//       secret: process.env.MCPSPEND_WEBHOOK_SECRET!,
//     })
//     if (!ok) return new Response('bad signature', { status: 401 })
//     // …
//   }

import { createHmac, timingSafeEqual } from 'node:crypto'

export interface VerifyArgs {
  /** Raw request body — either a Node Buffer, a Uint8Array, or a string. */
  body: Buffer | Uint8Array | string
  /** The full value of the X-MCPSpend-Signature header, including 'sha256=' prefix. */
  signature: string
  /** The signing secret you saved when creating the webhook. */
  secret: string
}

/**
 * Compute the expected MCPSpend signature for a body. Mostly useful for tests.
 */
export function signBody(body: Buffer | Uint8Array | string, secret: string): string {
  const input = typeof body === 'string' ? body : Buffer.from(body)
  return 'sha256=' + createHmac('sha256', secret).update(input).digest('hex')
}

/**
 * Constant-time verify of an MCPSpend webhook payload.
 *
 * Returns `true` only if the signature matches the body under the given secret.
 * Returns `false` on any malformed input — never throws on user-supplied data.
 */
export function verifyWebhook(args: VerifyArgs): boolean {
  if (!args.signature || !args.secret) return false
  let expected: string
  try {
    expected = signBody(args.body, args.secret)
  } catch {
    return false
  }
  if (expected.length !== args.signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(args.signature))
  } catch {
    return false
  }
}

/**
 * Convenience wrapper: verifies + parses the body as JSON. Throws if either
 * step fails — callers can catch and return 401 / 400 accordingly.
 */
export function verifyAndParse<T = unknown>(args: VerifyArgs): T {
  if (!verifyWebhook(args)) {
    throw new Error('Invalid MCPSpend webhook signature')
  }
  const text = typeof args.body === 'string' ? args.body : Buffer.from(args.body).toString('utf8')
  return JSON.parse(text) as T
}

/**
 * The set of event types MCPSpend can send. Keep in sync with the server.
 */
export type MCPSpendEventType =
  | 'budget.alert'
  | 'spend.alert'
  | 'anomaly.detected'
  | 'key.create'
  | 'key.revoke'
  | 'member.invite'
  | 'member.remove'
  | 'project.create'
  | 'project.delete'

/** Shape of every MCPSpend event envelope. */
export interface MCPSpendEvent<T = Record<string, unknown>> {
  id: string                 // delivery id (UUID)
  type: MCPSpendEventType
  organizationId: string
  createdAt: string          // ISO 8601
  data: T
}
