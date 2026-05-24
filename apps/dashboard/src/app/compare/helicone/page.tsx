import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'MCPSpend vs. Helicone',
  description: 'How MCPSpend differs from Helicone for tracking AI agent costs. Helicone tracks LLM API calls; MCPSpend tracks MCP tool calls.',
  alternates: { canonical: 'https://mcpspend.com/compare/helicone' },
}

const ROWS = [
  { dimension: 'Primary unit tracked', mcpspend: 'MCP tool call (server + tool + cost + latency)', other: 'LLM chat completion (provider + model + tokens)' },
  { dimension: 'Install path', mcpspend: 'One CLI command — auto-detects Claude Desktop, Cursor, Windsurf, VS Code, Claude Code', other: 'Replace OpenAI / Anthropic SDK with Helicone-wrapped SDK (or change BASE_URL)' },
  { dimension: 'Tool call visibility', mcpspend: 'Every tool call: server name, tool name, latency, success/error, payload size', other: 'Only as part of the model trace; no native tool concept' },
  { dimension: 'Per-MCP-server cost breakdown', mcpspend: 'Yes, built-in', other: 'Build manually with custom properties' },
  { dimension: 'Per-project / per-customer attribution', mcpspend: 'Built-in (projects + per-org)', other: 'Yes, via custom properties' },
  { dimension: 'Dollar budget + alerts', mcpspend: '$ budget at 50/80/100% via email + Slack', other: 'Cost tracking yes; configurable $ thresholds depend on plan' },
  { dimension: 'Self-hosted core', mcpspend: 'Proxy + MCP server MIT on npm', other: 'Self-host edition available' },
  { dimension: 'Free tier', mcpspend: '25,000 tool calls / month forever', other: '10,000 requests / month free' },
  { dimension: 'Paid entry point', mcpspend: '$29 / month (Pro)', other: 'From ~$20 / month' },
  { dimension: 'Sees agent activity in closed IDEs (Cursor, Claude Desktop)', mcpspend: 'Yes — config-only wrap, no code change needed', other: 'No — requires the IDE to call your wrapped SDK; closed IDEs are out of reach' },
]

export default function HeliconeComparePage() {
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
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Compare · Helicone</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white">
          MCPSpend vs. Helicone
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          Both tools answer the question &quot;what is my AI costing me?&quot; — at different
          layers. <strong>Helicone</strong> is a fantastic <strong>LLM-layer observability</strong> platform — it
          sees every OpenAI / Anthropic / Replicate API call by wrapping the SDK.
          <strong> MCPSpend</strong> is the layer below — it sees every <strong>MCP tool call</strong> made by
          an agent <em>during</em> those LLM calls, including agents running inside closed
          IDEs (Cursor, Claude Desktop) where you cannot replace the SDK.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border border-white/5 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="text-left text-xs text-gray-400 px-4 py-3 font-semibold">Dimension</th>
                <th className="text-left text-xs text-brand-300 px-4 py-3 font-semibold">MCPSpend</th>
                <th className="text-left text-xs text-gray-300 px-4 py-3 font-semibold">Helicone</th>
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
              <li>✓ You care about which MCP server / which tool is driving the spend</li>
              <li>✓ You want install-without-code-change</li>
              <li>✓ You need per-project attribution and budget alerts</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold">Choose Helicone if…</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>✓ You build your own LLM application with the OpenAI / Anthropic SDK</li>
              <li>✓ You don&apos;t use MCP servers — your agent calls the model directly</li>
              <li>✓ You can change the SDK or BASE_URL in your code</li>
              <li>✓ Token-level prompt and response logging is critical</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
          <p className="text-white font-semibold">They&apos;re complementary.</p>
          <p className="mt-2 text-sm text-gray-300">
            A lot of teams run both — Helicone on the LLM side, MCPSpend on the MCP side.
            Together they give you full top-to-bottom cost visibility.
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
