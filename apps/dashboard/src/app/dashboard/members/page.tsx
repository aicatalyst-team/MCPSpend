'use client'
import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

type Role = 'OWNER' | 'ADMIN' | 'MEMBER'

interface Member {
  id: string
  role: Role
  joinedAt: string
  user: { id: string; email: string; name: string | null }
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string>('')

  async function load() {
    setLoading(true)
    try {
      const [m, meRes] = await Promise.all([
        api<Member[]>('/api/organizations/current/members'),
        api<{ user: { id: string } }>('/api/auth/me'),
      ])
      setMembers(m)
      setCurrentUserId(meRes.user.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleRoleChange(memberId: string, role: Role) {
    try {
      await api(`/api/organizations/current/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change role')
    }
  }

  async function handleRemove(memberId: string, isSelf: boolean) {
    const message = isSelf
      ? 'Leave this organization? You will lose access immediately.'
      : 'Remove this member from the organization?'
    if (!confirm(message)) return
    try {
      await api(`/api/organizations/current/members/${memberId}`, { method: 'DELETE' })
      if (isSelf) { window.location.href = '/dashboard' } else { await load() }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Members</h2>
        <p className="text-sm text-gray-400 mt-1">
          Manage who has access to this organization. Use the Invitations page to invite new teammates.
        </p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Joined</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && members.map((m) => {
              const isSelf = m.user.id === currentUserId
              return (
                <tr key={m.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="text-white">{m.user.name || m.user.email}</div>
                    {m.user.name && <div className="text-xs text-gray-500">{m.user.email}</div>}
                    {isSelf && <span className="text-[10px] uppercase tracking-widest text-brand-400 ml-1">(you)</span>}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{new Date(m.joinedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRemove(m.id, isSelf)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      {isSelf ? 'Leave' : 'Remove'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
