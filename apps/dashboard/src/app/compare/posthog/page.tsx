import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'MCPSpend vs. PostHog',
  description:
    'How MCPSpend differs from PostHog for tracking AI agent costs. PostHog is a product analytics platform with an LLM module; MCPSpend is purpose-built for MCP tool-call cost attribution.',
  alternates: { canonical: 'https://mcpspend.com/compare/posthog' },
}

const ROWS = [
  { dimension: 'Product category', mcpspend: 'AI cost observability (MCP-native)', other: 'Product analytics suite with an LLM observability module' },
  { dimension: 'Primary unit tracked', mcpspend: 'MCP tool call (server + tool + cost + latency)', other: 'User event / LLM call (manual instrumentation)' },
  { dimension: 'Install path', mcpspend: 'One CLI command — auto-detects Cursor, Claude Desktop, Windsurf, VS Code, Claude Code', other: 'Install posthog-js / posthog-python, add capture() calls in your code' },
  { dimension: 'MCP tool call attribution', mcpspend: 'Native — every call decoded automatically', other: 'Manual — you wrap every tool call yourself with $ai_generation events' },
  { dimension: 'Per-MCP-server breakdown', mcpspend: 'Built-in dashboard', other: 'Build with Insights + custom properties' },
  { dimension: 'Dollar budget + alerts', mcpspend: '$ budget at 50/80/100% via email + Slack out of the box', other: 'Set up via Alerts on cost insight (you compute the cost yourself first)' },
  { dimension: 'Works in closed IDEs (Cursor, Claude Desktop)', mcpspend: 'Yes — config-only wrap, no code change in the IDE needed', other: 'No — requires you to instrument the agent code yourself' },
  { dimension: 'Self-hosted core', mcpspend: 'Proxy + MCP server MIT on npm', other: 'PostHog itself is open source and self-hostable' },
  { dimension: 'Scope', mcpspend: 'AI agent cost only — focused, opinionated UI', other: 'Full analytics stack: events, funnels, session replay, feature flags, A/B tests, LLM module' },
  { dimension: 'Free tier', mcpspend: '25,000 tool calls / month forever', other: 'PostHog Cloud: 1M events + 5K AI generations / month free' },
  { dimension: 'Paid entry point', mcpspend: '$29 / month (Pro)', other: 'Usage-based after free tier (each module priced separately)' },
  { dimension: 'Setup time to first cost number', mcpspend: '< 60 seconds (one CLI command)', other: 'Hours to days (install SDK, wrap calls, build cost insight, configure alerts)' },
]

export default function PosthogComparePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold">
            <Image src="/logo.png" alt="MCPSpend" width={32} height={32} className="w-8 h-8 object-contain" />
            MCPSpend
          </Link>
          <nav className="flex items-center gap-5 text-sm text-gray-400">
            <Link href="/compare" className="hover:text-white">← All comparisons</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Compare · PostHog</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white">
          MCPSpend vs. PostHog
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          <strong>PostHog</strong> is a fantastic <strong>product-analytics suite</strong> — events,
          funnels, session replay, feature flags, A/B tests. They added an <em>LLM
          observability</em> module, but it still works the PostHog way: you write
          instrumentation code that calls{' '}
          <code className="text-xs bg-white/10 rounded px-1.5 py-0.5">posthog.capture(&apos;$ai_generation&apos;)</code>{' '}
          for every event you care about. <strong>MCPSpend</strong> is the opposite: zero
          code change, purpose-built for MCP tool calls, opinionated dashboards out of the
          box.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border border-white/5 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="text-left text-xs text-gray-400 px-4 py-3 font-semibold">Dimension</th>
                <th className="text-left text-xs text-brand-300 px-4 py-3 font-semibold">MCPSpend</th>
                <th className="text-left text-xs text-gray-300 px-4 py-3 font-semibold">PostHog</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="text-sm text-white px-4 py-3 font-medium">{r.dimension}</td>
                  <td className="text-sm text-gray-300 px-4 py-3">{r.mcpspend}</td>
                  <td className="text-sm text-gray-400 px-4 py-3">{r.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold">Choose MCPSpend if…</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>✓ Your agents live in Cursor, Claude Desktop, Windsurf, or VS Code — you can&apos;t change their code</li>
              <li>✓ You want a cost number in under a minute, no instrumentation</li>
              <li>✓ You need MCP-server-level attribution, not a generic event stream</li>
              <li>✓ You want dollar budgets + Slack alerts out of the box</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold">Choose PostHog if…</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>✓ You already use PostHog for product analytics and want one place for everything</li>
              <li>✓ You build your own agent app and control the source code</li>
              <li>✓ You need session replay, funnels, and feature flags alongside AI cost data</li>
              <li>✓ You&apos;re happy to write a few lines of instrumentation per event</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
          <p className="text-white font-semibold">They&apos;re complementary.</p>
          <p className="mt-2 text-sm text-gray-300">
            PostHog answers &quot;what are my users doing?&quot;. MCPSpend answers &quot;what
            are my AI agents costing me?&quot;. A lot of teams run both — PostHog for
            product, MCPSpend for AI cost attribution.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/register" className="bg-white text-gray-950 font-semibold px-5 py-2.5 rounded-lg hover:bg-gray-200">
              Try MCPSpend free
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
