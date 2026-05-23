import { Router } from 'express'
import { z } from 'zod'
import Stripe from 'stripe'
import { AuthRequest, requireOrg, requireRole } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()
const publicRouter = Router()

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(key)
}

const PRICE_IDS: Record<string, string | undefined> = {
  PRO: process.env.STRIPE_PRICE_PRO,
  TEAM: process.env.STRIPE_PRICE_TEAM,
  ENTERPRISE: process.env.STRIPE_PRICE_ENT,
}

// POST /api/billing/start — PUBLIC. Creates a Stripe Checkout session for a
// user who is NOT yet authenticated. On `checkout.session.completed` the Stripe
// webhook will create the User + Organization and email a magic link to set
// the password (= verify email + activate account).
publicRouter.post('/start', async (req, res) => {
  const schema = z.object({
    plan: z.enum(['PRO', 'TEAM', 'ENTERPRISE']),
    email: z.string().email().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const priceId = PRICE_IDS[parsed.data.plan]
  if (!priceId) { res.status(503).json({ error: `Stripe price for ${parsed.data.plan} not configured` }); return }

  const stripe = stripeClient()
  const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_creation: 'always',
    customer_email: parsed.data.email,
    success_url: `${dashboardUrl}/setup-account?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${dashboardUrl}/#pricing`,
    metadata: { project: 'mcpspend', flow: 'signup', plan: parsed.data.plan },
    subscription_data: {
      metadata: { project: 'mcpspend', flow: 'signup', plan: parsed.data.plan },
    },
    allow_promotion_codes: true,
  })

  res.json({ url: session.url, sessionId: session.id })
})

// POST /api/billing/checkout — for users who are already authenticated and
// want to upgrade an existing organization.
router.post('/checkout', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({ plan: z.enum(['PRO', 'TEAM', 'ENTERPRISE']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const priceId = PRICE_IDS[parsed.data.plan]
  if (!priceId) { res.status(503).json({ error: `Stripe price for ${parsed.data.plan} not configured` }); return }

  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { id: true, name: true, slug: true, stripeCustomerId: true },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }

  const user = await prisma.user.findUnique({
    where: { id: req.userId! }, select: { email: true },
  })
  if (!user) { res.status(401).json({ error: 'User not found' }); return }

  const stripe = stripeClient()

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
    metadata: { project: 'mcpspend', organizationId: org.id, plan: parsed.data.plan },
    subscription_data: {
      metadata: { project: 'mcpspend', organizationId: org.id, plan: parsed.data.plan },
    },
    allow_promotion_codes: true,
  })

  res.json({ url: session.url })
})

// POST /api/billing/portal — opens the Stripe Customer Portal
router.post('/portal', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
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
