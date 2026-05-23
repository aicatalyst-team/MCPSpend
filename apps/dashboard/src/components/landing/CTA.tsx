import Link from 'next/link'

export function CTA() {
  return (
    <section className="py-24 border-t border-white/5">
      <div className="max-w-4xl mx-auto px-6 text-center relative">
        <div className="absolute inset-0 bg-radial-glow pointer-events-none" />
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">
            Stop guessing what AI costs you.
          </h2>
          <p className="mt-4 text-gray-400 text-lg">
            Install in five minutes. Free for the first 100 teams for six months.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="bg-white text-gray-950 font-semibold px-7 py-3.5 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Get started free
            </Link>
            <a
              href="mailto:support@mcpspend.com?subject=Demo%20request"
              className="bg-white/5 border border-white/10 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              Book a demo
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
