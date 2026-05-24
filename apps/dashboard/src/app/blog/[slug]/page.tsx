import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Footer } from '@/components/Footer'
import { getAllPosts, getPostBySlug, getRelatedPosts } from '@/lib/blog'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Pre-render every published post at build time (Next.js 15 generateStaticParams
// runs at build). Drafts and future-dated posts ALSO get pre-rendered so we
// don't 404 the moment a scheduled date lands — but they're 404'd by date
// inside the page handler.
export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return { title: 'Post not found · MCPSpend' }
  const fm = post.frontmatter
  const url = `https://mcpspend.com/blog/${slug}`
  return {
    title: `${fm.title} · MCPSpend Blog`,
    description: fm.excerpt,
    alternates: { canonical: fm.canonical ?? url },
    authors: fm.author ? [{ name: fm.author }] : undefined,
    keywords: fm.tags,
    openGraph: {
      type: 'article',
      title: fm.title,
      description: fm.excerpt,
      url,
      siteName: 'MCPSpend',
      publishedTime: fm.publishedAt,
      modifiedTime: fm.updatedAt ?? fm.publishedAt,
      authors: fm.author ? [fm.author] : undefined,
      tags: fm.tags,
    },
    twitter: {
      card: 'summary_large_image',
      title: fm.title,
      description: fm.excerpt,
      creator: '@andreisirbu91',
    },
  }
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  // Future-dated or explicitly drafted posts 404 even though they're prerendered.
  // Keeps the URL stable for when the date arrives — same SHA, same OG image.
  const todayUtc = new Date().toISOString().slice(0, 10)
  if (post.frontmatter.draft || post.frontmatter.publishedAt > todayUtc) {
    notFound()
  }

  const related = getRelatedPosts(slug)
  const fm = post.frontmatter

  // schema.org Article JSON-LD — helps Google build a rich snippet and
  // ties the article into our Organization profile for E-E-A-T.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fm.title,
    description: fm.excerpt,
    image: 'https://mcpspend.com/logo.png',
    datePublished: fm.publishedAt,
    dateModified: fm.updatedAt ?? fm.publishedAt,
    author: { '@type': 'Person', name: fm.author, url: 'https://github.com/andreisirbu91-lab' },
    publisher: {
      '@type': 'Organization',
      name: 'MCPSpend',
      logo: { '@type': 'ImageObject', url: 'https://mcpspend.com/logo.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://mcpspend.com/blog/${slug}` },
    keywords: (fm.tags ?? []).join(', '),
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold">
            <Image src="/logo.png" alt="MCPSpend" width={32} height={32} className="w-8 h-8 object-contain" />
            MCPSpend
          </Link>
          <nav className="flex items-center gap-5 text-sm text-gray-400">
            <Link href="/blog" className="hover:text-white">← All posts</Link>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">
          {(fm.tags ?? ['post'])[0]}
        </div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
          {fm.title}
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">{fm.excerpt}</p>

        <div className="mt-6 flex items-center gap-3 text-sm text-gray-500 border-y border-white/5 py-4">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-700 flex items-center justify-center text-white font-semibold text-xs">
            {(fm.author ?? 'A').split(' ').map((p) => p[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="text-white font-medium">{fm.author}</div>
            <div className="text-xs">
              <time dateTime={fm.publishedAt}>{formatDate(fm.publishedAt)}</time>
              {' · '}
              {fm.readingMinutes} min read
              {fm.updatedAt && fm.updatedAt !== fm.publishedAt && (
                <> · updated {formatDate(fm.updatedAt)}</>
              )}
            </div>
          </div>
        </div>

        {/* Body — rendered from Markdown. Tailwind typography styling done
            via a single class set below since we don't ship @tailwindcss/typography. */}
        <div
          className="prose-body mt-10 text-gray-200 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        {/* Contextual backlinks — every article ends with a 3-card grid that
            funnels readers to the highest-intent pages on the site. */}
        <div className="mt-16 grid md:grid-cols-3 gap-4">
          <Link href="/" className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5 hover:bg-brand-500/10 transition-colors">
            <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Try MCPSpend</div>
            <div className="mt-1 text-white font-semibold">npx @mcpspend/proxy add</div>
            <div className="mt-1 text-xs text-gray-400">Free tier 25K calls/mo — no card needed.</div>
          </Link>
          <Link href="/pricing" className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors">
            <div className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Pricing</div>
            <div className="mt-1 text-white font-semibold">$0 → $499/mo</div>
            <div className="mt-1 text-xs text-gray-400">Free, Pro, Team, Enterprise — full feature matrix.</div>
          </Link>
          <Link href="/security" className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors">
            <div className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Security</div>
            <div className="mt-1 text-white font-semibold">Threat model + sub-processors</div>
            <div className="mt-1 text-xs text-gray-400">SOC 2 in progress, GDPR Art. 15/17/20 self-serve.</div>
          </Link>
        </div>

        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-lg font-semibold text-white">Related posts</h2>
            <div className="mt-4 space-y-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="text-xs text-gray-500">{formatDate(r.frontmatter.publishedAt)} · {r.frontmatter.readingMinutes} min</div>
                  <div className="mt-1 text-white font-semibold">{r.frontmatter.title}</div>
                  <div className="mt-1 text-sm text-gray-400 line-clamp-2">{r.frontmatter.excerpt}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {fm.canonical && (
          <p className="mt-12 text-xs text-gray-500 text-center">
            Originally published at{' '}
            <a href={fm.canonical} className="text-brand-400 hover:underline" target="_blank" rel="noopener">
              {new URL(fm.canonical).hostname}
            </a>
          </p>
        )}
      </article>

      <Footer />

      {/* Tailwind doesn't ship a typography plugin in this repo — minimal
          classnames inlined so headings/paras/code in the Markdown body look
          right without ~50kb of CSS we don't otherwise need. */}
      <style>{`
        .prose-body h2 { font-size: 1.6rem; line-height: 1.3; font-weight: 700; color: #fff; margin: 2.4rem 0 0.8rem; }
        .prose-body h3 { font-size: 1.25rem; line-height: 1.4; font-weight: 700; color: #fff; margin: 1.8rem 0 0.6rem; }
        .prose-body h4 { font-size: 1.05rem; font-weight: 700; color: #fff; margin: 1.4rem 0 0.4rem; }
        .prose-body p { margin: 1rem 0; }
        .prose-body strong { color: #fff; font-weight: 700; }
        .prose-body a { color: #38bdf8; text-decoration: underline; text-underline-offset: 2px; }
        .prose-body a:hover { color: #7dd3fc; }
        .prose-body code { font-family: SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.85em; background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 3px; color: #38bdf8; }
        .prose-body pre { background: #030712; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 16px; overflow-x: auto; margin: 1.2rem 0; }
        .prose-body pre code { background: transparent; padding: 0; color: #e2e8f0; font-size: 0.85em; }
        .prose-body ul, .prose-body ol { margin: 0.8rem 0; padding-left: 1.4rem; }
        .prose-body li { margin: 0.4rem 0; }
        .prose-body blockquote { border-left: 3px solid #0ea5e9; padding: 0.4rem 1rem; margin: 1.2rem 0; color: #94a3b8; font-style: italic; }
        .prose-body hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 2rem 0; }
        .prose-body table { width: 100%; border-collapse: collapse; margin: 1.2rem 0; font-size: 0.9em; }
        .prose-body th { background: rgba(255,255,255,0.04); text-align: left; padding: 8px 12px; font-weight: 700; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .prose-body td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .prose-body img { max-width: 100%; border-radius: 6px; margin: 1.4rem 0; }
      `}</style>
    </div>
  )
}
