'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, auth, ApiError } from '@/lib/api'

interface CompleteSetupResponse {
  user: { id: string; email: string; name: string | null }
  memberships: { role: string; organization: { id: string; name: string; slug: string; plan: string } }[]
  activeOrganizationId: string | null
  token: string
}

function SetupAccountInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const sessionId = searchParams.get('session_id') // from Stripe success URL
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [waiting, setWaiting] = useState(false)

  // If we arrived from Stripe with a session_id but no token, the webhook is
  // still being processed. Show a friendly "we're setting up your account" state.
  useEffect(() => {
    if (!token && sessionId) setWaiting(true)
  }, [token, sessionId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords don\'t match'); return }
    setLoading(true); setError('')
    try {
      const data = await api<CompleteSetupResponse>('/api/auth/complete-setup', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      auth.setSession(data.token, data.activeOrganizationId)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Setup failed — try again or email support@mcpspend.com')
    } finally {
      setLoading(false)
    }
  }

  if (waiting) return (
    <div className="w-full max-w-md text-center space-y-6">
      <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <div>
        <h1 className="text-2xl font-bold text-white">Setting up your account…</h1>
        <p className="mt-3 text-sm text-gray-400">
          Payment confirmed. We&apos;re finalizing your workspace and sending you a magic link.
          Check your email in a few seconds — it usually arrives within 30s.
        </p>
      </div>
      <p className="text-xs text-gray-500">
        Didn&apos;t receive it after 2 minutes? Email <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>.
      </p>
    </div>
  )

  if (!token) return (
    <div className="w-full max-w-md text-center space-y-4">
      <h1 className="text-2xl font-bold text-white">Setup link missing</h1>
      <p className="text-sm text-gray-400">
        Open the magic link from your welcome email, or contact{' '}
        <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>.
      </p>
    </div>
  )

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Set your password</h1>
        <p className="mt-2 text-sm text-gray-400">
          Your subscription is active. Pick a password to access your dashboard.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password" placeholder="Password (min 8 chars)" required minLength={8}
          autoComplete="new-password"
          value={password} onChange={e => setPassword(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
        />
        <input
          type="password" placeholder="Confirm password" required minLength={8}
          autoComplete="new-password"
          value={confirm} onChange={e => setConfirm(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? 'Setting password…' : 'Set password & sign in'}
        </button>
      </form>
    </div>
  )
}

export default function SetupAccountPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      }>
        <SetupAccountInner />
      </Suspense>
    </main>
  )
}
