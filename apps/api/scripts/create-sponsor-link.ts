/**
 * Creates a Stripe "Pay what you want" Payment Link for MCPSpend sponsorship.
 *
 * Run once locally:
 *   STRIPE_SECRET_KEY=sk_live_xxx npx tsx apps/api/scripts/create-sponsor-link.ts
 *
 * Output: a buy.stripe.com URL you paste into FUNDING.yml + README + footer.
 *
 * What it sets up:
 *   - A new Stripe Product "Support MCPSpend"
 *   - A Price configured as "customer chooses amount" with $1 minimum
 *   - A Payment Link with $5/$10/$25/$50 suggested presets
 *   - Custom thank-you message on the confirmation page
 *   - Billing address collection OFF (max conversion)
 */

import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY env var required')
  process.exit(1)
}

const stripe = new Stripe(key)

async function main() {
  const product = await stripe.products.create({
    name: 'Support MCPSpend',
    description:
      'Help keep MCPSpend free for small teams and indie developers. ' +
      'Every dollar goes back into hosting, security audits, and shipping new features.',
    statement_descriptor: 'MCPSPEND SUPPORT',
  })
  console.log('✓ Product created:', product.id)

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    custom_unit_amount: {
      enabled: true,
      minimum: 100, // $1.00 minimum
      preset: 1000, // $10.00 default
    },
  })
  console.log('✓ Price created:', price.id)

  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    after_completion: {
      type: 'hosted_confirmation',
      hosted_confirmation: {
        custom_message:
          'Thank you for supporting MCPSpend! Your contribution helps keep the free tier alive and the proxy open-source. — Andrei (NEW RZS SRL)',
      },
    },
    billing_address_collection: 'auto',
    allow_promotion_codes: false,
    metadata: {
      source: 'github_sponsors_funding_yml',
      purpose: 'voluntary_sponsorship',
    },
  })

  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Sponsor Payment Link created:')
  console.log('  ' + link.url)
  console.log('═══════════════════════════════════════════════════════')
  console.log('')
  console.log('Paste this URL back so Andrei can wire it into:')
  console.log('  - .github/FUNDING.yml (Sponsor button on repo)')
  console.log('  - README.md "Support the project" section')
  console.log('  - apps/dashboard/src/components/Footer.tsx')
}

main().catch((err) => {
  console.error('Stripe API error:', err.message)
  process.exit(1)
})
