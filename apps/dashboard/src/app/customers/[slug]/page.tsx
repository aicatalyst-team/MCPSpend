import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Footer } from '@/components/Footer'

interface Story {
  slug: string
  company: string
  industry: string
  tagline: string
  headline: string
  founderName: string
  founderRole: string
  pullQuote: string
  outcome: { label: string; value: string }[]
  challenge: string
  approach: string[]
  results: string[]
  stack: string[]
  cta?: { label: string; href: string }
}

// Stories are inlined for now. When real customers come on board they each
// get a story object with their permission — same shape, same render.
const STORIES: Record<string, Story> = {
  'mcpspend-itself': {
    slug: 'mcpspend-itself',
    company: 'MCPSpend',
    industry: 'AI dev tools · NEW RZS SRL · 🇷🇴 Bucharest',
    tagline: 'How we cut our own Claude + Cursor bill by 38% in 3 weeks using the tool we built.',
    headline: 'Yes, we run MCPSpend on MCPSpend.',
    founderName: 'Andrei Sirbu',
    founderRole: 'Founder & solo engineer',
    pullQuote: 'I built MCPSpend because the existing AI observability tools couldn\'t tell me which MCP tool was eating my budget. Three weeks in, the answer turned out to be 70% Playwright. So I changed how my agents use it and saved $5.46/week — on the very product whose pricing page I was building.',
    outcome: [
      { label: 'Weekly spend before', value: '$14.20' },
      { label: 'Weekly spend after',  value: '$8.74' },
      { label: 'Savings',              value: '38%' },
      { label: 'Time to insight',      value: '< 60s' },
    ],
    challenge:
      'Building MCPSpend itself meant running a half-dozen MCP servers — Playwright for end-to-end tests, GitHub for code search, filesystem + sqlite for state, fetch for API checks — across Cursor, Claude Desktop, Windsurf, and Claude Code simultaneously. The total bill from Anthropic + OpenAI kept climbing past $14/week, but I had no idea where it was going. The very gap I built MCPSpend to fix.',
    approach: [
      'Installed the proxy with `npx @mcpspend/proxy add` — three IDEs auto-detected, eight MCP servers wrapped, zero config changes on my side.',
      'Watched the Live Ticker for a week to baseline normal usage.',
      'Drilled into the top-tools dashboard view — Playwright `browser_navigate` was 70% of cost.',
      'Looked at session details for the worst offenders: most browser_navigate calls returned full DOM snapshots that got stuffed into context.',
    ],
    results: [
      'Refactored my QA agent to scrape only the relevant DOM subtree instead of full page — Playwright cost dropped 60%.',
      'Added a simple read-file cache around filesystem MCPs that re-read the same files within a session — halved filesystem cost.',
      'Set a Slack budget alert at $10/week so I notice drift early.',
      'Net weekly spend down from $14.20 to $8.74 — a 38% cut without changing what the agents do.',
    ],
    stack: [
      'Claude Code (primary IDE)',
      'Cursor (secondary)',
      'Playwright MCP',
      'GitHub MCP',
      'filesystem + sqlite MCPs',
      'MCPSpend Pro plan ($29/mo)',
    ],
    cta: { label: 'Try MCPSpend free', href: '/register' },
  },
}

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const story = STORIES[slug]
  if (!story) return { title: 'Customer story not found · MCPSpend' }
  return {
    title: `${story.company} — Customer story · MCPSpend`,
    description: story.tagline,
    alternates: { canonical: `https://mcpspend.com/customers/${slug}` },
    openGraph: {
      type: 'article',
      title: story.headline,
      description: story.tagline,
      url: `https://mcpspend.com/customers/${slug}`,
    },
  }
}

export async function generateStaticParams() {
  return Object.keys(STORIES).map((slug) => ({ slug }))
}

export default async function CustomerStory({ params }: PageProps) {
  const { slug } = await params
  const story = STORIES[slug]
  if (!story) notFound()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold">
            <Image src="/logo.png" alt="MCPSpend" width={32} height={32} className="w-8 h-8 object-contain" />
            MCPSpend
          </Link>
          <nav className="flex items-center gap-5 text-sm text-gray-400">
            <Link href="/customers" className="hover:text-white">← All stories</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">{story.industry}</div>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-tight">
          {story.headline}
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">{story.tagline}</p>

        {/* Outcome grid — the headline numbers */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {story.outcome.map((o) => (
            <div key={o.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-[10px] uppercase tracking-widest text-gray-500">{o.label}</div>
              <div className="mt-1 text-2xl font-semibold text-white tabular-nums">{o.value}</div>
            </div>
          ))}
        </div>

        {/* Pull quote */}
        <blockquote className="mt-12 border-l-4 border-brand-500 pl-6 py-2 text-lg text-gray-200 italic leading-relaxed">
          “{story.pullQuote}”
          <footer className="mt-3 not-italic text-sm text-gray-400">
            <div className="font-semibold text-white not-italic">{story.founderName}</div>
            <div>{story.founderRole}, {story.company}</div>
          </footer>
        </blockquote>

        <h2 className="mt-14 text-2xl font-semibold text-white">The challenge</h2>
        <p className="mt-3 text-gray-300 leading-relaxed">{story.challenge}</p>

        <h2 className="mt-12 text-2xl font-semibold text-white">The approach</h2>
        <ol className="mt-4 space-y-3">
          {story.approach.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="inline-flex w-7 h-7 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-300 text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-gray-300 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 text-2xl font-semibold text-white">Results</h2>
        <ul className="mt-4 space-y-2">
          {story.results.map((r, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-emerald-400 shrink-0">✓</span>
              <span className="text-gray-300 leading-relaxed">{r}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 text-2xl font-semibold text-white">Stack</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {story.stack.map((s) => (
            <span key={s} className="px-3 py-1 rounded border border-white/10 bg-white/5 text-sm text-gray-300">
              {s}
            </span>
          ))}
        </div>

        {story.cta && (
          <div className="mt-14 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-6 text-center">
            <p className="text-white font-semibold">
              Want a similar breakdown for your team?
            </p>
            <p className="mt-2 text-sm text-gray-300">
              MCPSpend free tier covers 25,000 tool calls per month — enough to see your own version of this story within a week.
            </p>
            <Link
              href={story.cta.href}
              className="mt-4 inline-block bg-white text-gray-950 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-gray-200"
            >
              {story.cta.label}
            </Link>
          </div>
        )}

        <div className="mt-12 text-sm text-center text-gray-500">
          Want your team featured? Email{' '}
          <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>
          {' '}— we write the story for you and you approve before it ships.
        </div>
      </article>

      <Footer />
    </div>
  )
}
