'use client'
import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

type Role = 'ADMIN' | 'MEMBER'

interface Invitation {
  id: string
  email: string
  role: Role
  expiresAt: string
  createdAt: string
  invitedBy: { id: string; email: string; name: string | null }
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{ email: string; role: Role }>({ email: '', role: 'MEMBER' })
  const [newInvitation, setNewInvitation] = useState<{ email: string; url: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await api<Invitation[]>('/api/invitations')
      setInvitations(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      const res = await api<{ invitation: Invitation; acceptUrl: string }>('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({ email: form.email, role: form.role }),
      })
      setNewInvitation({ email: res.invitation.email, url: res.acceptUrl })
      setForm({ email: '', role: 'MEMBER' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to invite')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this invitation?')) return
    try {
      await api(`/api/invitations/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke')
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Invitations</h2>
        <p className="text-sm text-gray-400 mt-1">
          Invite teammates to your organization. They&apos;ll create an account using the invitation link.
        </p>
      </div>

      {newInvitation && (
        <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-5">
          <h3 className="text-brand-300 font-semibold text-sm">Invitation created for {newInvitation.email}</h3>
          <p className="text-xs text-gray-400 mt-1">
            Email delivery is not configured yet — share this link directly with the invitee. Link expires in 14 days.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 bg-gray-950 border border-brand-500/30 rounded px-3 py-2 text-xs font-mono text-brand-300 break-all">
              {newInvitation.url}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(newInvitation.url)}
              className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setNewInvitation(null)}
            className="mt-3 text-xs text-brand-300/70 hover:text-brand-300"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-gray-900 border border-white/5 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Invite a teammate</h3>
        <div className="grid md:grid-cols-[1fr_auto_auto] gap-3">
          <input
            type="email" placeholder="teammate@example.com" required
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          />
          <select
            value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            type="submit" disabled={creating || !form.email}
            className="bg-white text-gray-950 font-semibold px-5 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Invited by</th>
              <th className="px-5 py-3 font-medium">Expires</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && invitations.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                No pending invitations.
              </td></tr>
            )}
            {invitations.map((inv) => (
              <tr key={inv.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3 text-white">{inv.email}</td>
                <td className="px-5 py-3 text-gray-400">{inv.role}</td>
                <td className="px-5 py-3 text-gray-400">
                  {inv.invitedBy.name || inv.invitedBy.email}
                </td>
                <td className="px-5 py-3 text-gray-400">
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
