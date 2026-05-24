import { Router } from 'express'
import Stripe from 'stripe'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { sendEmail } from '../lib/email'
import { slugify, randomSlugSuffix } from '../lib/slug'

const router = Router()

// Map every Stripe Price (monthly OR yearly) to plan + monthly call limit.
// The same plan share the same limit regardless of cadence.
const PLAN_LIMITS: Record<string, { limit: number; plan: 'PRO' | 'TEAM' | 'ENTERPRISE' }> = {
  [process.env.STRIPE_PRICE_PRO         || 'price_pro']:           { limit: 1_000_000,   plan: 'PRO' },
  [process.env.STRIPE_PRICE_PRO_YEARLY  || 'price_pro_yearly']:    { limit: 1_000_000,   plan: 'PRO' },
  [process.env.STRIPE_PRICE_TEAM        || 'price_team']:          { limit: 10_000_000,  plan: 'TEAM' },
  [process.env.STRIPE_PRICE_TEAM_YEARLY || 'price_team_yearly']:   { limit: 10_000_000,  plan: 'TEAM' },
  [process.env.STRIPE_PRICE_ENT         || 'price_enterprise']:    { limit: 999_999_999, plan: 'ENTERPRISE' },
  [process.env.STRIPE_PRICE_ENT_YEARLY  || 'price_ent_yearly']:    { limit: 999_999_999, plan: 'ENTERPRISE' },
}

// Free-tier monthly call limit (also referenced in schema default). Lowered
// from 50k to 25k 2026-05-23 — at 50k a heavy Cursor/Claude Code user could
// stay on free forever; 25k is enough to see value but not enough to live on.
const FREE_TIER_LIMIT = 25_000

function isMcpSpendEvent(obj: { metadata?: Record<string, string> }): boolean {
  return !obj.metadata?.project || obj.metadata.project === 'mcpspend'
}

async function uniqueOrgSlug(name: string): Promise<string> {
  const base = slugify(name)
  for (let i = 0; i < 4; i++) {
    const candidate = i === 0 ? base : `${base}-${randomSlugSuffix()}`
    const exists = await prisma.organization.findUnique({ where: { slug: candidate } })
    if (!exists) return candidate
  }
  return `${base}-${randomSlugSuffix()}-${Date.now().toString(36)}`
}

