import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'MCPSpend vs. Langfuse',
  description: 'How MCPSpend differs from Langfuse for tracking AI agent costs. Langfuse needs SDK instrumentation; MCPSpend wraps via config.',
  alternates: { canonical: 'https://mcpspend.com/compare/langfuse' },
}

const ROWS = [
  { dimension: 'Primary unit tracked', mcpspend: 'MCP tool call', other: 'LLM trace + evaluation' },
  { dimension: 'Install path', mcpspend: 'One CLI command, no code change in MCP servers', other: 'Add Langfuse SDK calls inside every MCP server you maintain' },
  { dimension: 'Wraps closed-source MCP servers', mcpspend: 'Yes (Playwright, filesystem, GitHub, anything stdio or HTTP)', other: 'No — needs SDK access to the server code' },
  { dimension: 'Sees Cursor / Claude Desktop agents', mcpspend: 'Yes — config-only wrap', other: 'Only if those IDEs ship Langfuse instrumentation (they don\'t)' },
  { dimension: 'Prompt versioning & evals', mcpspend: 'Out of scope (we focus on cost & usage)', other: 'Built-in — strong at this' },
  { dimension: 'Cost attribution per MCP tool', mcpspend: 'First-class', other: 'Possible with custom metadata' },
  { dimension: 'Per-project budget alerts', mcpspend: '$ budget at 50/80/100% via email + Slack', other: 'Cost tracking yes; alerting via custom integration' },
  { dimension: 'Free tier', mcpspend: '25,000 tool calls / month forever', other: 'Generous free tier on self-hosted; cloud has its own limits' },
  { dimension: 'Paid entry point', mcpspend: '$29 / month (Pro)', other: 'Cloud from ~$29 / month' },
  { dimension: 'Open source core', mcpspend: 'Proxy + MCP server MIT', other: 'Server is MIT, self-hosting friendly' },
]

export default function LangfuseComparePage() {
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
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Compare · Langfuse</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white">
          MCPSpend vs. Langfuse
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          <strong>Langfuse</strong> is the dev-time observability platform for LLM apps — traces,
          prompt versioning, evaluations. Excellent if you build the app and can drop
          their SDK into your code. <strong>MCPSpend</strong> is for the runtime layer of the AI
          agent ecosystem: you don&apos;t own the agent (Cursor, Claude Desktop), you don&apos;t
          own the MCP server (Playwright, filesystem), but you still want to know what
          each tool call costs. That&apos;s what we do, via config-only wrapping.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border border-white/5 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="text-left text-xs text-gray-400 px-4 py-3 font-semibold">Dimension</th>
                <th className="text-left text-xs text-brand-300 px-4 py-3 font-semibold">MCPSpend</th>
                <th className="text-left text-xs text-gray-300 px-4 py-3 font-semibold">Langfuse</th>
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
              <li>✓ You use MCP servers you didn&apos;t write (Playwright, filesystem, github, etc.)</li>
              <li>✓ Your agents live in Cursor / Claude Desktop / Windsurf</li>
              <li>✓ You want zero-code install — config wrap only</li>
              <li>✓ Cost / usage is the core question, not trace replays</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold">Choose Langfuse if…</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>✓ You build your own AI app and own the code path end-to-end</li>
              <li>✓ Prompt versioning, A/B tests, and offline evals matter</li>
              <li>✓ You want full LLM trace visualisation</li>
              <li>✓ Self-hosting on your infra is a hard requirement</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
          <p className="text-white font-semibold">Different layers, often used together.</p>
          <p className="mt-2 text-sm text-gray-300">
            Langfuse on your app, MCPSpend on the MCP servers your app — or your IDE —
            calls. Full agent observability without overlap.
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
