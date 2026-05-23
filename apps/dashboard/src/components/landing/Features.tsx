const features = [
  {
    title: 'Real-time tool-call observability',
    body: 'Every MCP call captured in <100ms. Volume, latency, success rate per server and per tool — live, no batch jobs.',
  },
  {
    title: 'Per-team & per-customer attribution',
    body: 'Scope API keys to projects, tag sessions with team or customer. Slice usage any way finance needs.',
  },
  {
    title: 'Cost estimation per model',
    body: 'Each call is priced from payload tokens × your model\'s per-token rate. Approximate but defensible — and improving as we add IDE-layer integrations.',
  },
  {
    title: 'SLA & latency monitoring',
    body: 'p50/p95/p99 latency per MCP tool. Know which providers are slow before your customers complain.',
  },
  {
    title: 'Complete audit logs',
    body: 'Every call logged with full provenance — who, when, what, how much. Immutable, queryable, exportable to your warehouse.',
  },
  {
    title: 'IDE extensions (coming soon)',
    body: 'Native VS Code extension Q3 2026, then Cursor and Windsurf. Direct LLM-token attribution per MCP tool, without an external proxy.',
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