// On successful signup checkout, create the user + org + email magic link.
async function handleSignupCheckout(session: Stripe.Checkout.Session) {
  const email = (session.customer_details?.email || session.customer_email || '').toLowerCase()
  if (!email) {
    console.error('[webhook] signup session has no email:', session.id)
    return
  }

  const plan = (session.metadata?.plan as 'PRO' | 'TEAM' | 'ENTERPRISE' | undefined) || 'PRO'
  const limit = ({ PRO: 1_000_000, TEAM: 10_000_000, ENTERPRISE: 999_999_999 } as const)[plan]
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { organization: true } } },
  })

  let organizationId: string

  if (existingUser) {
    // User already exists (e.g. signed up free, then upgraded via Stripe page link).
    // Upgrade their first organization to the paid plan.
    const firstOrg = existingUser.memberships[0]?.organization
    if (firstOrg) {
      organizationId = firstOrg.id
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          plan,
          callsLimit: limit,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        },
      })
    } else {
      // Edge case: existing user with no org. Make one.
      const orgName = session.customer_details?.name || `${email.split('@')[0]}'s workspace`
      const slug = await uniqueOrgSlug(orgName)
      const org = await prisma.organization.create({
        data: {
          name: orgName, slug, plan, callsLimit: limit,
          stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId,
          members: { create: { userId: existingUser.id, role: 'OWNER' } },
        },
      })
      organizationId = org.id
    }
  } else {
    // Fresh signup — create user (no password yet) + org.
    const orgName = session.customer_details?.name || `${email.split('@')[0]}'s workspace`
    const slug = await uniqueOrgSlug(orgName)
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: session.customer_details?.name || null },
      })
      const org = await tx.organization.create({
        data: {
          name: orgName, slug, plan, callsLimit: limit,
          stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId,
          members: { create: { userId: user.id, role: 'OWNER' } },
        },
      })
      return { user, org }
    })
    organizationId = result.org.id
  }

  // Generate a 60-minute setup token (JWT) for the magic link.
  const setupToken = jwt.sign(
    { purpose: 'setup-password', email, organizationId },
    process.env.JWT_SECRET!,
    { expiresIn: '60m' },
  )
  const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'
  const magicLink = `${dashboardUrl}/setup-account?token=${encodeURIComponent(setupToken)}`

  void sendEmail({
    to: email,
    subject: 'Welcome to MCPSpend — set your password',
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#0a0a0a;color:#e5e7eb;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:14px;padding:32px;">
        <h1 style="margin:0 0 16px;color:#fff;font-size:22px;">Welcome to MCPSpend</h1>
        <p>Your <strong>${plan}</strong> subscription is active. Click below to set your password and access your dashboard:</p>
        <p style="margin:24px 0;"><a href="${magicLink}" style="background:#fff;color:#0a0a0a;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;">Set password & sign in</a></p>
        <p style="color:#6b7280;font-size:13px;">The link expires in 60 minutes. If you didn't sign up, contact <a href="mailto:support@mcpspend.com" style="color:#0ea5e9;">support@mcpspend.com</a>.</p>
        <p style="color:#6b7280;font-size:11px;margin-top:32px;">NewRzs SRL · CUI RO48756557</p>
      </div>
    </body></html>`,
  })

  console.log(`[webhook] signup processed: ${email} → ${plan}, org=${organizationId}`)

  // Admin notify — same as the free-signup path in auth.ts but for the
  // paid-checkout flow. Both routes lead to a new account being created.
  void (async () => {
    try {
      const { adminSignupNotifyEmail } = await import('../emails/templates')
      const adminEmail = process.env.ADMIN_NOTIFY_EMAIL
      if (!adminEmail) return
      const [totalUsers, totalOrgs] = await Promise.all([
        prisma.user.count(),
        prisma.organization.count(),
      ])
      const orgRow = await prisma.organization.findUnique({
        where: { id: organizationId }, select: { name: true, plan: true },
      })
      await sendEmail({
        to: adminEmail,
        ...adminSignupNotifyEmail({
          userEmail: email,
          userName: session.customer_details?.name || null,
          orgName: orgRow?.name || 'Unknown',
          plan: (orgRow?.plan as 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE') || plan,
          source: 'checkout',
          totalUsers,
          totalOrgs,
        }),
      })
    } catch (err) {
      console.error('[webhook] admin notify failed:', err)
    }
  })()
}

// Stripe subscription statuses that mean "no active paid access":
// - past_due / unpaid: latest invoice failed, payment retries exhausted
// - canceled / incomplete_expired: explicitly canceled or initial payment never completed
const INACTIVE_STATUSES = new Set(['past_due', 'unpaid', 'canceled', 'incomplete_expired'])

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  // Failed-payment grace ended OR sub canceled → downgrade to FREE so the
  // quota check in /v1/ingest starts blocking. We do NOT clear stripeCustomerId
  // (so they can resume on the same Stripe customer record).
  if (INACTIVE_STATUSES.has(sub.status)) {
    await prisma.organization.updateMany({
      where: { stripeCustomerId: sub.customer as string },
      data: {
        plan: 'FREE',
        callsLimit: FREE_TIER_LIMIT,
        stripeSubscriptionId: null,
      },
    })
    return
  }

  const priceId = sub.items.data[0]?.price.id
  const planInfo = PLAN_LIMITS[priceId]
  if (!planInfo) return

  // Capture the previous plan + sub state so we can decide whether to send the
  // "subscription started" email (first transition into a paid plan or upgrade
  // to a different paid plan). We don't email on duplicate updates.
  const prev = await prisma.organization.findFirst({
    where: { stripeCustomerId: sub.customer as string },
    select: { id: true, name: true, plan: true, stripeSubscriptionId: true, members: { where: { role: { in: ['OWNER', 'ADMIN'] } }, select: { user: { select: { email: true } } } } },
  })

  await prisma.organization.updateMany({
    where: { stripeCustomerId: sub.customer as string },
    data: {
      plan: planInfo.plan,
      callsLimit: planInfo.limit,
      stripeSubscriptionId: sub.id,
    },
  })

  // Fire confirmation email when plan actually changed (FREE→paid, or paid→paid
  // tier change). Skip if it's the same plan with the same sub ID (Stripe sends
  // duplicate updates for things like payment-method changes).
  const isNewSubscription = prev && (prev.plan !== planInfo.plan || prev.stripeSubscriptionId !== sub.id)
  if (isNewSubscription && prev.plan !== planInfo.plan) {
    void (async () => {
      try {
        const { subscriptionStartedEmail } = await import('../emails/templates')
        const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'
        const cadence = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
        const recipients = prev.members.map(m => m.user.email).filter(Boolean)
        if (recipients.length === 0) return
        await sendEmail({
          to: recipients,
          ...subscriptionStartedEmail({
            organizationName: prev.name,
            plan: planInfo.plan,
            cadence,
            callsLimit: planInfo.limit,
            dashboardUrl: `${dashboardUrl}/dashboard`,
          }),
        })
      } catch (err) {
        console.error('[webhook] subscription started email failed:', err)
      }
    })()
  }
}

router.post('/stripe', async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const sig = req.headers['stripe-signature']!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  // Filter to MCPSpend events only — shared Stripe account with other projects.
  const obj = event.data.object as { metadata?: Record<string, string> }
  if (!isMcpSpendEvent(obj)) {
    res.json({ received: true, ignored: 'foreign project' })
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.flow === 'signup') {
          await handleSignupCheckout(session)
        }
        // Otherwise: existing-user upgrade — subscription.created will handle it.
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await prisma.organization.updateMany({
          where: { stripeCustomerId: sub.customer as string },
          data: { plan: 'FREE', callsLimit: FREE_TIER_LIMIT, stripeSubscriptionId: null },
        })
        break
      }
    }
  } catch (err) {
    console.error(`[webhook] failed to process ${event.type}:`, err)
    // Return 200 anyway so Stripe doesn't retry — we'll inspect logs.
  }

  res.json({ received: true })
})

export { router as webhookRouter }
