'use client'
import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

interface Project {
  id: string
  name: string
  slug: string
  createdAt: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  async function load() {
    setLoading(true)
    try {
      setProjects(await api<Project[]>('/api/projects'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true); setError('')
    try {
      await api<Project>('/api/projects', { method: 'POST', body: JSON.stringify({ name }) })
      setName('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, displayName: string) {
    if (!confirm(`Delete "${displayName}"? All API keys scoped to this project and historical tool calls remain in the database for audit but won't be queryable.`)) return
    try {
      await api(`/api/projects/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Projects</h2>
        <p className="text-sm text-gray-400 mt-1">
          Projects scope your tool-call data inside an organization. Use them to separate environments (prod / staging), products, or customers.
        </p>
      </div>

      <form onSubmit={handleCreate} className="bg-gray-900 border border-white/5 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Create a project</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text" placeholder="e.g. Production, Customer ACME, Internal agent" required maxLength={80}
            value={name} onChange={e => setName(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          />
          <button
            type="submit" disabled={creating || !name}
            className="bg-white text-gray-950 font-semibold px-5 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="bg-gray-900 border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Slug</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && projects.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-500">
                No projects yet. Create your first one above.
              </td></tr>
            )}
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3 text-white">{p.name}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-400">{p.slug}</td>
                <td className="px-5 py-3 text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
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
