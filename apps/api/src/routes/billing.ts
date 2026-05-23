import { Router } from 'express'
import { z } from 'zod'
import Stripe from 'stripe'
import { AuthRequest, requireOrg, requireRole, requireUserSession } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()
const publicRouter = Router()

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(key)
}

// Resolve a price ID from (plan, cadence). Yearly env vars are optional —
// missing yearly falls back to the monthly price so callers can still buy.
function resolvePriceId(plan: 'PRO' | 'TEAM' | 'ENTERPRISE', cadence: 'monthly' | 'yearly'): string | undefined {
  const monthlyMap = {
    PRO: process.env.STRIPE_PRICE_PRO,
    TEAM: process.env.STRIPE_PRICE_TEAM,
    ENTERPRISE: process.env.STRIPE_PRICE_ENT,
  } as const
  const yearlyMap = {
    PRO: process.env.STRIPE_PRICE_PRO_YEARLY,
    TEAM: process.env.STRIPE_PRICE_TEAM_YEARLY,
    ENTERPRISE: process.env.STRIPE_PRICE_ENT_YEARLY,
  } as const
  return cadence === 'yearly' ? yearlyMap[plan] : monthlyMap[plan]
}

// POST /api/billing/start — PUBLIC. Creates a Stripe Checkout session for a
// user who is NOT yet authenticated. On `checkout.session.completed` the Stripe
// webhook will create the User + Organization and email a magic link to set
// the password (= verify email + activate account).
publicRouter.post('/start', async (req, res) => {
  const schema = z.object({
    plan: z.enum(['PRO', 'TEAM', 'ENTERPRISE']),
    cadence: z.enum(['monthly', 'yearly']).default('monthly'),
    email: z.string().email().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const priceId = resolvePriceId(parsed.data.plan, parsed.data.cadence)
  if (!priceId) { res.status(503).json({ error: `Stripe price for ${parsed.data.plan} ${parsed.data.cadence} not configured` }); return }

  const stripe = stripeClient()
  const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_creation: 'always',
    customer_email: parsed.data.email,
    success_url: `${dashboardUrl}/setup-account?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${dashboardUrl}/#pricing`,
    metadata: { project: 'mcpspend', flow: 'signup', plan: parsed.data.plan, cadence: parsed.data.cadence },
    subscription_data: {
      metadata: { project: 'mcpspend', flow: 'signup', plan: parsed.data.plan, cadence: parsed.data.cadence },
    },
    allow_promotion_codes: true,
  })

  res.json({ url: session.url, sessionId: session.id })
})

