'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, auth, ApiError } from '@/lib/api'

interface RegisterResponse {
  user: { id: string; email: string; name: string | null }
  memberships: { role: string; organization: { id: string; name: string; slug: string; plan: string } }[]
  activeOrganizationId: string | null
  token: string
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationToken = searchParams.get('invitation') || undefined

  const [form, setForm] = useState({ email: '', password: '', name: '', organizationName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [invitationInfo, setInvitationInfo] = useState<{ orgName: string; email: string } | null>(null)

  useEffect(() => {
    if (!invitationToken) return
    api<{ organization: { name: string }; email: string; expired: boolean; accepted: boolean }>(
      `/api/invitations/lookup/${encodeURIComponent(invitationToken)}`,
    )
      .then((data) => {
        if (data.expired || data.accepted) {
          setError(data.expired ? 'Invitation expired' : 'Invitation already accepted')
          return
        }
        setInvitationInfo({ orgName: data.organization.name, email: data.email })
        setForm((f) => ({ ...f, email: data.email }))
      })
      .catch(() => setError('Invitation invalid'))
  }, [invitationToken])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await api<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name || undefined,
          organizationName: invitationToken ? undefined : (form.organizationName || undefined),
          invitationToken,
        }),
      })
      auth.setSession(data.token, data.activeOrganizationId)
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          {invitationInfo ? `Join ${invitationInfo.orgName}` : 'Create your account'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {invitationInfo ? `Invited as ${invitationInfo.email}` : 'Free — 25K tool calls/month included'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text" placeholder="Your name (optional)" autoComplete="name"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
        />
        <input
          type="email" placeholder="Email" required autoComplete="email"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          disabled={!!invitationInfo}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500 disabled:opacity-60"
        />
        {!invitationInfo && (
          <input
            type="text" placeholder="Workspace name (optional)" autoComplete="organization"
            value={form.organizationName} onChange={e => setForm(f => ({ ...f, organizationName: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
          />
        )}
        <input
          type="password" placeholder="Password (min 8 chars)" required minLength={8} autoComplete="new-password"
          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? 'Creating account…' : invitationInfo ? 'Accept & create account' : 'Create free account'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-500 hover:underline">Sign in</Link>
      </p>
      <p className="text-center text-xs text-gray-500">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="hover:text-white underline-offset-2 hover:underline">Terms</Link>
        {' '}and{' '}
        <Link href="/privacy" className="hover:text-white underline-offset-2 hover:underline">Privacy Policy</Link>.
      </p>
    </div>
  )
}

export default function Register() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      }>
        <RegisterForm />
      </Suspense>
    </main>
  )
}
