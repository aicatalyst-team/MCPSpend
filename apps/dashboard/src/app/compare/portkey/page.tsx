import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'MCPSpend vs. Portkey',
  description:
    'How MCPSpend differs from Portkey for tracking AI agent costs. Portkey is an AI gateway in front of LLM providers; MCPSpend is purpose-built for MCP tool-call cost attribution.',
  alternates: { canonical: 'https://mcpspend.com/compare/portkey' },
}

const ROWS = [
  { dimension: 'Product category', mcpspend: 'AI cost observability (MCP-native)', other: 'AI gateway: smart routing, caching, fallback, guardrails in front of LLM providers' },
  { dimension: 'Primary unit tracked', mcpspend: 'MCP tool call (server + tool + cost + latency)', other: 'LLM request through the gateway' },
  { dimension: 'Install path', mcpspend: 'One CLI command — auto-detects Cursor, Claude Desktop, Windsurf, VS Code, Claude Code', other: 'Change SDK BASE_URL to Portkey gateway, add API key header — code change required' },
  { dimension: 'MCP tool call visibility', mcpspend: 'Native — every tool call decoded automatically', other: 'Not native — your code has to send the events; tools that bypass the gateway are invisible' },
  { dimension: 'Per-MCP-server cost breakdown', mcpspend: 'Built-in', other: 'Not modelled — you build it with custom metadata' },
  { dimension: 'Works in closed IDEs (Cursor, Claude Desktop)', mcpspend: 'Yes — config-only wrap, no code change', other: 'No — you cannot intercept the SDK call inside the IDE' },
  { dimension: 'Dollar budget + alerts', mcpspend: '$ budget at 50/80/100% via email + Slack', other: 'Budget alerts on LLM spend, configurable per workspace' },
  { dimension: 'Caching / routing / fallback between models', mcpspend: 'Not in scope', other: 'Core feature — semantic caching, retry policies, model fallback' },
  { dimension: 'Self-hosted core', mcpspend: 'Proxy + MCP server MIT on npm', other: 'Open-source gateway available; managed cloud is the default' },
  { dimension: 'Free tier', mcpspend: '25,000 tool calls / month forever', other: 'Free tier with capped requests, then usage-based' },
  { dimension: 'Paid entry point', mcpspend: '$29 / month (Pro)', other: 'Usage-based after free tier' },
]

export default function PortkeyComparePage() {
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
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Compare · Portkey</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white">
          MCPSpend vs. Portkey
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          <strong>Portkey</strong> is an excellent <strong>AI gateway</strong> — it sits in
          front of OpenAI / Anthropic / 200+ providers and adds smart caching, retry,
          model fallback, and guardrails. It tracks every LLM request that flows
          through it. <strong>MCPSpend</strong> operates at a different layer: it sees
          every <strong>MCP tool call</strong> your agent makes — including agents in
          closed IDEs (Cursor, Claude Desktop) where you can&apos;t route SDK traffic
          through a gateway.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border border-white/5 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="text-left text-xs text-gray-400 px-4 py-3 font-semibold">Dimension</th>
                <th className="text-left text-xs text-brand-300 px-4 py-3 font-semibold">MCPSpend</th>
                <th className="text-left text-xs text-gray-300 px-4 py-3 font-semibold">Portkey</th>
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
              <li>✓ Your agents live in Cursor, Claude Desktop, Windsurf, or VS Code</li>
              <li>✓ You want MCP-server-level cost attribution out of the box</li>
              <li>✓ You don&apos;t want to introduce a gateway between your code and OpenAI</li>
              <li>✓ Per-project budget alerts are a must-have</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold">Choose Portkey if…</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>✓ You want semantic caching, retry policies, or automatic model fallback</li>
              <li>✓ You build your own LLM app and control the SDK calls</li>
              <li>✓ You need a unified gateway across 200+ LLM providers</li>
              <li>✓ Guardrails / PII filtering at the gateway layer matters to you</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
          <p className="text-white font-semibold">They&apos;re complementary.</p>
          <p className="mt-2 text-sm text-gray-300">
            Portkey is great for the LLM-request layer. MCPSpend covers the MCP tool
            layer underneath. Teams that run both get a complete picture of where
            their AI dollars go.
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
