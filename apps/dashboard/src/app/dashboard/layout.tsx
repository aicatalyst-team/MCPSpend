'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, auth, ApiError } from '@/lib/api'
import { LiveTicker } from '@/components/dashboard/LiveTicker'

interface Membership {
  role: string
  organization: { id: string; name: string; slug: string; plan: string; callsThisMonth: number; callsLimit: number }
}

interface Me {
  user: { id: string; email: string; name: string | null }
  memberships: Membership[]
}

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/insights', label: 'Insights' },
  { href: '/dashboard/projects', label: 'Projects' },
  { href: '/dashboard/keys', label: 'API keys' },
  { href: '/dashboard/members', label: 'Members' },
  { href: '/dashboard/invitations', label: 'Invitations' },
  { href: '/dashboard/billing', label: 'Billing' },
  { href: '/dashboard/audit', label: 'Audit log' },
  { href: '/dashboard/webhooks', label: 'Webhooks' },
  { href: '/dashboard/account/privacy', label: 'Privacy' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<Me | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!auth.getToken()) { router.push('/login'); return }
    api<Me>('/api/auth/me')
      .then((data) => {
        setMe(data)
        if (!auth.getOrganizationId() && data.memberships[0]) {
          auth.setOrganization(data.memberships[0].organization.id)
        }
        // Probe /api/admin/overview — if it returns 200, surface the Admin tab.
        api('/api/admin/overview')
          .then(() => setIsAdmin(true))
          .catch(() => setIsAdmin(false))
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) { auth.clear(); router.push('/login') }
      })
  }, [router])

  // Close mobile nav when route changes
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

  const activeOrgId = auth.getOrganizationId()
  const activeOrg = me?.memberships.find(m => m.organization.id === activeOrgId)?.organization
  const role = me?.memberships.find(m => m.organization.id === activeOrgId)?.role

  function switchOrg(orgId: string) {
    auth.setOrganization(orgId)
    window.location.reload()
  }

  function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        <div className="h-16 flex items-center px-5 border-b border-white/5">
          <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 text-white font-semibold">
            <Image src="/logo.png" alt="MCPSpend" width={32} height={32} className="w-8 h-8 object-contain" priority />
            MCPSpend
          </Link>
        </div>
        {me && (
          <div className="px-3 pt-3">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 px-2 mb-1">Workspace</label>
            <select
              value={activeOrgId || ''}
              onChange={(e) => switchOrg(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {me.memberships.map((m) => (
                <option key={m.organization.id} value={m.organization.id}>{m.organization.name}</option>
              ))}
            </select>
          </div>
        )}
        <nav className="flex-1 mt-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={
                  'block px-3 py-2 rounded-lg text-sm transition-colors ' +
                  (active
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/5')
                }
              >
                {item.label}
              </Link>
            )
          })}
          {isAdmin && (
            <>
              <div className="border-t border-white/5 my-2" />
              <Link
                href="/dashboard/admin"
                onClick={onNavigate}
                className={
                  'block px-3 py-2 rounded-lg text-sm transition-colors ' +
                  (pathname === '/dashboard/admin'
                    ? 'bg-amber-500/15 text-amber-200 font-medium border border-amber-500/30'
                    : 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/5')
                }
              >
                ★ Platform admin
              </Link>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-white/5">
          {me && (
            <div className="text-xs text-gray-400 px-2 mb-2">
              <div className="truncate">{me.user.email}</div>
              {role && <div className="text-[10px] uppercase tracking-widest text-gray-500 mt-0.5">{role}</div>}
            </div>
          )}
          <button
            onClick={() => { auth.clear(); router.push('/login') }}
            className="w-full text-left px-2 py-1.5 text-xs text-gray-400 hover:text-white rounded hover:bg-white/5 transition-colors"
          >
            Sign out
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 border-r border-white/5 bg-gray-950/50 flex-col z-30">
        <Sidebar />
      </aside>

      {/* Mobile top bar with hamburger */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-gray-950/90 backdrop-blur border-b border-white/5">
        <Link href="/dashboard" className="flex items-center gap-2 text-white font-semibold">
          <Image src="/logo.png" alt="MCPSpend" width={28} height={28} className="w-7 h-7 object-contain" priority />
          MCPSpend
        </Link>
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="text-white p-2 -mr-2 hover:bg-white/5 rounded"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-gray-950 border-r border-white/10 flex flex-col">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="md:pl-60 min-h-screen">
        {activeOrg && (
          <div className="border-b border-white/5 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
            <div>
              <h1 className="text-base md:text-lg font-semibold text-white truncate">{activeOrg.name}</h1>
              <p className="text-xs text-gray-500">
                <span className="uppercase font-semibold text-gray-400">{activeOrg.plan}</span>
                {' · '}
                {activeOrg.callsThisMonth.toLocaleString()} / {activeOrg.callsLimit.toLocaleString()} calls
              </p>
            </div>
          </div>
        )}
        <div className="p-4 md:p-8">{children}</div>
      </main>

      {/* Floating live tool-call ticker — bottom-right, desktop only.
          THE activation moment: when a new user just installed the proxy and
          stares at an empty dashboard, the first event lands here in real-time
          instead of after a polling refresh. */}
      <LiveTicker />
    </div>
  )
}
