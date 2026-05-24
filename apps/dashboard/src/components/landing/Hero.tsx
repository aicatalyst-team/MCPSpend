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
          Free tier · 25,000 tool calls/month, forever
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tighter text-white leading-[1.05]">
          Know what every<br />
          <span className="bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 bg-clip-text text-transparent">
            MCP call costs you.
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
          A transparent proxy that wraps your MCP servers and records every tool call: latency, errors, payload size, and per-model cost estimation.
          <span className="text-white"> Find which tools, teams, and customers are burning your AI budget — before the invoice lands.</span>
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="bg-white text-gray-950 font-semibold px-7 py-3.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Start free — 25K calls/mo
          </Link>
          <a
            href="#how"
            className="bg-white/5 border border-white/10 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            See how it works
          </a>
        </div>

        {/* Trust cluster — Product Hunt + Smithery side by side. Both registries
            give third-party validation: PH for product-launch credibility,
            Smithery for "we're listed in the official MCP catalog". */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="https://www.producthunt.com/products/mcpspend?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-mcpspend"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1154250&theme=dark"
              alt="MCPSpend - Know what your AI agents really cost | Product Hunt"
              width={250}
              height={54}
            />
          </a>

          {/* "Live on Smithery" — a Product-Hunt-equivalent badge that signals
              we are listed in the official MCP server catalog. Hand-rolled
              instead of using the auto-generated Smithery SVG so it visually
              matches the PH badge size (250×54) and the dark theme. */}
          <a
            href="https://smithery.ai/servers/andreisirbu91-lab/mcpspend"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 h-[54px] px-5 rounded-lg bg-[#FF5C00] hover:bg-[#FF7A2A] transition-colors"
            style={{ width: 250 }}
            aria-label="MCPSpend on Smithery registry"
          >
            <span className="inline-flex w-9 h-9 items-center justify-center rounded bg-white/15 text-white text-xl font-bold leading-none">
              ▦
            </span>
            <span className="flex flex-col text-left text-white leading-tight">
              <span className="text-[10px] uppercase tracking-widest opacity-80">
                LIVE ON
              </span>
              <span className="text-base font-bold">
                Smithery Registry
              </span>
            </span>
          </a>
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-400">
          {trustItems.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> {t}
            </li>
          ))}
        </ul>

        {/* Trust strip — addresses SEETO AI's "Trust Signals 45/100" review.
            Real-time badges from the registries we actually publish on.
            Linked so visitors can verify the numbers themselves. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs">
          <a href="https://www.npmjs.com/package/@mcpspend/proxy" target="_blank" rel="noopener noreferrer" aria-label="npm package">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://img.shields.io/npm/v/@mcpspend/proxy.svg?label=npm&color=cb3837&cacheSeconds=300" alt="npm version" height={20} />
          </a>
          <a href="https://www.npmjs.com/package/@mcpspend/proxy" target="_blank" rel="noopener noreferrer" aria-label="npm downloads">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://img.shields.io/npm/dm/@mcpspend/proxy.svg?label=downloads&color=blue&cacheSeconds=300" alt="npm downloads" height={20} />
          </a>
          <a href="https://github.com/andreisirbu91-lab/MCPSpend" target="_blank" rel="noopener noreferrer" aria-label="GitHub repo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://img.shields.io/github/stars/andreisirbu91-lab/MCPSpend?style=flat&logo=github&color=181717&cacheSeconds=300" alt="GitHub stars" height={20} />
          </a>
          <a href="https://smithery.ai/servers/andreisirbu91-lab/mcpspend" target="_blank" rel="noopener noreferrer" aria-label="Smithery server">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://smithery.ai/badge/andreisirbu91-lab/mcpspend" alt="Smithery" height={20} />
          </a>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-gray-400 bg-white/5 border border-white/10 font-medium">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"/></svg>
            Stripe-secured
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-gray-400 bg-white/5 border border-white/10 font-medium">
            MIT licensed
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-gray-400 bg-white/5 border border-white/10 font-medium">
            🇪🇺 EU-hosted
          </span>
        </div>
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
