import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'MCPSpend vs. Helicone, Langfuse, PostHog & more',
  description: 'How MCPSpend compares to LLM observability tools (Helicone, Langfuse) and product analytics (PostHog) for tracking MCP tool-call cost.',
  alternates: { canonical: 'https://mcpspend.com/compare' },
}

const ALTERNATIVES = [
  {
    slug: 'helicone',
    name: 'Helicone',
    tag: 'LLM observability',
    summary: 'Helicone is great at tracking the chat-completion layer (input/output tokens per OpenAI/Anthropic call). It does not see MCP tool calls — agents that wrap a single chat turn around 50 tool invocations look identical to a single chat turn.',
    when: 'You want pure LLM-layer cost: tokens in/out per provider model.',
  },
  {
    slug: 'langfuse',
    name: 'Langfuse',
    tag: 'LLM tracing & evals',
    summary: 'Langfuse traces LLM calls, prompt versions, and offline evaluations. Strong on dev-time observability. To capture MCP tool calls you have to instrument every server yourself with their SDK.',
    when: 'You want full traces + evals + are willing to add SDK calls inside every MCP server you maintain.',
  },
  {
    slug: 'posthog',
    name: 'PostHog',
    tag: 'Product analytics',
    summary: 'PostHog is a powerful general analytics platform. It can model anything if you push the right events — including MCP tool calls — but it has no built-in concept of "tool / server / cost", so you build the whole schema yourself.',
    when: 'You already run PostHog and want one less vendor — accepting that you\'ll wire the cost model by hand.',
  },
  {
    slug: 'portkey',
    name: 'Portkey',
    tag: 'AI gateway',
    summary: 'Portkey is an AI gateway that sits in front of LLM providers — caching, routing, fallback, guardrails. It tracks cost at the LLM-request level. MCP tool calls only show up if you have already wired Portkey into your stack and instrumented every call.',
    when: 'You want a smart routing/caching layer between your code and OpenAI/Anthropic — accepting that MCP tool attribution is on you.',
  },
  {
    slug: 'lunary',
    name: 'Lunary',
    tag: 'Open-source LLM analytics',
    summary: 'Lunary is an open-source LLM monitoring + prompt management tool. Strong on user-feedback loops, prompt versioning, and evals. To see MCP tool calls you have to instrument each server with their SDK — out of the box it tracks LLM completions, not MCP tools.',
    when: 'You want a self-hostable observability stack focused on LLM prompts + evals + user feedback.',
  },
  {
    slug: 'apianalytics',
    name: 'APIAnalytics',
    tag: 'Generic API analytics',
    summary: 'APIAnalytics is a general-purpose API monitoring tool — request volume, latency, status codes. It can technically count MCP requests if you put it in front of your transport, but it has no model, no cost concept, and no awareness of the MCP tool layer.',
    when: 'You want bare-metal HTTP/API metrics for any service — including but not limited to MCP.',
  },
]

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold">
            <Image src="/logo.png" alt="MCPSpend" width={32} height={32} className="w-8 h-8 object-contain" />
            MCPSpend
          </Link>
          <nav className="flex items-center gap-5 text-sm text-gray-400">
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/security" className="hover:text-white">Security</Link>
            <Link href="/compare" className="text-white">Compare</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Compare</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
          How MCPSpend stacks up against<br />the closest alternatives.
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          Honest comparison — each tool below is great at what it&apos;s built for.
          MCPSpend is the one that natively understands the <strong>MCP tool call</strong> as
          the unit of work. If you primarily care about LLM-layer tokens or general
          product analytics, you may be better served elsewhere — links below.
        </p>

        <div className="mt-12 space-y-4">
          {ALTERNATIVES.map((alt) => (
            <Link
              key={alt.slug}
              href={`/compare/${alt.slug}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-xl font-semibold text-white">MCPSpend vs. {alt.name}</h3>
                  <p className="text-xs text-brand-400 mt-1">{alt.tag}</p>
                </div>
                <span className="text-gray-500 text-sm">Read comparison →</span>
              </div>
              <p className="mt-3 text-sm text-gray-400 leading-relaxed">{alt.summary}</p>
              <p className="mt-2 text-xs text-gray-500"><strong>Use {alt.name} when:</strong> {alt.when}</p>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  )
}
