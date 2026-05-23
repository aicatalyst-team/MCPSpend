'use client'
import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
  project: { id: string; name: string } | null
  createdBy: { id: string; email: string; name: string | null }
}

interface Project { id: string; name: string }

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState<{ plaintext: string; name: string } | null>(null)

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', projectId: '' })

  async function load() {
    setLoading(true)
    try {
      const [k, p] = await Promise.all([
        api<ApiKey[]>('/api/keys'),
        api<Project[]>('/api/projects'),
      ])
      setKeys(k)
      setProjects(p)
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
      const created = await api<ApiKey & { plaintext: string }>('/api/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          projectId: form.projectId || undefined,
        }),
      })
      setNewKey({ plaintext: created.plaintext, name: created.name })
      setForm({ name: '', projectId: '' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this key? Any proxy using it will stop working immediately.')) return
    try {
      await api(`/api/keys/${id}/revoke`, { method: 'POST' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke')
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white">API keys</h2>
        <p className="text-sm text-gray-400 mt-1">
          Used by the MCPSpend proxy to authenticate. Each key shows its prefix only — the full secret is shown once at creation.
        </p>
      </div>

      {newKey && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
          <h3 className="text-emerald-300 font-semibold text-sm">New API key created — copy it now</h3>
          <p className="text-xs text-emerald-200/80 mt-1">
            This is the only time the full key will be shown. Store it securely (1Password, env var, etc.). If lost, revoke it and create a new one.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 bg-gray-950 border border-emerald-500/30 rounded px-3 py-2 text-sm font-mono text-emerald-300 break-all">
              {newKey.plaintext}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(newKey.plaintext)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded transition-colors"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-xs text-emerald-300/70 hover:text-emerald-300"
          >
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="bg-gray-900 border border-white/5 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Create a new key</h3>
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3">
          <input
            type="text" placeholder="Name (e.g. Production)" required maxLength={80}
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          />
          <select
            value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          >
            <option value="">All projects (org-scoped)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            type="submit" disabled={creating || !form.name}
            className="bg-white text-gray-950 font-semibold px-5 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Creating…' : 'Create key'}
          </button>
        </div>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Prefix</th>
              <th className="px-5 py-3 font-medium">Project</th>
              <th className="px-5 py-3 font-medium">Last used</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && keys.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                No keys yet. Create one above.
              </td></tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3 text-white">{k.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-400">{k.prefix}</td>
                <td className="px-5 py-3 text-gray-400">{k.project?.name ?? <span className="text-gray-600">All</span>}</td>
                <td className="px-5 py-3 text-gray-400">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : <span className="text-gray-600">Never</span>}
                </td>
                <td className="px-5 py-3">
                  {k.revokedAt
                    ? <span className="text-red-400 text-xs font-medium">Revoked</span>
                    : <span className="text-emerald-400 text-xs font-medium">Active</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  {!k.revokedAt && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
