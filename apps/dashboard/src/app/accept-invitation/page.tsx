'use client'
import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, auth, ApiError } from '@/lib/api'

interface InvitationLookup {
  organization: { id: string; name: string; slug: string }
  invitedBy: { email: string; name: string | null }
  email: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  accepted: boolean
  expired: boolean
}

function AcceptInvitation() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [inv, setInv] = useState<InvitationLookup | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!token) { setError('Missing invitation token'); setLoading(false); return }
    api<InvitationLookup>(`/api/invitations/lookup/${encodeURIComponent(token)}`)
      .then(setInv)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Invitation invalid'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleAccept() {
    if (!inv) return
    if (!auth.getToken()) {
      router.push(`/login?next=${encodeURIComponent(`/accept-invitation?token=${token}`)}`)
      return
    }
    setAccepting(true)
    setError('')
    try {
      const res = await api<{ organizationId: string }>('/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      auth.setOrganization(res.organizationId)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to accept')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) return (
    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
  )

  if (error && !inv) return (
    <div className="w-full max-w-sm text-center space-y-4">
      <h1 className="text-2xl font-bold text-white">Invitation invalid</h1>
      <p className="text-red-400 text-sm">{error}</p>
      <Link href="/" className="inline-block text-brand-500 hover:underline text-sm">← Back to mcpspend.com</Link>
    </div>
  )

  if (!inv) return null

  if (inv.expired) return (
    <div className="w-full max-w-sm text-center space-y-4">
      <h1 className="text-2xl font-bold text-white">Invitation expired</h1>
      <p className="text-sm text-gray-400">Ask {inv.invitedBy.name || inv.invitedBy.email} to send a new one.</p>
    </div>
  )

  if (inv.accepted) return (
    <div className="w-full max-w-sm text-center space-y-4">
      <h1 className="text-2xl font-bold text-white">Already accepted</h1>
      <p className="text-sm text-gray-400">This invitation has already been used.</p>
      <Link href="/login" className="inline-block text-brand-500 hover:underline text-sm">Sign in →</Link>
    </div>
  )

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Join {inv.organization.name}</h1>
        <p className="text-sm text-gray-400 mt-2">
          {inv.invitedBy.name || inv.invitedBy.email} invited <span className="text-white">{inv.email}</span> as <span className="uppercase text-brand-400">{inv.role}</span>.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full bg-white text-gray-950 font-semibold py-3 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {accepting ? 'Accepting…' : auth.getToken() ? 'Accept invitation' : 'Sign in to accept'}
        </button>
        {!auth.getToken() && (
          <Link
            href={`/register?invitation=${encodeURIComponent(token)}`}
            className="block text-center w-full bg-white/5 border border-white/10 text-white font-semibold py-3 rounded-lg hover:bg-white/10 transition-colors"
          >
            Create a new account
          </Link>
        )}
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
  )
}

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      }>
        <AcceptInvitation />
      </Suspense>
    </main>
  )
}
