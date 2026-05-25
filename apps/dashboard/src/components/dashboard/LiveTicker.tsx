'use client'

import { useEffect, useState, useRef } from 'react'
import { auth } from '@/lib/api'

interface LiveEvent {
  type: 'tool-call'
  serverName: string
  toolName: string
  model: string
  costUsd: number
  latencyMs: number | null
  success: boolean
  calledAt: string
  // Synthetic client-side id so React keys stay stable across re-renders.
  __id?: string
}

/**
 * Floating live-tool-call feed in the bottom-right of the dashboard.
 *
 * Activation booster: when a new user just installed the proxy and is staring
 * at an empty dashboard, the FIRST event they see lands here in real-time —
 * not after a 30-second refresh. That "the call I just made… appeared instantly"
 * moment is what converts trial into "this thing actually works".
 *
 * Implementation: native EventSource API hitting /api/stats/live (SSE).
 * Auto-reconnects on disconnect, no extra libraries.
 */
export function LiveTicker() {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const token = auth.getToken()
    const orgId = auth.getOrganizationId()
    if (!token || !orgId) return

    // EventSource doesn't let us set Authorization headers — but the live
    // endpoint accepts the token via query param fallback. We attach both
    // the JWT and the org id so the auth middleware picks them up.
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.mcpspend.com'
    const url = `${apiBase}/api/stats/live?token=${encodeURIComponent(token)}&orgId=${encodeURIComponent(orgId)}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener('hello', () => setConnected(true))
    // 'error' fires whenever the SSE stream drops — API container restart,
    // HTTP/2 protocol hiccup behind Caddy, idle proxy timeout, etc. EventSource
    // auto-reconnects on its own; we just flip the dot to gray and let it.
    // Don't propagate to console — these are routine for long-lived streams.
    es.addEventListener('error', (ev: Event) => {
      setConnected(false)
      ev.preventDefault?.()
    })
    es.addEventListener('message', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as LiveEvent
        data.__id = crypto.randomUUID()
        setEvents((prev) => [data, ...prev].slice(0, 30))
      } catch {
        /* ignore malformed events */
      }
    })

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [])

  // No events yet AND not connected — render nothing (no value to show).
  // Once connected we render the indicator even if events list is empty.
  if (!connected && events.length === 0) return null

  const visible = expanded ? events.slice(0, 12) : events.slice(0, 3)

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[300px] max-w-[calc(100vw-2rem)] hidden md:block">
      <div className="rounded-2xl border border-white/10 bg-gray-950/95 backdrop-blur shadow-2xl">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 border-b border-white/5 hover:bg-white/[0.02] transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-xs text-gray-300 font-semibold">
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
            {events.length > 0 && (
              <span className="text-[10px] text-gray-500">· {events.length} {events.length === 1 ? 'call' : 'calls'}</span>
            )}
          </div>
          <span className="text-[10px] text-gray-500">{expanded ? '▾' : '▸'}</span>
        </button>

        {events.length === 0 ? (
          <div className="px-4 py-3 text-xs text-gray-500">
            Waiting for the first tool call…
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            {visible.map((e) => {
              const time = new Date(e.calledAt).toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })
              return (
                <div
                  key={e.__id}
                  className={
                    'px-4 py-2 border-b border-white/5 last:border-b-0 ' +
                    (e.success ? '' : 'bg-red-500/5')
                  }
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <code className={`font-mono truncate ${e.success ? 'text-brand-300' : 'text-red-300'}`}>
                      {e.serverName}/{e.toolName}
                    </code>
                    <span className="text-gray-400 tabular-nums shrink-0">
                      ${e.costUsd.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500 mt-0.5">
                    <span>{time}</span>
                    <span className="tabular-nums">
                      {e.latencyMs != null ? `${e.latencyMs}ms` : '—'}
                      {!e.success && <span className="text-red-400 ml-1">error</span>}
                    </span>
                  </div>
                </div>
              )
            })}
            {!expanded && events.length > 3 && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full px-4 py-1.5 text-[10px] text-gray-500 hover:text-white hover:bg-white/[0.02] transition-colors"
              >
                Show {Math.min(events.length, 12) - 3} more →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
