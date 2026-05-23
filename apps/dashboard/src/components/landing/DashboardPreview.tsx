const kpis = [
  { label: 'Total spend', value: '$10,043.21', delta: '+24%', deltaDir: 'up' },
  { label: 'Tool calls', value: '847,231', delta: '+18%', deltaDir: 'up' },
  { label: 'Avg / call', value: '$0.0119', delta: '−3%', deltaDir: 'down' },
  { label: 'p95 latency', value: '412 ms', delta: '+47 ms', deltaDir: 'up' },
]

const tools = [
  { name: 'web_search',     cost: 3247.18, bar: 100, delta: '+52%', alert: true },
  { name: 'github',         cost: 1892.40, bar: 58,  delta: '+18%', alert: false },
  { name: 'gmail',          cost: 1205.66, bar: 37,  delta: '+8%',  alert: false },
  { name: 'jira',           cost: 987.23,  bar: 30,  delta: '+12%', alert: true },
  { name: 'slack',          cost: 654.10,  bar: 20,  delta: '−4%',  alert: false },
  { name: 'postgres-mcp',   cost: 521.45,  bar: 16,  delta: '+2%',  alert: false },
  { name: 'notion',         cost: 403.22,  bar: 12,  delta: '+30%', alert: true },
  { name: 'filesystem',     cost: 312.88,  bar: 10,  delta: '−1%',  alert: false },
  { name: 'google-drive',   cost: 198.55,  bar: 6,   delta: '+5%',  alert: false },
  { name: 'linear',         cost: 145.20,  bar: 4,   delta: '+15%', alert: false },
  { name: 'aws-s3',         cost: 89.40,   bar: 3,   delta: '−8%',  alert: false },
  { name: 'stripe',         cost: 45.10,   bar: 2,   delta: '+1%',  alert: false },
]

const fmtUsd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

export function DashboardPreview() {
  return (
    <div className="relative mx-auto max-w-5xl rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/90 to-gray-950/90 shadow-2xl backdrop-blur overflow-hidden">
      {/* Glow accent behind */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-brand-500/20 to-transparent pointer-events-none opacity-50" />

      {/* Window chrome */}
      <div className="relative flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 text-center text-xs text-gray-500 font-mono">
          dashboard.mcpspend.com / acme-corp
        </div>
        <div className="text-xs text-gray-500 hidden sm:block">Last 7 days</div>
      </div>

      <div className="relative p-5 md:p-7 grid gap-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-xs text-gray-500">{k.label}</div>
              <div className="mt-1 text-lg md:text-xl font-semibold text-white tabular-nums">{k.value}</div>
              <div
                className={
                  'mt-0.5 text-xs tabular-nums ' +
                  (k.deltaDir === 'up' ? 'text-amber-400' : 'text-emerald-400')
                }
              >
                {k.deltaDir === 'up' ? '▲' : '▼'} {k.delta}
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500">Daily spend · last 14 days</div>
            <div className="text-xs text-gray-500 hidden sm:block">USD</div>
          </div>
          <SpendChart />
        </div>

        {/* Tools table */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-500">Top MCP tools by cost</div>
            <div className="text-xs text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              3 over budget
            </div>
          </div>
          <div className="space-y-1.5">
            {tools.map((t) => (
              <div key={t.name} className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {t.alert && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                  <span className={'font-mono text-xs truncate ' + (t.alert ? 'text-white' : 'text-gray-300')}>
                    {t.name}
                  </span>
                </div>
                <div className="font-mono text-xs text-white tabular-nums text-right w-20">
                  {fmtUsd(t.cost)}
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={
                      'h-full rounded-full ' +
                      (t.alert
                        ? 'bg-gradient-to-r from-amber-500 to-red-500'
                        : 'bg-gradient-to-r from-brand-500 to-brand-700')
                    }
                    style={{ width: `${t.bar}%` }}
                  />
                </div>
                <div
                  className={
                    'text-xs tabular-nums text-right w-12 ' +
                    (t.delta.startsWith('+') ? 'text-amber-400' : 'text-emerald-400')
                  }
                >
                  {t.delta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function SpendChart() {
  const points = [820, 940, 880, 1100, 1050, 1230, 1180, 1340, 1290, 1480, 1410, 1660, 1580, 1750]
  const max = Math.max(...points)
  const min = Math.min(...points)
  const w = 100
  const h = 24
  const stepX = w / (points.length - 1)
  const scaleY = (v: number) => h - ((v - min) / (max - min)) * h * 0.85 - 2
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(2)} ${scaleY(p).toFixed(2)}`).join(' ')
  const area =
    `M 0 ${scaleY(points[0]).toFixed(2)} ` +
    points.map((p, i) => `L ${(i * stepX).toFixed(2)} ${scaleY(p).toFixed(2)}`).join(' ') +
    ` L ${w} ${h} L 0 ${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-32">
      <defs>
        <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spend-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spend-fill)" />
      <path d={path} fill="none" stroke="url(#spend-stroke)" strokeWidth="0.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={i} cx={i * stepX} cy={scaleY(p)} r="0.4" fill="#0ea5e9" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
