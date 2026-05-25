import type { Metadata } from 'next'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { CalculatorClient } from './CalculatorClient'

export const metadata: Metadata = {
  title: 'MCP Cost Calculator — Estimate Your Anthropic / OpenAI Bill',
  description:
    'Free calculator that estimates monthly MCP tool-call cost across Claude, GPT-4, Gemini and other models. Real pricing, real per-server token averages, no signup.',
  alternates: { canonical: 'https://mcpspend.com/calculator' },
  openGraph: {
    title: 'MCP Cost Calculator',
    description:
      'Estimate your monthly Anthropic / OpenAI bill from MCP tool calls. Free, no signup.',
    url: 'https://mcpspend.com/calculator',
    type: 'website',
  },
}

export default function CalculatorPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            MCP Cost Calculator
          </h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Estimate your monthly bill from MCP tool calls — by server, by model, with{' '}
            <a
              href="/api/public/pricing-models"
              className="text-brand-400 hover:underline"
              target="_blank"
              rel="noopener"
            >
              real provider pricing
            </a>
            . No signup. No email.
          </p>
        </header>

        <CalculatorClient />

        <section className="mt-16 grid md:grid-cols-2 gap-6 text-sm text-gray-400">
          <div className="rounded-2xl border border-white/5 bg-gray-900 p-6">
            <h2 className="text-white font-semibold mb-2">Where do the numbers come from?</h2>
            <p>
              Per-server averages (input / output tokens per call) are computed from anonymized,
              aggregated MCPSpend telemetry across hundreds of real users. Model pricing is the
              public list price from each provider, refreshed monthly.
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-gray-900 p-6">
            <h2 className="text-white font-semibold mb-2">Want exact numbers, not estimates?</h2>
            <p>
              Install the proxy and you&apos;ll see your own per-call cost within 30 seconds —
              free 25K calls/month, no card required.{' '}
              <a href="/register" className="text-brand-400 hover:underline">
                Start free →
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
