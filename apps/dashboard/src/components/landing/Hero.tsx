import Link from 'next/link'
import { DashboardPreview } from './DashboardPreview'

const trustItems = [
  'Works with Claude, OpenAI, and any MCP-compatible client',
  '5-minute install, zero SDK changes',
  'EU-hosted infrastructure, encrypted at rest',
]

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-24">
      <div className="absolute inset-0 bg-radial-glow pointer-events-none" />
      <div className="absolute inset-0 grid-bg pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs font-medium text-gray-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Limited beta — first 100 teams free for 6 months
        </div>

        <h1 className="text-5xl md:text-7xl font-semibold tracking-tighter text-white leading-[1.05]">
          Know what every<br />
          <span className="bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 bg-clip-text text-transparent">
            MCP call costs you.
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
          MCPSpend sits between your AI agents and your MCP tools.
          Every call is logged, priced, and attributed in real time — so you see exactly which tools, teams, and customers are burning your budget,
          <span className="text-white"> before the invoice lands.</span>
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="bg-white text-gray-950 font-semibold px-7 py-3.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Start free — 50K calls/mo
          </Link>
          <a
            href="#how"
            className="bg-white/5 border border-white/10 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            See how it works
          </a>
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
          {trustItems.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-16 px-4 md:px-6">
        <DashboardPreview />
        <p className="mt-4 text-center text-xs text-gray-500">
          Preview of MCPSpend dashboard. Example data shown.
        </p>
      </div>
    </section>
  )
}
