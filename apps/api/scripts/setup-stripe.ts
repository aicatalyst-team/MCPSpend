/**
 * One-off setup script: creates MCPSpend products + prices in your Stripe account.
 * Each product is tagged with metadata { project: 'mcpspend' } so the same Stripe account
 * can be shared with other businesses without confusion.
 *
 * Run inside the API container:
 *   docker exec -it <api-container> npx tsx scripts/setup-stripe.ts
 *
 * Outputs the price IDs to paste into Coolify env vars:
 *   STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM, STRIPE_PRICE_ENT
 *
 * Idempotent: re-running it skips products that already exist (matched by metadata.plan).
 */

import Stripe from 'stripe'

const STATEMENT_DESCRIPTOR = 'NEWRZS MCPSPEND' // max 22 chars, shows on customer bank statements

interface PlanDef {
  plan: 'PRO' | 'TEAM' | 'ENTERPRISE'
  name: string
  description: string
  monthlyUsd: number
  callsLimit: number
}

const PLANS: PlanDef[] = [
  {
    plan: 'PRO',
    name: 'MCPSpend Pro',
    description: '1M MCP tool calls per month. Real-time dashboard, budget alerts, CSV/S3 export, email support.',
    monthlyUsd: 29,
    callsLimit: 1_000_000,
  },
  {
    plan: 'TEAM',
    name: 'MCPSpend Team',
    description: '10M MCP tool calls per month. Per-team and per-customer attribution, 90-day retention, SAML SSO, priority support.',
    monthlyUsd: 99,
    callsLimit: 10_000_000,
  },
  {
    plan: 'ENTERPRISE',
    name: 'MCPSpend Enterprise',
    description: 'Unlimited calls. DPA, dedicated single-tenant infrastructure, custom SLA, unlimited audit retention.',
    monthlyUsd: 499,
    callsLimit: 999_999_999,
  },
]

async function main() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    console.error('STRIPE_SECRET_KEY not set')
    process.exit(1)
  }
  const stripe = new Stripe(key)

  console.log(`\nSetting up MCPSpend products in Stripe (${key.startsWith('sk_live_') ? 'LIVE' : 'TEST'} mode)\n`)

  const results: Record<string, string> = {}

  for (const plan of PLANS) {
    // Find existing product (by metadata.plan)
    let product: Stripe.Product | undefined
    for await (const p of stripe.products.list({ active: true, limit: 100 })) {
      if (p.metadata?.project === 'mcpspend' && p.metadata?.plan === plan.plan) {
        product = p
        break
      }
    }

    if (!product) {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        statement_descriptor: STATEMENT_DESCRIPTOR,
        metadata: { project: 'mcpspend', plan: plan.plan, calls_limit: String(plan.callsLimit) },
      })
      console.log(`✓ Created product ${plan.name} (${product.id})`)
    } else {
      console.log(`= Product ${plan.name} already exists (${product.id})`)
    }

    // Find or create monthly price
    let price: Stripe.Price | undefined
    for await (const pr of stripe.prices.list({ product: product.id, active: true, limit: 100 })) {
      if (
        pr.unit_amount === plan.monthlyUsd * 100 &&
        pr.recurring?.interval === 'month' &&
        pr.currency === 'usd'
      ) {
        price = pr
        break
      }
    }

    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: plan.monthlyUsd * 100,
        recurring: { interval: 'month' },
        metadata: { project: 'mcpspend', plan: plan.plan },
      })
      console.log(`  ✓ Created monthly price $${plan.monthlyUsd} (${price.id})`)
    } else {
      console.log(`  = Monthly price $${plan.monthlyUsd} already exists (${price.id})`)
    }

    results[plan.plan] = price.id
  }

  console.log(`\n✅ Done. Add these to Coolify env vars for the API app:\n`)
  console.log(`  STRIPE_PRICE_PRO=${results.PRO}`)
  console.log(`  STRIPE_PRICE_TEAM=${results.TEAM}`)
  console.log(`  STRIPE_PRICE_ENT=${results.ENTERPRISE}`)
  console.log()
  console.log(`Next: configure the webhook endpoint in Stripe Dashboard:`)
  console.log(`  URL:    https://api.mcpspend.com/api/webhooks/stripe`)
  console.log(`  Events: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted`)
  console.log(`Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET in Coolify.\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
