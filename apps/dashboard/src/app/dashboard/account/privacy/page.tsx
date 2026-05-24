'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, apiDownload, auth, ApiError } from '@/lib/api'

interface DeleteBlocker {
  organizationId: string
  name: string
  reason: string
}

export default function AccountPrivacyPage() {
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [downloadErr, setDownloadErr] = useState<string | null>(null)

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)
  const [blockers, setBlockers] = useState<DeleteBlocker[] | null>(null)

  async function handleDownload() {
    setDownloadErr(null)
    setDownloading(true)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      await apiDownload(
        '/api/account/data-export',
        `mcpspend-data-${stamp}.json`,
        { method: 'POST' },
      )
    } catch (err) {
      setDownloadErr(err instanceof ApiError ? err.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete() {
    if (confirmText !== 'DELETE') return
    setDeleteErr(null)
    setBlockers(null)
    setDeleting(true)
    try {
      await api('/api/account/delete', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      auth.clear()
      router.push('/login?deleted=1')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const payload = err.payload as { blockers?: DeleteBlocker[] } | null
        setBlockers(payload?.blockers ?? [])
        setDeleteErr('Transfer ownership of the organizations below before deleting your account.')
      } else {
        setDeleteErr(err instanceof ApiError ? err.message : 'Delete failed')
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Privacy &amp; data rights</h2>
        <p className="text-sm text-gray-400 mt-1">
          Exercise your GDPR Art. 15 / 17 / 20 rights directly from here. For the
          full policy see{' '}
          <Link href="/legal/data-rights" className="text-brand-400 hover:underline">
            /legal/data-rights
          </Link>
          .
        </p>
      </div>

      {/* Art. 15 + 20 — access + portability */}
      <section className="rounded-2xl border border-white/10 bg-gray-900 p-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-xs font-mono px-2 py-0.5 rounded border border-brand-500/30 bg-brand-500/10 text-brand-300">
            GDPR Art. 15 + 20
          </span>
          <h3 className="text-lg font-semibold text-white">Download my data</h3>
        </div>
        <p className="mt-3 text-sm text-gray-400">
          Returns a single JSON file with your profile, every organization you
          belong to, invitations you sent, API keys you created, and (for orgs you
          OWN) the audit log plus the 10,000 most recent tool calls. For larger
          tool-call exports use{' '}
          <Link href="/dashboard/billing" className="text-brand-400 hover:underline">
            Pro CSV export
          </Link>
          .
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-white text-gray-950 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {downloading ? 'Preparing…' : 'Download my data (JSON)'}
          </button>
          {downloadErr && (
            <span className="text-sm text-red-400">{downloadErr}</span>
          )}
        </div>
      </section>

      {/* Art. 17 — erasure */}
      <section className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-xs font-mono px-2 py-0.5 rounded border border-red-500/40 bg-red-500/15 text-red-300">
            GDPR Art. 17
          </span>
          <h3 className="text-lg font-semibold text-white">Delete my account</h3>
        </div>
        <p className="mt-3 text-sm text-gray-300">
          Immediately anonymises your profile (email replaced, password cleared,
          API keys revoked, sessions ended). Audit log entries are retained under
          Art. 17 §3(b) for legal record; tool-call history is hard-purged within
          30 days. This cannot be undone after the grace window.
        </p>
        <p className="mt-2 text-sm text-amber-300">
          If you are the sole OWNER of an organization you must transfer ownership
          first — go to{' '}
          <Link href="/dashboard/members" className="underline">
            Members
          </Link>{' '}
          and promote another member to OWNER.
        </p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs uppercase tracking-widest text-gray-400">
            Type <span className="text-red-300 font-mono">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full max-w-xs bg-gray-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-red-500"
          />
          <div>
            <button
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Delete my account permanently'}
            </button>
          </div>
          {deleteErr && (
            <p className="text-sm text-red-300">{deleteErr}</p>
          )}
          {blockers && blockers.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-200">
              {blockers.map((b) => (
                <li key={b.organizationId}>
                  <strong className="text-amber-100">{b.name}</strong> — {b.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-sm text-gray-400">
        <h3 className="text-white font-semibold mb-2">Other requests</h3>
        <p>
          For rectification beyond what the dashboard exposes, restriction of
          processing, or objections, email{' '}
          <a href="mailto:privacy@mcpspend.com" className="text-brand-400 hover:underline">
            privacy@mcpspend.com
          </a>
          . We respond within 30 days (Art. 12 §3) — usually faster.
        </p>
      </section>
    </div>
  )
}
