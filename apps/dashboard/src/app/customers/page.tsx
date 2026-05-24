import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Customer stories — MCPSpend',
  description: 'How teams use MCPSpend to track and cut AI agent costs. Real numbers, real tools, real outcomes.',
  alternates: { canonical: 'https://mcpspend.com/customers' },
}

interface Story {
  slug: string
  company: string
  industry: string
  tagline: string
  headline: string
  outcome: { label: string; value: string; }[]
}

const STORIES: Story[] = [
  {
    slug: 'mcpspend-itself',
    company: 'MCPSpend',
    industry: 'AI dev tools · NEW RZS SRL · 🇷🇴 Bucharest',
    tagline: 'How we cut our own Claude + Cursor bill by 38% in 3 weeks using the tool we built.',
    headline: 'Yes, we run MCPSpend on MCPSpend.',
    outcome: [
      { label: 'Weekly spend before', value: '$14.20' },
      { label: 'Weekly spend after',  value: '$8.74' },
      { label: 'Savings',              value: '38%' },
      { label: 'Time to insight',      value: '< 60s' },
    ],
  },
]

export default function CustomersIndex() {
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
            <Link href="/customers" className="text-white">Customers</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Customer stories</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
          Real numbers from real teams.
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          No marketing fluff. Each story below ships with the actual weekly cost numbers, the tool calls that drove them, and the specific change the team made. Updated as new customers ship public stories — happy to feature yours, just email{' '}
          <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>.
        </p>

        <div className="mt-12 space-y-4">
          {STORIES.map((s) => (
            <Link
              key={s.slug}
              href={`/customers/${s.slug}`}
              className="block rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/20 transition-colors"
            >
              <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">{s.industry}</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">{s.company}</h2>
              <p className="mt-2 text-gray-300 text-sm">{s.tagline}</p>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                {s.outcome.map((o) => (
                  <div key={o.label} className="rounded-xl border border-white/5 bg-gray-950/40 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-gray-500">{o.label}</div>
                    <div className="mt-0.5 text-base font-semibold text-white tabular-nums">{o.value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-brand-400">Read the full story →</p>
            </Link>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
          <p className="text-white font-semibold">Run MCPSpend and want to be featured?</p>
          <p className="mt-2 text-sm text-gray-300">
            We&apos;ll write the story for you — share screenshots + a 10-min interview, and we publish with your team&apos;s approval before it goes live. Email{' '}
            <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
