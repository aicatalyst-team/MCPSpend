'use client'

import { useMemo, useState } from 'react'

// ----- Real model pricing (USD per 1M tokens). Mirrors apps/api/src/lib/tokenCost.ts.
// If you update one, update both — keep them in sync. Public audit at
// /api/public/pricing-models.
const MODEL_PRICING: Record<string, { input: number; output: number; label: string }> = {
  'claude-opus-4-7':    { input: 15.00, output: 75.00, label: 'Claude Opus 4.7' },
  'claude-sonnet-4-6':  { input: 3.00,  output: 15.00, label: 'Claude Sonnet 4.6' },
  'claude-haiku-4-5':   { input: 0.80,  output: 4.00,  label: 'Claude Haiku 4.5' },
  'gpt-4o':             { input: 2.50,  output: 10.00, label: 'GPT-4o' },
  'gpt-4o-mini':        { input: 0.15,  output: 0.60,  label: 'GPT-4o mini' },
  'o3':                 { input: 15.00, output: 60.00, label: 'OpenAI o3' },
  'o3-mini':            { input: 1.10,  output: 4.40,  label: 'OpenAI o3-mini' },
  'gemini-2.0-pro':     { input: 1.25,  output: 5.00,  label: 'Gemini 2.0 Pro' },
  'gemini-2.0-flash':   { input: 0.075, output: 0.30,  label: 'Gemini 2.0 Flash' },
  'grok-2':             { input: 2.00,  output: 10.00, label: 'Grok 2' },
  'deepseek-chat':      { input: 0.27,  output: 1.10,  label: 'DeepSeek Chat' },
  'deepseek-reasoner':  { input: 0.55,  output: 2.19,  label: 'DeepSeek Reasoner' },
  'mistral-large':      { input: 2.00,  output: 6.00,  label: 'Mistral Large' },
  'llama-3.1-405b':     { input: 5.00,  output: 16.00, label: 'Llama 3.1 405B' },
}

// ----- Per-MCP-server profile (derived from anonymized MCPSpend telemetry).
// avgInputTokens + avgOutputTokens per CALL, plus calls/hour during active agent work.
// Numbers are conservative middle-of-road estimates — heavy users will see more,
// light users less. Real measurement gives you exact figures.
interface ServerProfile {
  id: string
  name: string
  category: string
  avgInputTokens: number
  avgOutputTokens: number
  callsPerActiveHour: number
  notes: string
}

const SERVERS: ServerProfile[] = [
  {
    id: 'playwright',
    name: 'Playwright',
    category: 'Browser automation',
    avgInputTokens: 2000,
    avgOutputTokens: 12000,
    callsPerActiveHour: 8,
    notes: 'Heavy DOM payloads — usually the #1 cost driver',
  },
  {
    id: 'cascade-browser',
    name: 'Cascade Browser (Windsurf)',
    category: 'Browser automation',
    avgInputTokens: 2000,
    avgOutputTokens: 11000,
    callsPerActiveHour: 6,
    notes: 'Windsurf-bundled — same pattern as Playwright',
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    category: 'IDE / code',
    avgInputTokens: 300,
    avgOutputTokens: 4000,
    callsPerActiveHour: 30,
    notes: 'High frequency, moderate per-call cost',
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'Code / VCS',
    avgInputTokens: 500,
    avgOutputTokens: 6000,
    callsPerActiveHour: 5,
    notes: 'Diffs, issues, PRs — bursts when reviewing',
  },
  {
    id: 'fetch',
    name: 'Fetch / Read-URL',
    category: 'Web',
    avgInputTokens: 300,
    avgOutputTokens: 8000,
    callsPerActiveHour: 6,
    notes: 'Pulls whole pages — can balloon on JS-heavy sites',
  },
  {
    id: 'brave-search',
    name: 'Brave / Web Search',
    category: 'Web',
    avgInputTokens: 300,
    avgOutputTokens: 3000,
    callsPerActiveHour: 4,
    notes: 'Cheap per call, called often',
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'Database',
    avgInputTokens: 400,
    avgOutputTokens: 2500,
    callsPerActiveHour: 4,
    notes: 'Schema introspection + queries',
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Comms',
    avgInputTokens: 500,
    avgOutputTokens: 200,
    callsPerActiveHour: 2,
    notes: 'Low-cost, mostly outbound messages',
  },
  {
    id: 'linear',
    name: 'Linear / Jira',
    category: 'PM',
    avgInputTokens: 400,
    avgOutputTokens: 1500,
    callsPerActiveHour: 3,
    notes: 'Issue search + create — moderate output',
  },
  {
    id: 'codeium-context',
    name: 'Codeium Context',
    category: 'IDE / code',
    avgInputTokens: 200,
    avgOutputTokens: 2000,
    callsPerActiveHour: 12,
    notes: 'Windsurf-bundled codebase indexer',
  },
]

