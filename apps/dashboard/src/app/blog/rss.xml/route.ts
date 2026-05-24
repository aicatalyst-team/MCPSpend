import { getPublishedPosts } from '@/lib/blog'

/**
 * RSS 2.0 feed for /blog. Lets readers add MCPSpend to Feedly / Inoreader /
 * Reeder. Cached 1h so a fresh post propagates within that window even
 * between full redeploys.
 */
export const revalidate = 3600

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const posts = getPublishedPosts()
  const site = 'https://mcpspend.com'
  const now = new Date().toUTCString()

  const items = posts
    .map((p) => {
      const url = `${site}/blog/${p.slug}`
      const pubDate = new Date(p.frontmatter.publishedAt + 'T00:00:00Z').toUTCString()
      return `
    <item>
      <title>${xmlEscape(p.frontmatter.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>noreply@mcpspend.com (${xmlEscape(p.frontmatter.author ?? 'Andrei Sirbu')})</author>
      <description>${xmlEscape(p.frontmatter.excerpt)}</description>
      ${(p.frontmatter.tags ?? []).map((t) => `<category>${xmlEscape(t)}</category>`).join('')}
    </item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>MCPSpend Blog</title>
    <link>${site}/blog</link>
    <atom:link href="${site}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Engineering and product notes from building MCPSpend — the first cost-observability platform for the Model Context Protocol.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
