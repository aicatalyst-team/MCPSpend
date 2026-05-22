import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-1.5 text-brand-500 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            Beta — Free during launch
          </div>
          <h1 className="text-5xl font-bold tracking-tight">
            See exactly what your<br />
            <span className="text-brand-500">MCP tools cost</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-lg mx-auto">
            A transparent proxy that tracks every tool call, attributes token costs,
            and shows you where your AI budget goes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="bg-gray-800 hover:bg-gray-700 text-gray-100 font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Sign in
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-800 text-left">
          {[
            { stat: '50K', label: 'Free tool calls/month' },
            { stat: '$29', label: 'Pro — 1M calls/month' },
            { stat: '<100ms', label: 'Ingest latency (fire & forget)' },
          ].map(({ stat, label }) => (
            <div key={stat}>
              <div className="text-2xl font-bold text-brand-500">{stat}</div>
              <div className="text-sm text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
