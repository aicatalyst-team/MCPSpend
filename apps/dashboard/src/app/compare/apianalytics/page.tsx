import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'MCPSpend vs. APIAnalytics',
  description:
    'How MCPSpend differs from generic API analytics tools. APIAnalytics counts HTTP requests; MCPSpend decodes MCP tool calls and attributes cost per server, project, and tool.',
  alternates: { canonical: 'https://mcpspend.com/compare/apianalytics' },
}

const ROWS = [
  { dimension: 'Product category', mcpspend: 'AI cost observability (MCP-native)', other: 'General-purpose API analytics — request count, latency, status codes' },
  { dimension: 'Primary unit tracked', mcpspend: 'MCP tool call (server + tool + cost + latency)', other: 'HTTP request' },
  { dimension: 'Install path', mcpspend: 'One CLI command — auto-detects Cursor, Claude Desktop, Windsurf, VS Code, Claude Code', other: 'Add middleware / proxy in front of your service; add API key header' },
  { dimension: 'Understanding of MCP protocol', mcpspend: 'Native — decodes initialize, tools/list, tools/call, server/tool names', other: 'None — sees opaque HTTP payloads' },
  { dimension: 'Per-MCP-tool cost attribution', mcpspend: 'Built-in', other: 'Not possible — no model concept' },
  { dimension: 'Per-project / per-customer breakdown', mcpspend: 'Built-in (projects + per-org)', other: 'Manual — relies on custom request headers' },
  { dimension: 'Dollar budget + alerts', mcpspend: '$ budget at 50/80/100% via email + Slack', other: 'No cost model; budgets are request-count thresholds' },
  { dimension: 'Works in closed IDEs (Cursor, Claude Desktop)', mcpspend: 'Yes — config-only wrap', other: 'Only if you can put a proxy in front of MCP traffic, which IDEs do not allow' },
  { dimension: 'Scope', mcpspend: 'AI agent cost only — opinionated UI', other: 'Any HTTP API — generic dashboards' },
  { dimension: 'Free tier', mcpspend: '25,000 tool calls / month forever', other: 'Free for low request volume; capped after that' },
]

export default function ApiAnalyticsComparePage() {
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
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Compare · APIAnalytics</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white">
          MCPSpend vs. APIAnalytics
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          <strong>APIAnalytics</strong> (and similar generic API monitoring tools) count
          HTTP requests — volume, latency, status codes — for any service.
          <strong> MCPSpend</strong> is specialised: it understands the MCP protocol,
          decodes <code className="text-xs bg-white/10 rounded px-1.5 py-0.5">tools/call</code> messages,
          and attributes a dollar cost to each tool, server, and project. A generic
          request-counter cannot do this without you building the entire model
          manually.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border border-white/5 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-white/[0.04]">
                <th className="text-left text-xs text-gray-400 px-4 py-3 font-semibold">Dimension</th>
                <th className="text-left text-xs text-brand-300 px-4 py-3 font-semibold">MCPSpend</th>
                <th className="text-left text-xs text-gray-300 px-4 py-3 font-semibold">APIAnalytics</th>
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
              <li>✓ You want dollar cost attribution, not just request counts</li>
              <li>✓ You need MCP-server-level breakdown out of the box</li>
              <li>✓ Your agents live in IDEs you can&apos;t proxy</li>
              <li>✓ You need budget alerts denominated in $, not in request count</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-white font-semibold">Choose APIAnalytics if…</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              <li>✓ You monitor a fleet of unrelated HTTP services, not just MCP</li>
              <li>✓ Request count + latency + status codes is enough for your use case</li>
              <li>✓ You can put a proxy in front of every request</li>
              <li>✓ Cost-per-call is not something you need to know</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
          <p className="text-white font-semibold">Different jobs.</p>
          <p className="mt-2 text-sm text-gray-300">
            Use a generic API tool for generic API metrics. Use MCPSpend when you need
            to know what an AI tool call actually costs.
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
