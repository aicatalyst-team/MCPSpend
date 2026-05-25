// Customer-facing routes to manage webhook subscriptions. Distinct from
// routes/webhooks.ts which receives INBOUND webhooks from Stripe.
//
// Mounted at /api/webhook-subscriptions to keep the URL space tidy and not
// collide with the Stripe receiver at /api/webhooks.

import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest, requireOrg, requireRole, requireUserSession } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { generateWebhookSecret, SUPPORTED_EVENTS } from '../lib/webhooks'
import { writeAudit } from '../lib/audit'

const router = Router()

// List webhooks for current org (no secret in response — that's only ever
// shown once at creation time).
router.get('/', requireOrg, async (req: AuthRequest, res) => {
  // No relation on Webhook.createdBy — the schema only has the scalar
  // createdByUserId column. Selecting `createdBy` here crashed Prisma at
  // runtime with "Unknown field createdBy" and bubbled up to the dashboard
  // as "Failed to load webhooks". The UI doesn't render it anyway.
  const webhooks = await prisma.webhook.findMany({
    where: { organizationId: req.organizationId! },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, label: true, targetUrl: true, events: true,
      isActive: true, lastDeliveryAt: true, lastDeliveryStatus: true,
      consecutiveFailures: true, createdAt: true, createdByUserId: true,
    },
  })
  res.json(webhooks)
})

// Create a webhook (OWNER/ADMIN). Returns the plaintext secret ONCE.
router.post('/', requireOrg, requireUserSession, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({
    label: z.string().min(1).max(80),
    targetUrl: z.string().url().startsWith('https://'),
    events: z.array(z.enum(SUPPORTED_EVENTS)).min(1),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const secret = generateWebhookSecret()
  const webhook = await prisma.webhook.create({
    data: {
      organizationId: req.organizationId!,
      label: parsed.data.label,
      targetUrl: parsed.data.targetUrl,
      events: parsed.data.events,
      secret,
      createdByUserId: req.userId!,
    },
    select: { id: true, label: true, targetUrl: true, events: true, isActive: true, createdAt: true },
  })

  void writeAudit({
    organizationId: req.organizationId!,
    userId: req.userId,
    action: 'webhook.create',
    target: webhook.id,
    metadata: { label: webhook.label, events: webhook.events },
    req,
  })

  res.status(201).json({ ...webhook, secret })
})

// Update events / label / active. Secret is not editable — rotate by
// re-creating. targetUrl is not editable for the same reason (signature
// chain-of-custody clarity).
router.patch('/:id', requireOrg, requireUserSession, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({
    label: z.string().min(1).max(80).optional(),
    events: z.array(z.enum(SUPPORTED_EVENTS)).min(1).optional(),
    isActive: z.boolean().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const target = await prisma.webhook.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId! },
    select: { id: true, isActive: true },
  })
  if (!target) { res.status(404).json({ error: 'Webhook not found' }); return }

  const updated = await prisma.webhook.update({
    where: { id: target.id },
    data: {
      ...parsed.data,
      // Re-enabling resets the failure counter so we don't auto-disable again
      // on the very next event.
      ...(parsed.data.isActive === true && !target.isActive ? { consecutiveFailures: 0 } : {}),
    },
    select: { id: true, label: true, targetUrl: true, events: true, isActive: true },
  })

  res.json(updated)
})

// Delete
router.delete('/:id', requireOrg, requireUserSession, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const target = await prisma.webhook.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId! },
    select: { id: true, label: true },
  })
  if (!target) { res.status(404).json({ error: 'Webhook not found' }); return }
  await prisma.webhook.delete({ where: { id: target.id } })
  void writeAudit({
    organizationId: req.organizationId!,
    userId: req.userId,
    action: 'webhook.delete',
    target: target.id,
    metadata: { label: target.label },
    req,
  })
  res.status(204).send()
})

// Recent delivery log for a single webhook
router.get('/:id/deliveries', requireOrg, async (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
  const webhook = await prisma.webhook.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId! },
    select: { id: true },
  })
  if (!webhook) { res.status(404).json({ error: 'Webhook not found' }); return }

  const deliveries = await prisma.webhookEvent.findMany({
    where: { webhookId: webhook.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, eventType: true, httpStatus: true, responseBody: true,
      succeeded: true, attempts: true, createdAt: true,
    },
  })
  res.json(deliveries)
})

// Send a test event — useful for verifying the receiver's signature
// verification + that the URL is reachable.
router.post('/:id/test', requireOrg, requireUserSession, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const webhook = await prisma.webhook.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId! },
    select: { id: true },
  })
  if (!webhook) { res.status(404).json({ error: 'Webhook not found' }); return }

  const { dispatchWebhook } = await import('../lib/webhooks')
  void dispatchWebhook({
    organizationId: req.organizationId!,
    eventType: 'budget.alert', // arbitrary — receiver should treat as test
    payload: {
      test: true,
      message: 'This is a test event from MCPSpend webhook setup.',
      organizationId: req.organizationId,
    },
  })
  res.status(202).json({ queued: true })
})

export { router as webhookSubscriptionsRouter }