// Quick-pick presets — common real-world setups so people land on a useful starting point.
const PRESETS: Record<string, { label: string; servers: string[]; model: string; hoursPerDay: number }> = {
  'claude-desktop-typical': {
    label: 'Claude Desktop (typical)',
    servers: ['filesystem', 'github', 'fetch', 'brave-search'],
    model: 'claude-sonnet-4-6',
    hoursPerDay: 4,
  },
  'cursor-heavy': {
    label: 'Cursor (heavy)',
    servers: ['filesystem', 'github', 'postgres', 'fetch', 'playwright'],
    model: 'claude-sonnet-4-6',
    hoursPerDay: 6,
  },
  'windsurf-default': {
    label: 'Windsurf (default bundle)',
    servers: ['cascade-browser', 'fetch', 'brave-search', 'codeium-context'],
    model: 'claude-sonnet-4-6',
    hoursPerDay: 4,
  },
  'ai-agent-team': {
    label: 'Background AI agent (team)',
    servers: ['playwright', 'github', 'postgres', 'slack', 'fetch'],
    model: 'claude-opus-4-7',
    hoursPerDay: 12,
  },
}

const COLORS = [
  'bg-brand-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-lime-500',
  'bg-indigo-500',
]

function fmtMoney(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`
  if (n < 1) return `$${n.toFixed(3)}`
  if (n < 100) return `$${n.toFixed(2)}`
  return `$${n.toFixed(0)}`
}

export function CalculatorClient() {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['filesystem', 'github', 'fetch', 'brave-search']),
  )
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [hoursPerDay, setHoursPerDay] = useState(4)
  const [workdaysPerMonth, setWorkdaysPerMonth] = useState(20)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function applyPreset(key: string) {
    const p = PRESETS[key]
    if (!p) return
    setSelected(new Set(p.servers))
    setModel(p.model)
    setHoursPerDay(p.hoursPerDay)
  }

  const breakdown = useMemo(() => {
    const pricing = MODEL_PRICING[model]
    const inputRate = pricing.input / 1_000_000
    const outputRate = pricing.output / 1_000_000
    const activeHoursPerMonth = hoursPerDay * workdaysPerMonth

    const rows = Array.from(selected)
      .map((id) => SERVERS.find((s) => s.id === id))
      .filter((s): s is ServerProfile => Boolean(s))
      .map((s) => {
        const calls = s.callsPerActiveHour * activeHoursPerMonth
        const inputTokens = calls * s.avgInputTokens
        const outputTokens = calls * s.avgOutputTokens
        const cost = inputTokens * inputRate + outputTokens * outputRate
        return { server: s, calls, inputTokens, outputTokens, cost }
      })
      .sort((a, b) => b.cost - a.cost)

    const total = rows.reduce((acc, r) => acc + r.cost, 0)
    const totalCalls = rows.reduce((acc, r) => acc + r.calls, 0)
    return { rows, total, totalCalls, activeHoursPerMonth }
  }, [selected, model, hoursPerDay, workdaysPerMonth])

  const maxCost = breakdown.rows[0]?.cost ?? 0

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8">
      {/* ----- Inputs ----- */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/5 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Quick start</h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PRESETS).map(([k, p]) => (
              <button
                key={k}
                onClick={() => applyPreset(k)}
                className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white transition-colors text-left"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Which MCP servers do you use?</h2>
          <div className="space-y-2">
            {SERVERS.map((s) => {
              const on = selected.has(s.id)
              return (
                <label
                  key={s.id}
                  className={`flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    on ? 'bg-brand-500/10 border border-brand-500/30' : 'bg-white/[0.02] border border-white/5 hover:bg-white/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(s.id)}
                    className="mt-0.5 accent-brand-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium">{s.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">{s.category}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{s.notes}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-gray-900 p-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">Primary model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-gray-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {Object.entries(MODEL_PRICING).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label} — ${p.input}/M in, ${p.output}/M out
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm font-semibold text-gray-300">Active agent hours / workday</label>
              <span className="text-xs text-brand-400 font-mono tabular-nums">{hoursPerDay}h</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm font-semibold text-gray-300">Workdays / month</label>
              <span className="text-xs text-brand-400 font-mono tabular-nums">{workdaysPerMonth}</span>
            </div>
            <input
              type="range"
              min={1}
              max={31}
              step={1}
              value={workdaysPerMonth}
              onChange={(e) => setWorkdaysPerMonth(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
        </div>
      </div>

      {/* ----- Output ----- */}
      <div className="space-y-6 lg:sticky lg:top-24 self-start">
        <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 to-gray-900 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-300 mb-2">Estimated monthly bill</p>
          <p className="text-5xl sm:text-6xl font-bold text-white tabular-nums">
            {fmtMoney(breakdown.total)}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            ~{breakdown.totalCalls.toLocaleString()} tool calls / month ·{' '}
            {breakdown.activeHoursPerMonth}h active agent time · {MODEL_PRICING[model].label}
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-gray-900 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Cost breakdown by server</h2>
          {breakdown.rows.length === 0 ? (
            <p className="text-sm text-gray-500">Pick at least one MCP server to see a breakdown.</p>
          ) : (
            <div className="space-y-3">
              {breakdown.rows.map((r, idx) => {
                const pct = breakdown.total > 0 ? (r.cost / breakdown.total) * 100 : 0
                const barPct = maxCost > 0 ? (r.cost / maxCost) * 100 : 0
                return (
                  <div key={r.server.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white font-medium">{r.server.name}</span>
                      <span className="text-gray-400 tabular-nums">
                        {fmtMoney(r.cost)} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full ${COLORS[idx % COLORS.length]} rounded-full transition-all`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 tabular-nums">
                      {r.calls.toLocaleString()} calls · {(r.inputTokens / 1_000_000).toFixed(2)}M in ·{' '}
                      {(r.outputTokens / 1_000_000).toFixed(2)}M out
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {breakdown.rows.length > 0 && breakdown.rows[0].cost / breakdown.total > 0.4 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
            <p className="text-xs uppercase tracking-wide text-amber-300 mb-1">Insight</p>
            <p className="text-sm text-white">
              <strong>{breakdown.rows[0].server.name}</strong> is{' '}
              {((breakdown.rows[0].cost / breakdown.total) * 100).toFixed(0)}% of your estimated spend.
              That&apos;s where optimization pays off most.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-white/5 bg-gray-900 p-6 text-center">
          <p className="text-sm text-gray-400 mb-3">Want exact per-call numbers, not estimates?</p>
          <a
            href="/register"
            className="inline-block bg-white text-gray-950 font-semibold px-5 py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Track your real spend — free →
          </a>
          <p className="text-[10px] text-gray-500 mt-3">
            25K calls/month free · no card · open-source proxy
          </p>
        </div>
      </div>
    </div>
  )
}
