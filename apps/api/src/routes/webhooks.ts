import { Router } from 'express'
import Stripe from 'stripe'
import { prisma } from '../lib/prisma'

const router = Router()

const PLAN_LIMITS: Record<string, { limit: number; plan: string }> = {
  [process.env.STRIPE_PRICE_PRO || 'price_pro']:        { limit: 1_000_000,  plan: 'PRO' },
  [process.env.STRIPE_PRICE_TEAM || 'price_team']:       { limit: 10_000_000, plan: 'TEAM' },
  [process.env.STRIPE_PRICE_ENT || 'price_enterprise']:  { limit: 999_999_999, plan: 'ENTERPRISE' },
}

router.post('/stripe', async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const sig = req.headers['stripe-signature']!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const priceId = sub.items.data[0].price.id
    const planInfo = PLAN_LIMITS[priceId]

    if (planInfo) {
      await prisma.user.updateMany({
        where: { stripeCustomerId: sub.customer as string },
        data: {
          plan: planInfo.plan as any,
          callsLimit: planInfo.limit,
        },
      })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await prisma.user.updateMany({
      where: { stripeCustomerId: sub.customer as string },
      data: { plan: 'FREE', callsLimit: 50_000 },
    })
  }

  res.json({ received: true })
})

export { router as webhookRouter }
