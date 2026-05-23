const steps = [
  {
    n: '01',
    title: 'Install the proxy',
    body: 'One npm install. Drop @mcpspend/proxy in front of your MCP server config. Five lines of code, zero changes to your agent.',
    code: 'npx @mcpspend/proxy add --key sk_live_...',
  },
  {
    n: '02',
    title: 'Route calls through MCPSpend',
    body: 'Every MCP tool call is intercepted, timed, and logged with full context — user, project, customer, latency, tokens.',
    code: '→ tool.call(args)  ✓ logged in 8ms',
  },
  {
    n: '03',
    title: 'See exactly where your spend goes',
    body: 'Live dashboards by team, customer, tool, and workflow. Budget alerts. Audit logs. Export to your warehouse.',
    code: 'dashboard.mcpspend.com  →  real-time',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="py-24 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">How it works</div>
          <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-white">
            Five minutes from install to first insight.
          </h2>
          <p className="mt-4 text-gray-400 text-lg leading-relaxed">
            MCPSpend sits transparently between your agents and your MCP tools. No SDK changes, no proxy wars, no vendor lock-in.
          </p>
        </div>
        <div className="mt-14 space-y-4">
          {steps.map((s) => (
            <div
              key={s.n}
              className="grid md:grid-cols-[auto_1fr_auto] gap-6 items-center rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8"
            >
              <div className="text-brand-400 font-mono text-xl font-semibold tabular-nums">{s.n}</div>
              <div>
                <h3 className="text-white font-semibold text-lg">{s.title}</h3>
                <p className="mt-1 text-gray-400 text-sm leading-relaxed">{s.body}</p>
              </div>
              <pre className="bg-gray-900/80 border border-white/5 rounded-lg px-4 py-3 text-xs text-gray-300 font-mono overflow-x-auto">
                {s.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
