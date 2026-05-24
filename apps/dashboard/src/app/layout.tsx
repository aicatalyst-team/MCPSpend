import type { Metadata } from 'next'
import './globals.css'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { CookieConsentBanner } from '@/components/CookieConsentBanner'

export const metadata: Metadata = {
  metadataBase: new URL('https://mcpspend.com'),
  title: {
    default: 'MCPSpend — Know what your AI agents really cost',
    template: '%s · MCPSpend',
  },
  description:
    'Real-time cost tracking for every MCP tool call across Cursor, Claude Desktop, Windsurf, and VS Code. One command to install. Free tier: 25K calls/month.',
  keywords: [
    'MCP', 'Model Context Protocol', 'AI cost tracking', 'LLM observability',
    'AI cost attribution', 'agent monitoring', 'AI FinOps', 'token tracking',
    'Cursor', 'Claude Desktop', 'Windsurf', 'Claude Code',
  ],
  authors: [{ name: 'MCPSpend', url: 'https://mcpspend.com' }],
  creator: 'NewRzs SRL',
  publisher: 'NewRzs SRL',
  // openGraph.images falls back to /opengraph-image.tsx automatically — Next.js
  // discovers the route at /opengraph-image.png. Twitter card inherits the
  // same image via twitter.images.
  openGraph: {
    type: 'website',
    url: 'https://mcpspend.com',
    siteName: 'MCPSpend',
    title: 'MCPSpend — Know what your AI agents really cost',
    description:
      'Real-time cost tracking for every MCP tool call across Cursor, Claude Desktop, Windsurf, and VS Code. One command to install.',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCPSpend — Know what your AI agents really cost',
    description:
      'Real-time cost tracking for every MCP tool call. One command, every MCP client. Free tier 25K calls/month.',
    site: '@mcpspend',
    creator: '@andreisirbu91',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://mcpspend.com' },
  category: 'technology',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        {children}
        <GoogleAnalytics />
        <CookieConsentBanner />
      </body>
    </html>
  )
}
