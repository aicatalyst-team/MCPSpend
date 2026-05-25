'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'

interface Webhook {
  id: string
  label: string
  targetUrl: string
  events: string[]
  isActive: boolean
  lastDeliveryAt: string | null
  lastDeliveryStatus: number | null
  consecutiveFailures: number
  createdAt: string
  createdByUserId: string
}

interface CreatedWebhook extends Webhook {
  secret: string
}

interface Delivery {
  id: string
  eventType: string
  httpStatus: number | null
  responseBody: string | null
  succeeded: boolean
  attempts: number
  createdAt: string
}

const AVAILABLE_EVENTS = [
  { id: 'budget.alert',     label: 'Budget threshold hit (50/80/100%)' },
  { id: 'spend.alert',      label: 'Dollar budget threshold hit' },
  { id: 'anomaly.detected', label: 'Anomalous tool cost (>3× baseline)' },
  { id: 'key.create',       label: 'API key created' },
  { id: 'key.revoke',       label: 'API key revoked' },
  { id: 'member.invite',    label: 'Member invited' },
  { id: 'member.remove',    label: 'Member removed' },
  { id: 'project.create',   label: 'Project created' },
  { id: 'project.delete',   label: 'Project deleted' },
] as const

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<{ id: string; secret: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function load() {
    try {
      const data = await api<Webhook[]>('/api/webhook-subscriptions')
      setWebhooks(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load webhooks')
    }
  }

  useEffect(() => { void load() }, [])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Webhooks</h2>
          <p className="text-sm text-gray-400 mt-1">
            POST events to your own URLs as they happen — PagerDuty, Datadog, Zapier, custom systems.
            Every request is HMAC-SHA256 signed via{' '}
            <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">X-MCPSpend-Signature</code>.
            See{' '}
            <Link href="/docs" className="text-brand-400 hover:underline">docs</Link>.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-white text-gray-950 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
        >
          + New webhook
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">{error}</div>
      )}

      {createdSecret && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <p className="text-emerald-200 font-semibold">Webhook created — copy your signing secret now</p>
          <p className="text-xs text-emerald-300/80 mt-1">This is the only time the full secret is shown. Store it where your verifier can read it.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 bg-gray-950 rounded px-3 py-2 text-xs font-mono text-emerald-300 break-all">{createdSecret.secret}</code>
            <button
              onClick={() => navigator.clipboard.writeText(createdSecret.secret)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded transition-colors"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setCreatedSecret(null)}
            className="mt-3 text-xs text-emerald-300/70 hover:text-emerald-200"
          >
            I&apos;ve copied it, dismiss →
          </button>
        </div>
      )}

      {showCreate && (
        <CreateForm
          onCreated={(w) => {
            setCreatedSecret({ id: w.id, secret: w.secret })
            setShowCreate(false)
            void load()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {webhooks === null ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center text-sm text-gray-400">
          No webhooks yet. Create one to receive events like budget alerts, anomalies, and audit-log changes at a URL you control.
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => (
            <WebhookCard
              key={w.id}
              webhook={w}
              expanded={expandedId === w.id}
              onToggle={() => setExpandedId(expandedId === w.id ? null : w.id)}
              onUpdated={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CreateForm({ onCreated, onCancel }: { onCreated: (w: CreatedWebhook) => void; onCancel: () => void }) {
  const [label, setLabel] = useState('')
  const [targetUrl, setTargetUrl] = useState('https://')
  const [events, setEvents] = useState<string[]>(['budget.alert', 'spend.alert', 'anomaly.detected'])
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function toggle(id: string) {
    setEvents((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id])
  }

  async function submit() {
    setErr(null)
    if (events.length === 0) { setErr('Pick at least one event'); return }
    setSubmitting(true)
    try {
      const w = await api<CreatedWebhook>('/api/webhook-subscriptions', {
        method: 'POST',
        body: JSON.stringify({ label, targetUrl, events }),
      })
      onCreated(w)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
      <p className="text-white font-semibold">New webhook</p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="PagerDuty critical alerts"
            maxLength={80}
            className="w-full bg-gray-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Target URL (HTTPS only)</label>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://events.example.com/mcpspend"
            className="w-full bg-gray-950 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">Events to subscribe</label>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {AVAILABLE_EVENTS.map((ev) => (
              <label key={ev.id} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={events.includes(ev.id)}
                  onChange={() => toggle(ev.id)}
                  className="rounded border-white/20"
                />
                <span className="text-gray-300">{ev.label}</span>
              </label>
            ))}
          </div>
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={submitting || !label || !targetUrl}
            className="bg-white text-gray-950 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create webhook'}
          </button>
          <button onClick={onCancel} className="text-sm text-gray-400 hover:text-white px-3 py-2">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function WebhookCard({ webhook, expanded, onToggle, onUpdated }: { webhook: Webhook; expanded: boolean; onToggle: () => void; onUpdated: () => void }) {
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (expanded && deliveries === null) {
      api<Delivery[]>(`/api/webhook-subscriptions/${webhook.id}/deliveries?limit=20`)
        .then(setDeliveries)
        .catch(() => setDeliveries([]))
    }
  }, [expanded, deliveries, webhook.id])

  async function toggleActive() {
    await api(`/api/webhook-subscriptions/${webhook.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !webhook.isActive }),
    }).catch(() => {})
    onUpdated()
  }

  async function deleteWebhook() {
    if (!confirm(`Delete webhook "${webhook.label}"? This cannot be undone.`)) return
    await api(`/api/webhook-subscriptions/${webhook.id}`, { method: 'DELETE' }).catch(() => {})
    onUpdated()
  }

  async function sendTest() {
    setTesting(true)
    await api(`/api/webhook-subscriptions/${webhook.id}/test`, { method: 'POST' }).catch(() => {})
    setTimeout(() => setTesting(false), 1500)
    // refresh deliveries after a short delay
    setTimeout(() => {
      api<Delivery[]>(`/api/webhook-subscriptions/${webhook.id}/deliveries?limit=20`).then(setDeliveries).catch(() => {})
    }, 2000)
  }

  const statusColor = webhook.lastDeliveryStatus
    ? webhook.lastDeliveryStatus >= 200 && webhook.lastDeliveryStatus < 300
      ? 'text-emerald-400'
      : 'text-red-400'
    : 'text-gray-500'

  return (
    <div className={'rounded-2xl border ' + (webhook.isActive ? 'border-white/10' : 'border-white/5 opacity-70') + ' bg-white/[0.02] p-5'}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold truncate">{webhook.label}</h3>
            <span className={'text-[10px] uppercase tracking-widest px-2 py-0.5 rounded ' + (webhook.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-500/15 text-gray-400')}>
              {webhook.isActive ? 'Active' : 'Paused'}
            </span>
            {webhook.consecutiveFailures >= 3 && (
              <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                {webhook.consecutiveFailures} failures
              </span>
            )}
          </div>
          <code className="block text-xs font-mono text-gray-400 mt-1 truncate">{webhook.targetUrl}</code>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {webhook.events.map((ev) => (
              <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 font-mono">{ev}</span>
            ))}
          </div>
          {webhook.lastDeliveryAt && (
            <p className="mt-2 text-[11px] text-gray-500">
              Last delivery: <span className={statusColor}>HTTP {webhook.lastDeliveryStatus ?? '?'}</span>{' '}
              {new Date(webhook.lastDeliveryAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={sendTest} disabled={testing} className="text-xs text-brand-400 hover:text-brand-300 px-2 py-1 disabled:opacity-50">
            {testing ? 'Sent ✓' : 'Send test'}
          </button>
          <button onClick={toggleActive} className="text-xs text-gray-400 hover:text-white px-2 py-1">
            {webhook.isActive ? 'Pause' : 'Resume'}
          </button>
          <button onClick={deleteWebhook} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">
            Delete
          </button>
          <button onClick={onToggle} className="text-xs text-gray-500 hover:text-white px-2 py-1">
            {expanded ? '▾' : '▸'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-xs text-gray-400 mb-2 font-semibold">Recent deliveries</p>
          {deliveries === null ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-xs text-gray-500">No deliveries yet. Click &quot;Send test&quot; above to fire one.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {deliveries.map((d) => (
                <div key={d.id} className="rounded-lg border border-white/5 bg-gray-950/40 p-2 text-xs flex items-center gap-2 flex-wrap">
                  <span className={d.succeeded ? 'text-emerald-400' : 'text-red-400'}>
                    {d.succeeded ? '✓' : '✗'}
                  </span>
                  <code className="text-gray-300 font-mono">{d.eventType}</code>
                  {d.httpStatus != null && <span className="text-gray-500">HTTP {d.httpStatus}</span>}
                  <span className="text-gray-500 ml-auto">{new Date(d.createdAt).toLocaleString()}</span>
                  {d.responseBody && !d.succeeded && (
                    <div className="w-full mt-1 text-[10px] text-red-300/80 font-mono break-all">{d.responseBody.slice(0, 200)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
