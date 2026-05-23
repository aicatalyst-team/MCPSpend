import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://mcpspend.com'),
  title: {
    default: 'MCPSpend — Cost attribution & observability for MCP tools',
    template: '%s · MCPSpend',
  },
  description:
    'MCPSpend is the observability proxy for Model Context Protocol tools. Track tokens, attribute spend per team and customer, and ship AI to production with audit-grade visibility.',
  keywords: [
    'MCP', 'Model Context Protocol', 'AI cost tracking', 'LLM observability',
    'AI cost attribution', 'agent monitoring', 'AI FinOps', 'token tracking',
  ],
  authors: [{ name: 'MCPSpend' }],
  openGraph: {
    type: 'website',
    url: 'https://mcpspend.com',
    siteName: 'MCPSpend',
    title: 'MCPSpend — Cost attribution & observability for MCP tools',
    description:
      'Know what every MCP call costs you. Real-time attribution, audit logs, and SOC 2-ready observability for teams shipping AI to production.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCPSpend — Cost attribution & observability for MCP tools',
    description:
      'Know what every MCP call costs you. Real-time attribution, audit logs, and SOC 2-ready observability for teams shipping AI to production.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  )
}
