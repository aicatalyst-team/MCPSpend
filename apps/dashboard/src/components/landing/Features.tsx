const features = [
  {
    title: 'Real-time cost tracking',
    body: 'Every tool call attributed in <100ms. No batch jobs, no spreadsheets, no surprises at month-end.',
  },
  {
    title: 'Per-team & per-customer attribution',
    body: 'Tag calls with team, project, customer, or workflow. Slice spend any way your CFO needs it.',
  },
  {
    title: 'Budget alerts & throttling',
    body: 'Set spend caps per team. Get paged before the bill explodes. Optional auto-throttle when limits hit.',
  },
  {
    title: 'SLA & latency monitoring',
    body: 'p50/p95/p99 latency per MCP tool. Know which providers are slow before customers complain.',
  },
  {
    title: 'SOC 2-ready audit logs',
    body: 'Every call logged with full provenance. Immutable, exportable, queryable. Built for compliance from day one.',
  },
  {
    title: 'Open formats, no lock-in',
    body: 'Exports to S3, BigQuery, Snowflake. OpenTelemetry-compatible. Your data, your warehouse.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Features</div>
          <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-white">
            Everything finance, security, and engineering ask for.
          </h2>
        </div>
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-brand-500/30 hover:bg-white/[0.04] transition-colors"
            >
              <h3 className="text-white font-semibold">{f.title}</h3>
              <p className="mt-2 text-gray-400 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
