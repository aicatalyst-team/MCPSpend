import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'API Docs — MCPSpend',
  description:
    'Full REST API reference for MCPSpend. Ingest tool calls, query stats, manage organizations, projects and API keys programmatically.',
  alternates: { canonical: 'https://mcpspend.com/docs' },
}

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  summary: string
  auth: 'apikey' | 'user' | 'public'
  example?: string
  notes?: string
}

const SECTIONS: Array<{ title: string; description: string; endpoints: Endpoint[] }> = [
  {
    title: 'Ingest',
    description: 'Submit tool-call events. Used by the proxy under the hood — you only call this directly if you build a custom integration.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ingest',
        summary: 'Submit one tool call or a batch (≤ 500).',
        auth: 'apikey',
        example: `curl -X POST https://api.mcpspend.com/api/ingest \\
  -H "Authorization: Bearer mcps_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serverName": "filesystem",
    "toolName": "read_file",
    "model": "claude-sonnet-4-6",
    "inputTokens": 240,
    "outputTokens": 50,
    "latencyMs": 120,
    "success": true,
    "customerLabel": "acme-corp"
  }'`,
        notes: 'Send an ARRAY for batch (faster). customerLabel is optional and lets you slice spend by your own end-customer.',
      },
    ],
  },
  {
    title: 'Statistics',
    description: 'Read-only aggregates for dashboards and reporting.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/stats/overview?days=30&projectId=…',
        summary: 'KPIs, daily totals, top tools, top servers.',
        auth: 'apikey',
        example: `curl -H "Authorization: Bearer mcps_live_xxx" \\
  https://api.mcpspend.com/api/stats/overview?days=30`,
      },
      {
        method: 'GET',
        path: '/api/stats/customers?days=30&limit=10',
        summary: 'Top end-customers by cost (uses customerLabel from ingest).',
        auth: 'apikey',
      },
      {
        method: 'GET',
        path: '/api/stats/forecast',
        summary: 'End-of-month projection with uncertainty band (USD ± stddev).',
        auth: 'apikey',
        notes: 'Recency-weighted moving average + day-of-week seasonality. Returns linearProjectedUsd alongside the smart forecast so you can show both.',
      },
      {
        method: 'GET',
        path: '/api/stats/sessions?limit=20&offset=0',
        summary: 'List recent sessions.',
        auth: 'apikey',
      },
      {
        method: 'GET',
        path: '/api/stats/sessions/:id',
        summary: 'Single session header + all its tool calls.',
        auth: 'apikey',
      },
    ],
  },
  {
    title: 'Export',
    description: 'CSV exports for offline analysis. Requires Pro plan or higher.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/export/tool-calls.csv?days=30&projectId=…',
        summary: 'Stream tool calls as CSV. Cursor-paginated internally, supports up to 1M rows per export.',
        auth: 'user',
        notes: 'Streams up to 1,000,000 rows. Header: calledAt, project, server, tool, model, inputTokens, outputTokens, costUsd, latencyMs, success, errorCode, sessionId.',
      },
    ],
  },
  {
    title: 'Organizations',
    description: 'Manage org-level settings, members, and billing context.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/organizations',
        summary: 'List orgs the current user belongs to.',
        auth: 'user',
      },
      {
        method: 'POST',
        path: '/api/organizations',
        summary: 'Create a new organization.',
        auth: 'user',
      },
      {
        method: 'GET',
        path: '/api/organizations/current',
        summary: 'Current org details + month-to-date spend.',
        auth: 'apikey',
      },
      {
        method: 'PATCH',
        path: '/api/organizations/current',
        summary: 'Update org name, Slack webhook, monthly $ budget.',
        auth: 'user',
        notes: 'OWNER/ADMIN only. Slack webhook URL is encrypted at rest with AES-256-GCM.',
      },
      {
        method: 'GET',
        path: '/api/organizations/current/members',
        summary: 'List members.',
        auth: 'user',
      },
    ],
  },
  {
    title: 'Projects',
    description: 'Group tool-call data by team, environment, or initiative.',
    endpoints: [
      { method: 'GET',    path: '/api/projects',    summary: 'List projects in the current org.', auth: 'apikey' },
      { method: 'POST',   path: '/api/projects',    summary: 'Create a project. FREE plan: 1 project max.', auth: 'user' },
      { method: 'DELETE', path: '/api/projects/:id', summary: 'Delete a project (cascades all data).', auth: 'user' },
    ],
  },
  {
    title: 'API Keys',
    description: 'Manage your mcps_live_… keys for proxy authentication.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/keys',
        summary: 'List API keys (prefix only, never plaintext).',
        auth: 'user',
      },
      {
        method: 'POST',
        path: '/api/keys',
        summary: 'Create a new API key — response includes plaintext ONCE.',
        auth: 'user',
        notes: 'Keys are SHA-256 hashed on the server. Save the plaintext immediately; you cannot retrieve it later.',
      },
      {
        method: 'POST',
        path: '/api/keys/:id/revoke',
        summary: 'Revoke a key. Future requests with it will 401.',
        auth: 'user',
      },
    ],
  },
  {
    title: 'Account (GDPR)',
    description: 'Self-serve data export and deletion per GDPR Art. 15 / 17 / 20.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/account/data-export',
        summary: 'Download a JSON dump of every piece of personal data we hold about you.',
        auth: 'user',
      },
      {
        method: 'POST',
        path: '/api/account/delete',
        summary: 'Anonymise + delete the account. Body: {"confirm":"DELETE"}',
        auth: 'user',
        notes: 'If you are the sole OWNER of an org, transfer ownership first. See https://mcpspend.com/legal/data-rights.',
      },
    ],
  },
  {
    title: 'MCP (HTTP)',
    description: 'JSON-RPC endpoint compatible with the MCP HTTP transport. Query your usage from any MCP client.',
    endpoints: [
      {
        method: 'POST',
        path: '/api/mcp',
        summary: 'JSON-RPC: initialize / tools/list / tools/call.',
        auth: 'apikey',
        notes: 'Public tool try_demo works without auth — used by Smithery preview.',
      },
      {
        method: 'GET',
        path: '/.well-known/mcp/server-card.json',
        summary: 'MCP server discovery card (RFC-style).',
        auth: 'public',
      },
      {
        method: 'GET',
        path: '/.well-known/oauth-protected-resource',
        summary: 'OAuth 2.0 Protected Resource Metadata (RFC 9728).',
        auth: 'public',
      },
    ],
  },
]

