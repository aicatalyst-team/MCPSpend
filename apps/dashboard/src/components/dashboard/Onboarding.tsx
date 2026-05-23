'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'

interface Project { id: string; name: string; slug: string; createdAt: string }
interface ApiKeySummary {
  id: string; name: string; prefix: string; createdAt: string
  project: { id: string; name: string } | null
  revokedAt: string | null
}

type StepState = 'pending' | 'active' | 'done'

interface InstallTab {
  id: 'claude-desktop' | 'vscode' | 'cursor' | 'windsurf' | 'cli'
  label: string
  hint: string
}

const tabs: InstallTab[] = [
  { id: 'claude-desktop', label: 'Claude Desktop', hint: 'macOS / Windows app' },
  { id: 'vscode',         label: 'VS Code',        hint: 'native MCP support' },
  { id: 'cursor',         label: 'Cursor',         hint: 'Cursor MCP' },
  { id: 'windsurf',       label: 'Windsurf',       hint: 'Codeium / Cascade' },
  { id: 'cli',            label: 'Any stdio MCP',  hint: 'manual wrap' },
]

function configFor(tab: InstallTab['id'], apiKey: string): { path: string; json: string } {
  const wrappedServer = (originalCommand: string, originalArgs: string[]) => ({
    command: 'npx',
    args: [
      '-y', '@mcpspend/proxy', 'wrap',
      '--key', apiKey,
      '--',
      originalCommand,
      ...originalArgs,
    ],
  })

  const example = wrappedServer('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/folder'])

  if (tab === 'claude-desktop') {
    return {
      path: process.platform === 'win32'
        ? '%APPDATA%\\Claude\\claude_desktop_config.json'
        : '~/Library/Application Support/Claude/claude_desktop_config.json',
      json: JSON.stringify({ mcpServers: { filesystem: example } }, null, 2),
    }
  }
  if (tab === 'vscode') {
    return {
      path: '.vscode/mcp.json (workspace) or ~/AppData/Roaming/Code/User/mcp.json (user)',
      json: JSON.stringify({ servers: { filesystem: example } }, null, 2),
    }
  }
  if (tab === 'cursor') {
    return {
      path: '~/.cursor/mcp.json',
      json: JSON.stringify({ mcpServers: { filesystem: example } }, null, 2),
    }
  }
  if (tab === 'windsurf') {
    return {
      path: '~/.codeium/windsurf/mcp_config.json',
      json: JSON.stringify({ mcpServers: { filesystem: example } }, null, 2),
    }
  }
  return {
    path: 'Any command line',
    json: `npx -y @mcpspend/proxy wrap \\\n  --key ${apiKey} \\\n  -- npx -y @modelcontextprotocol/server-filesystem /path/to/folder`,
  }
}

export function Onboarding() {
  const [projects, setProjects] = useState<Project[]>([])
  const [keys, setKeys] = useState<ApiKeySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<InstallTab['id']>('claude-desktop')
  const [revealKey, setRevealKey] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [p, k] = await Promise.all([
        api<Project[]>('/api/projects'),
        api<ApiKeySummary[]>('/api/keys'),
      ])
      setProjects(p)
      setKeys(k.filter(x => !x.revokedAt))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hasProject = projects.length > 0
  const hasKey = keys.length > 0
  const step1: StepState = hasProject ? 'done' : 'active'
  const step2: StepState = !hasProject ? 'pending' : hasKey ? 'done' : 'active'
  const step3: StepState = !hasKey ? 'pending' : 'active'

  const newestKey = keys[0]

  async function createQuickKey() {
    if (!hasProject) return
    try {
      const created = await api<{ plaintext: string; prefix: string }>('/api/keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Default', projectId: projects[0].id }),
      })
      setRevealKey(created.plaintext)
      await load()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Get started</h2>
        <p className="text-sm text-gray-400 mt-1">
          Three steps and you&apos;ll see your first MCP tool call appear here in real time.
        </p>
      </div>

      <Step number={1} state={step1} title="Create a project">
        {hasProject ? (
          <p className="text-sm text-gray-400">
            ✓ <span className="text-white">{projects[0].name}</span>{projects.length > 1 && ` and ${projects.length - 1} more`}.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-400 flex-1">A project groups tool-call data — e.g. &quot;Production&quot; or &quot;Customer ACME&quot;.</p>
            <Link
              href="/dashboard/projects"
              className="bg-white text-gray-950 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Create project
            </Link>
          </div>
        )}
      </Step>

      <Step number={2} state={step2} title="Generate an API key">
        {hasKey ? (
          <div>
            <p className="text-sm text-gray-400">
              ✓ Active key: <code className="font-mono text-xs text-brand-300">{newestKey.prefix}</code>
              {newestKey.project && <> (scoped to <span className="text-white">{newestKey.project.name}</span>)</>}
            </p>
            {revealKey && (
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <p className="text-xs text-emerald-200 mb-2">Copy your key now — this is the only time the full secret is shown:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-950 rounded px-3 py-2 text-xs font-mono text-emerald-300 break-all">{revealKey}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(revealKey)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-2 rounded transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : hasProject ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-400 flex-1">One click — we&apos;ll create a key scoped to your first project.</p>
            <button
              onClick={createQuickKey}
              className="bg-white text-gray-950 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Create API key
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Finish step 1 first.</p>
        )}
      </Step>

      <Step number={3} state={step3} title="Run one command to wire up every MCP client">
        {!hasKey ? (
          <p className="text-sm text-gray-500">Finish step 2 first.</p>
        ) : (
          <Step3Install
            apiKey={revealKey || `${newestKey.prefix}<paste-your-full-key>`}
            keyIsFull={!!revealKey}
            tab={tab}
            setTab={setTab}
          />
        )}
      </Step>
    </div>
  )
}

