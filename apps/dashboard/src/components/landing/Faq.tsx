const faqs = [
  {
    q: 'How does MCPSpend calculate cost per tool call?',
    a: 'Our proxy sees the MCP wire — request and response payloads on stdio. We approximate input/output tokens from JSON size (≈ chars/4) and multiply by your declared model\'s per-token rate. It\'s a useful estimate, not a billing invoice. Direct LLM-layer token tracking is coming via IDE extensions.',
  },
  {
    q: 'What about LLM tokens from Cursor / Claude Code / Copilot subscriptions?',
    a: 'Those tokens live inside the IDE\'s LLM call, not the MCP wire — so our proxy can\'t see them directly. We\'re building VS Code (then Cursor and Windsurf) extensions that hook into the IDE\'s AI layer to report exact token counts per MCP call. Q3 2026 timeline.',
  },
  {
    q: 'Does the proxy add latency to my MCP calls?',
    a: 'The proxy is fire-and-forget. It forwards bytes between your agent and MCP server immediately, then logs metadata to MCPSpend asynchronously. If our API is unreachable, your agent still works — events buffer in memory and drop after 1000 if we can\'t reach the server.',
  },
  {
    q: 'Do you store the tool inputs or outputs themselves?',
    a: 'No. We log only metadata: tool name, server name, model, latency, success/error code, payload size in tokens. The actual arguments (filenames, search queries, document contents) never leave your machine.',
  },
  {
    q: 'Can I export the data?',
    a: 'Yes. Pro+ tiers include CSV export; Team+ includes BigQuery and Snowflake destinations. We don\'t lock you in — your data is yours.',
  },
  {
    q: 'What runtime do I need?',
    a: 'Node.js 18+. The proxy is published as @mcpspend/proxy on npm. One global install, drop it in front of any stdio MCP server.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="py-24 border-t border-white/5">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Frequently asked</div>
        <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-white">
          Honest answers to honest questions.
        </h2>

        <dl className="mt-12 space-y-4">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 open:bg-white/[0.04] transition-colors"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <dt className="text-white font-medium">{f.q}</dt>
                <span className="text-gray-500 transition-transform group-open:rotate-45 text-xl leading-none">+</span>
              </summary>
              <dd className="mt-3 text-sm text-gray-400 leading-relaxed">{f.a}</dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  )
}
