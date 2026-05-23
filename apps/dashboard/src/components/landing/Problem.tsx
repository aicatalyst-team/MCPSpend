const pains = [
  {
    title: 'Your AI costs are a black box',
    body: 'Vendor bills arrive a month late, mixed across teams, projects, and customers. You react instead of plan.',
  },
  {
    title: 'No attribution, no accountability',
    body: 'You can\'t answer "which customer cost us $4k last week" or "which workflow is bleeding tokens." Engineering ships blind.',
  },
  {
    title: 'No audit trail when you need one',
    body: 'When finance, security, or a customer asks "what did this AI actually do last Tuesday at 3pm?" — you have no answer. Logs are scattered, lossy, or missing.',
  },
]

export function Problem() {
  return (
    <section id="problem" className="py-24 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">The problem</div>
          <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-white">
            MCP tools are eating budgets nobody is tracking.
          </h2>
          <p className="mt-4 text-gray-400 text-lg leading-relaxed">
            Every team building with agents is hitting the same wall: tool calls explode in volume, costs spike unpredictably, and there&apos;s no clean way to see what&apos;s happening until the invoice lands.
          </p>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-4">
          {pains.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/20 hover:bg-white/[0.04] transition-colors"
            >
              <div className="text-red-400 text-2xl mb-4">✕</div>
              <h3 className="text-white font-semibold text-lg">{p.title}</h3>
              <p className="mt-2 text-gray-400 text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
