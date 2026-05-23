'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, auth, ApiError } from '@/lib/api'

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
  { href: '/dashboard/keys', label: 'API keys' },
  { href: '/dashboard/members', label: 'Members' },
  { href: '/dashboard/invitations', label: 'Invitations' },
  { href: '/dashboard/billing', label: 'Billing' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    if (!auth.getToken()) { router.push('/login'); return }
    api<Me>('/api/auth/me')
      .then((data) => {
        setMe(data)
        if (!auth.getOrganizationId() && data.memberships[0]) {
          auth.setOrganization(data.memberships[0].organization.id)
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) { auth.clear(); router.push('/login') }
      })
  }, [router])

  const activeOrgId = auth.getOrganizationId()
  const activeOrg = me?.memberships.find(m => m.organization.id === activeOrgId)?.organization
  const role = me?.memberships.find(m => m.organization.id === activeOrgId)?.role

  function switchOrg(orgId: string) {
    auth.setOrganization(orgId)
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-white/5 bg-gray-950/50 flex flex-col">
        <div className="h-16 flex items-center px-5 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-2 text-white font-semibold">
            <Image src="/logo.png" alt="MCPSpend" width={32} height={32} className="w-8 h-8 object-contain" priority />
            MCPSpend
          </Link>
        </div>

        {/* Org switcher */}
        {me && (
          <div className="px-3 pt-3">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 px-2 mb-1">Workspace</label>
            <select
              value={activeOrgId || ''}
              onChange={(e) => switchOrg(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {me.memberships.map((m) => (
                <option key={m.organization.id} value={m.organization.id}>
                  {m.organization.name}
                </option>
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
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden">
        {activeOrg && (
          <div className="border-b border-white/5 px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">{activeOrg.name}</h1>
              <p className="text-xs text-gray-500">
                <span className="uppercase font-semibold text-gray-400">{activeOrg.plan}</span>
                {' · '}
                {activeOrg.callsThisMonth.toLocaleString()} / {activeOrg.callsLimit.toLocaleString()} calls
              </p>
            </div>
          </div>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
