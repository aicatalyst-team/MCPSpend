import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'
import { getPublishedPosts } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Blog — MCPSpend',
  description:
    'Notes on building MCPSpend, the Model Context Protocol economy, AI agent cost teardowns, and observability deep-dives.',
  alternates: { canonical: 'https://mcpspend.com/blog' },
  openGraph: {
    title: 'MCPSpend Blog',
    description: 'Engineering and product notes from building MCPSpend.',
    url: 'https://mcpspend.com/blog',
    type: 'website',
  },
}

// Always render on the server. Cache for an hour so a new post merged to main
// shows up within ~60 min even without a redeploy. Triggered redeploys
// invalidate this immediately.
export const revalidate = 3600

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export default function BlogIndex() {
  const posts = getPublishedPosts()

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
            <Link href="/compare" className="hover:text-white">Compare</Link>
            <Link href="/blog" className="text-white">Blog</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Blog</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
          Notes from building MCPSpend.
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          Engineering decisions, cost teardowns, MCP-ecosystem analysis, and the
          occasional founder essay. New posts most weeks.{' '}
          <a href="/blog/rss.xml" className="text-brand-400 hover:underline">RSS feed</a>.
        </p>

        {posts.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center text-gray-500">
            No posts published yet — first one ships shortly.
          </div>
        ) : (
          <div className="mt-12 space-y-4">
            {posts.map((p) => {
              const tags = p.frontmatter.tags ?? []
              return (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <time dateTime={p.frontmatter.publishedAt}>
                      {formatDate(p.frontmatter.publishedAt)}
                    </time>
                    <span>·</span>
                    <span>{p.frontmatter.readingMinutes} min read</span>
                    {tags.length > 0 && (
                      <>
                        <span>·</span>
                        <div className="flex gap-1.5 flex-wrap">
                          {tags.slice(0, 3).map((t) => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{t}</span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-white leading-tight">
                    {p.frontmatter.title}
                  </h2>
                  <p className="mt-2 text-gray-400 text-sm leading-relaxed">
                    {p.frontmatter.excerpt}
                  </p>
                  <p className="mt-3 text-sm text-brand-400">Read post →</p>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-16 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6">
          <p className="text-white font-semibold">Subscribe to the RSS feed.</p>
          <p className="text-sm text-gray-400 mt-1">
            New posts every Wednesday. No newsletter, no popup — just plain RSS at{' '}
            <a href="/blog/rss.xml" className="text-brand-400 hover:underline">/blog/rss.xml</a>.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