const AUTH_BADGE: Record<Endpoint['auth'], { label: string; cls: string }> = {
  apikey: { label: 'Bearer mcps_live_…', cls: 'bg-brand-500/15 text-brand-300 border-brand-500/30' },
  user:   { label: 'User JWT', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  public: { label: 'Public',   cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
}

const METHOD_COLOR: Record<Endpoint['method'], string> = {
  GET:    'text-emerald-400',
  POST:   'text-brand-400',
  PATCH:  'text-amber-400',
  DELETE: 'text-red-400',
}

export default function DocsPage() {
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
            <Link href="/docs" className="text-white">API Docs</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">API Reference</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
          MCPSpend API
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          Everything the proxy and dashboard use is also available to you. Stable URLs at <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">https://api.mcpspend.com</code>, JSON in, JSON out, Bearer-token auth, 429 with <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">Retry-After</code> on rate limits.
        </p>

        <div className="mt-8 grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-xs uppercase tracking-widest text-gray-500">Base URL</div>
            <div className="mt-1 font-mono text-sm text-brand-300">api.mcpspend.com</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-xs uppercase tracking-widest text-gray-500">Auth header</div>
            <div className="mt-1 font-mono text-sm text-brand-300">Authorization: Bearer mcps_live_…</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-xs uppercase tracking-widest text-gray-500">Rate limit</div>
            <div className="mt-1 font-mono text-sm text-brand-300">1000 req / min / IP</div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
          <p className="text-white font-semibold">Get an API key</p>
          <p className="text-sm text-gray-300 mt-1">
            Sign in → <Link href="/dashboard/keys" className="text-brand-400 hover:underline">Dashboard / API Keys</Link> → &quot;Create API key&quot;. Keys start with <code className="text-xs bg-gray-950 px-1.5 py-0.5 rounded">mcps_live_</code> on production, <code className="text-xs bg-gray-950 px-1.5 py-0.5 rounded">mcps_test_</code> for test mode. We hash with SHA-256 and never store plaintext — copy yours immediately.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title} className="mt-12">
            <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
            <p className="mt-2 text-sm text-gray-400">{section.description}</p>

            <div className="mt-5 space-y-3">
              {section.endpoints.map((e, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`font-mono text-xs font-bold ${METHOD_COLOR[e.method]}`}>{e.method}</span>
                    <code className="font-mono text-sm text-white break-all">{e.path}</code>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${AUTH_BADGE[e.auth].cls}`}>
                      {AUTH_BADGE[e.auth].label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-300">{e.summary}</p>
                  {e.notes && (
                    <p className="mt-2 text-xs text-gray-400 italic">{e.notes}</p>
                  )}
                  {e.example && (
                    <pre className="mt-3 bg-gray-950 border border-white/5 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
{e.example}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-16 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-xl font-semibold text-white">Errors</h2>
          <p className="mt-2 text-sm text-gray-400">All errors return a JSON body with an <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">error</code> string. Common codes:</p>
          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-white/5">
              <tr><td className="py-2 font-mono text-amber-400 w-20">400</td><td className="text-gray-300">Validation error in payload</td></tr>
              <tr><td className="py-2 font-mono text-amber-400">401</td><td className="text-gray-300">Missing / invalid / revoked key</td></tr>
              <tr><td className="py-2 font-mono text-amber-400">402</td><td className="text-gray-300">Plan does not include this feature — body has <code>upgradeUrl</code></td></tr>
              <tr><td className="py-2 font-mono text-amber-400">403</td><td className="text-gray-300">Insufficient role (OWNER/ADMIN required for destructive ops)</td></tr>
              <tr><td className="py-2 font-mono text-amber-400">404</td><td className="text-gray-300">Resource not found in your org</td></tr>
              <tr><td className="py-2 font-mono text-amber-400">409</td><td className="text-gray-300">Conflict (e.g. duplicate invite, sole-owner deletion)</td></tr>
              <tr><td className="py-2 font-mono text-amber-400">429</td><td className="text-gray-300">Rate-limited or quota exceeded — see <code>Retry-After</code></td></tr>
              <tr><td className="py-2 font-mono text-red-400">5xx</td><td className="text-gray-300">Upstream issue — retries are safe (ingest is idempotent)</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mt-12 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6 text-center">
          <p className="text-white font-semibold">Need an OpenAPI spec or SDK?</p>
          <p className="mt-2 text-sm text-gray-300">
            Email <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a> and we&apos;ll prioritise it. TypeScript &amp; Python SDKs are on the Q3 2026 roadmap.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