function Step3Install({ apiKey, keyIsFull, tab, setTab }: {
  apiKey: string
  keyIsFull: boolean
  tab: InstallTab['id']
  setTab: (t: InstallTab['id']) => void
}) {
  const [copied, setCopied] = useState(false)
  const [advanced, setAdvanced] = useState(false)

  const initCommand = `npx @mcpspend/proxy init --key ${apiKey}`

  async function copyInit() {
    await navigator.clipboard.writeText(initCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <p className="text-sm text-gray-400 mb-3">
        Paste this in your terminal. It auto-detects Claude Desktop, Cursor, Windsurf, VS Code and Claude Code on this machine and wraps every MCP server it finds. Backups are kept as <code className="text-xs text-brand-300">.mcpspend.bak</code>.
      </p>

      <div className="bg-gray-950 border border-brand-500/30 rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between bg-brand-500/5">
          <span className="text-[10px] uppercase tracking-widest text-brand-300 font-semibold">Recommended · runs locally, no global install</span>
          <button
            onClick={copyInit}
            disabled={!keyIsFull}
            className={
              'text-xs font-semibold px-3 py-1 rounded transition-colors ' +
              (keyIsFull
                ? copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-500 text-white hover:bg-brand-600'
                : 'bg-white/5 text-gray-500 cursor-not-allowed')
            }
          >
            {copied ? '✓ Copied' : 'Copy command'}
          </button>
        </div>
        <pre className="p-3 text-xs text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap break-all">{initCommand}</pre>
      </div>

      {!keyIsFull && (
        <p className="mt-3 text-xs text-amber-300">
          We only see the key prefix here. To use the full key, click <strong>Create API key</strong> in step 2 (or grab it from <a href="/dashboard/keys" className="underline">API keys</a> on first creation).
        </p>
      )}

      <p className="mt-4 text-xs text-gray-500">
        After it runs, restart Claude Desktop / Cursor / VS Code. Make any tool call — within seconds it lands here.
      </p>

      <button
        type="button"
        onClick={() => setAdvanced(v => !v)}
        className="mt-5 text-xs text-gray-400 hover:text-white underline-offset-2 hover:underline"
      >
        {advanced ? '▾ Hide manual JSON snippets' : '▸ I’d rather paste JSON into a specific client'}
      </button>

      {advanced && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">Pick where you run MCP. Replace <code className="text-brand-300">/path/to/folder</code> with a real directory.</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={
                  'px-3 py-1.5 rounded text-xs font-medium transition-colors ' +
                  (tab === t.id
                    ? 'bg-white text-gray-950'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10')
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <InstallSnippet tab={tab} apiKey={apiKey} />
        </div>
      )}
    </div>
  )
}

function InstallSnippet({ tab, apiKey }: { tab: InstallTab['id']; apiKey: string }) {
  const { path, json } = configFor(tab, apiKey)
  return (
    <div className="bg-gray-950 border border-white/5 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-gray-500">Path</span>
        <code className="text-xs text-gray-300 font-mono">{path}</code>
        <button
          onClick={() => navigator.clipboard.writeText(json)}
          className="text-xs text-brand-400 hover:text-brand-300"
        >
          Copy snippet
        </button>
      </div>
      <pre className="p-3 text-xs text-gray-200 font-mono overflow-x-auto">{json}</pre>
    </div>
  )
}

function Step({ number, state, title, children }: {
  number: number
  state: StepState
  title: string
  children: React.ReactNode
}) {
  const bg = state === 'done'
    ? 'bg-emerald-500/10 border-emerald-500/30'
    : state === 'active'
      ? 'bg-brand-500/10 border-brand-500/30'
      : 'bg-white/[0.02] border-white/10'
  const badge = state === 'done'
    ? 'bg-emerald-500 text-white'
    : state === 'active'
      ? 'bg-brand-500 text-white'
      : 'bg-gray-800 text-gray-500'
  return (
    <section className={`rounded-2xl border p-5 ${bg}`}>
      <header className="flex items-center gap-3 mb-3">
        <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${badge}`}>
          {state === 'done' ? '✓' : number}
        </span>
        <h3 className="text-white font-semibold">{title}</h3>
      </header>
      {children}
    </section>
  )
}
