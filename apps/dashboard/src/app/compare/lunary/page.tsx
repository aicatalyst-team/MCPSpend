import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'MCPSpend vs. Lunary',
  description:
    'How MCPSpend differs from Lunary for tracking AI agent costs. Lunary is an open-source LLM monitoring + prompt management tool; MCPSpend is purpose-built for MCP tool-call cost attribution.',
  alternates: { canonical: 'https://mcpspend.com/compare/lunary' },
}

const ROWS = [
  { dimension: 'Product category', mcpspend: 'AI cost observability (MCP-native)', other: 'Open-source LLM monitoring, prompt management, evals, user feedback' },
  { dimension: 'Primary unit tracked', mcpspend: 'MCP tool call (server + tool + cost + latency)', other: 'LLM completion (prompt → response, with optional user feedback)' },
  { dimension: 'Install path', mcpspend: 'One CLI command — auto-detects Cursor, Claude Desktop, Windsurf, VS Code, Claude Code', other: 'Install lunary SDK, wrap each LLM call with Lunary handlers' },
  { dimension: 'MCP tool call visibility', mcpspend: 'Native — every call decoded automatically', other: 'Manual — you instrument each tool invocation as a Lunary event' },
  { dimension: 'Works in closed IDEs (Cursor, Claude Desktop)', mcpspend: 'Yes — config-only wrap', other: 'No — requires SDK instrumentation inside the agent code' },
  { dimension: 'Prompt versioning & template management', mcpspend: 'Not in scope', other: 'Core feature' },
  { dimension: 'User feedback loops & evals', mcpspend: 'Not in scope', other: 'Core feature' },
  { dimension: 'Dollar budget + alerts', mcpspend: '$ budget at 50/80/100% via email + Slack out of the box', other: 'Cost tracking present; alerting depends on integration setup' },
  { dimension: 'Per-MCP-server cost breakdown', mcpspend: 'Built-in dashboard', other: 'Not modelled — build with metadata' },
  { dimension: 'Self-hosted core', mcpspend: 'Proxy + MCP server MIT on npm', other: 'Fully open-source, Docker-deployable' },
  { dimension: 'Free tier (managed)', mcpspend: '25,000 tool calls / month forever', other: '1,000 LLM events / month free (cloud)' },
  { dimension: 'Paid entry point', mcpspend: '$29 / month (Pro)', other: 'Self-host free; managed cloud from ~$20 / month' },
]

export default function LunaryComparePage() {
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
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Compare · Lunary</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white">
          MCPSpend vs. Lunary
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          <strong>Lunary</strong> is a solid <strong>open-source LLM monitoring + prompt
          management</strong> platform — strong on prompt versioning, user feedback loops,
          and offline evals. <strong>MCPSpend</strong> is something different: zero-code
          installation purpose-built for the <strong>MCP tool layer</strong>, with
          opinionated cost dashboards out of the box. Lunary requires SDK
          instrumentation in your agent code; MCPSpend works without touching it.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border border-white/5 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="text-left text-xs text-gray-400 px-4 py-3 font-semibold">Dimension</th>
                <th className="text-left text-xs text-brand-300 px-4 py-3 font-semibold">MCPSpend</th>
                <th className="text-left text-xs text-gray-300 px-4 py-3 font-semibold">Lunary</th>
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
              <li>✓ Your agents live in IDEs you don&apos;t control the source of</li>
              <li>✓ You want first-class MCP cost dashboards without writing SDK code</li>
              <li>✓ $ budget + Slack alerts are required day one</li>
              <li>✓ EU-hosted + GDPR Art. 15/17/20 self-serve matters</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold">Choose Lunary if…</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>✓ Prompt versioning + template management is a top use case</li>
              <li>✓ You want user-feedback loops tied to specific LLM completions</li>
              <li>✓ Offline evaluations / regression tests on prompts matter</li>
              <li>✓ You prefer a fully open-source, self-hostable stack</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
          <p className="text-white font-semibold">They&apos;re complementary.</p>
          <p className="mt-2 text-sm text-gray-300">
            Lunary handles prompts, evals, and user feedback. MCPSpend handles MCP tool
            cost attribution. Different layers, both useful.
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
