'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'

const LINKS: Array<{ href: string; label: string; external?: boolean }> = [
  { href: '/#how', label: 'How it works' },
  { href: '/#features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/security', label: 'Security' },
  { href: '/compare', label: 'Compare' },
  { href: '/blog', label: 'Blog' },
  { href: '/docs', label: 'API' },
  { href: '/status', label: 'Status' },
]

export function Nav() {
  const [open, setOpen] = useState(false)

  // Close the mobile menu after navigation (Next router doesn't fire a global
  // event here, so we listen for hashchange + popstate as a pragmatic catch).
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('hashchange', close)
    window.addEventListener('popstate', close)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('hashchange', close)
      window.removeEventListener('popstate', close)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-gray-950/70 border-b border-white/5">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Image src="/logo.png" alt="MCPSpend" width={36} height={36} className="w-9 h-9 object-contain" priority />
          <span className="text-white">MCPSpend</span>
        </Link>

        {/* Desktop nav — collapses to hamburger below lg (1024px) so 9 links
            don't overflow on tablets. */}
        <div className="hidden lg:flex items-center gap-5 text-sm text-gray-400">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white transition-colors">
              {l.label}
            </Link>
          ))}
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
          {/* Hamburger — visible below lg only. */}
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden p-2 -mr-2 text-gray-300 hover:text-white transition-colors"
          >
            {open ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile sheet — drops below the nav bar. Closes on link tap because we
          unmount it. Sign-in lives here for phones since the desktop "Sign in"
          link is hidden below sm. */}
      {open && (
        <div className="lg:hidden border-t border-white/5 bg-gray-950/95 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <div className="my-2 border-t border-white/5" />
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
