import Link from 'next/link'
import Image from 'next/image'

export function Nav() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-gray-950/70 border-b border-white/5">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Image src="/logo.png" alt="MCPSpend" width={36} height={36} className="w-9 h-9 object-contain" priority />
          <span className="text-white">MCPSpend</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
          <a href="/#how" className="hover:text-white transition-colors">How it works</a>
          <a href="/#features" className="hover:text-white transition-colors">Features</a>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/security" className="hover:text-white transition-colors">Security</Link>
          <Link href="/compare" className="hover:text-white transition-colors">Compare</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm bg-white text-gray-950 font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Start free
          </Link>
        </div>
      </nav>
    </header>
  )
}