// POST /api/billing/checkout — for users who are already authenticated and
// want to start OR change a subscription on their organization.
//
// Two paths:
//   1. No existing subscription → open a fresh Stripe Checkout (creates one).
//   2. Existing subscription   → upgrade/downgrade in place via
//      `stripe.subscriptions.update(...)` with prorations. Returns the
//      dashboard URL so the client can show "subscription updated" UX.
router.post('/checkout', requireOrg, requireUserSession, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({
    plan: z.enum(['PRO', 'TEAM', 'ENTERPRISE']),
    cadence: z.enum(['monthly', 'yearly']).default('monthly'),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const priceId = resolvePriceId(parsed.data.plan, parsed.data.cadence)
  if (!priceId) { res.status(503).json({ error: `Stripe price for ${parsed.data.plan} ${parsed.data.cadence} not configured` }); return }

  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { id: true, name: true, slug: true, stripeCustomerId: true, stripeSubscriptionId: true },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }

  const user = await prisma.user.findUnique({
    where: { id: req.userId! }, select: { email: true },
  })
  if (!user) { res.status(401).json({ error: 'User not found' }); return }

  const stripe = stripeClient()

  // Path 2 — already subscribed: change plan in place, prorated. Avoids the
  // bug where a 2nd Checkout would create a parallel subscription and double-bill.
  if (org.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
      const currentItem = sub.items.data[0]
      if (currentItem?.price.id === priceId) {
        res.json({ updated: true, noChange: true })
        return
      }
      await stripe.subscriptions.update(org.stripeSubscriptionId, {
        items: [{ id: currentItem.id, price: priceId }],
        proration_behavior: 'create_prorations',
        metadata: { project: 'mcpspend', organizationId: org.id, plan: parsed.data.plan, cadence: parsed.data.cadence },
      })
      // Webhook (customer.subscription.updated) will sync plan + limit on our side.
      res.json({ updated: true })
      return
    } catch (err) {
      // If the subscription is gone on Stripe's side (e.g. fully cancelled),
      // fall through to a new Checkout below.
      if ((err as Stripe.errors.StripeError)?.code !== 'resource_missing') {
        res.status(500).json({ error: 'Failed to update subscription' })
        return
      }
    }
  }

  // Path 1 — first-time purchase: open Stripe Checkout.
  let customerId = org.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { project: 'mcpspend', organizationId: org.id, organizationSlug: org.slug },
    })
    customerId = customer.id
    await prisma.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customerId } })
  }

  const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${dashboardUrl}/dashboard/billing?status=success`,
    cancel_url: `${dashboardUrl}/dashboard/billing?status=cancelled`,
    metadata: { project: 'mcpspend', organizationId: org.id, plan: parsed.data.plan, cadence: parsed.data.cadence },
    subscription_data: {
      metadata: { project: 'mcpspend', organizationId: org.id, plan: parsed.data.plan, cadence: parsed.data.cadence },
    },
    allow_promotion_codes: true,
  })

  res.json({ url: session.url })
})

// POST /api/billing/cancel — schedule cancellation at end of current period.
// User keeps paid features until period end; webhook (customer.subscription.deleted)
// will downgrade to FREE when Stripe actually deletes the subscription.
// Does not require Customer Portal to be configured.
router.post('/cancel', requireOrg, requireUserSession, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { stripeSubscriptionId: true },
  })
  if (!org?.stripeSubscriptionId) {
    res.status(400).json({ error: 'No active subscription to cancel' })
    return
  }
  try {
    const sub = await stripeClient().subscriptions.update(org.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })
    res.json({
      scheduled: true,
      cancelAt: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    })
  } catch (err) {
    if ((err as Stripe.errors.StripeError)?.code === 'resource_missing') {
      // Subscription already gone on Stripe side — just clear our side.
      await prisma.organization.update({
        where: { id: req.organizationId! },
        data: { stripeSubscriptionId: null, plan: 'FREE', callsLimit: 25_000 },
      })
      res.json({ scheduled: false, alreadyCancelled: true })
      return
    }
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
})

// POST /api/billing/resume — undo a scheduled cancellation
router.post('/resume', requireOrg, requireUserSession, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { stripeSubscriptionId: true },
  })
  if (!org?.stripeSubscriptionId) {
    res.status(400).json({ error: 'No active subscription' }); return
  }
  try {
    await stripeClient().subscriptions.update(org.stripeSubscriptionId, { cancel_at_period_end: false })
    res.json({ resumed: true })
  } catch {
    res.status(500).json({ error: 'Failed to resume subscription' })
  }
})

// GET /api/billing/status — current subscription state for the org
router.get('/status', requireOrg, requireUserSession, async (req: AuthRequest, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { plan: true, callsLimit: true, callsThisMonth: true, stripeSubscriptionId: true },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }

  let cadence: 'monthly' | 'yearly' | null = null
  let cancelAtPeriodEnd = false
  let currentPeriodEnd: string | null = null

  if (org.stripeSubscriptionId) {
    try {
      const sub = await stripeClient().subscriptions.retrieve(org.stripeSubscriptionId)
      const interval = sub.items.data[0]?.price.recurring?.interval
      cadence = interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : null
      cancelAtPeriodEnd = sub.cancel_at_period_end
      currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
    } catch {
      // Subscription not found on Stripe — keep our DB state.
    }
  }

  res.json({
    plan: org.plan,
    callsLimit: org.callsLimit,
    callsThisMonth: org.callsThisMonth,
    cadence,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    hasSubscription: !!org.stripeSubscriptionId,
  })
})

// POST /api/billing/portal — opens the Stripe Customer Portal (optional — for invoices, payment method updates).
router.post('/portal', requireOrg, requireUserSession, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { stripeCustomerId: true },
  })
  if (!org?.stripeCustomerId) {
    res.status(400).json({ error: 'No active subscription for this organization' })
    return
  }

  const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'
  const session = await stripeClient().billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${dashboardUrl}/dashboard/billing`,
  })
  res.json({ url: session.url })
})

export { router as billingRouter, publicRouter as billingPublicRouter }
