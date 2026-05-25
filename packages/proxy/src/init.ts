import { platform } from 'node:os'
import {
  CLIENTS,
  ClientDefinition,
  discoverClients,
  isAlreadyWrapped,
  readClientConfig,
  unwrapAllServers,
  wrapAllServers,
  writeClientConfig,
  WrapResult,
} from './clients.js'
import { loadConfig, saveConfig } from './config.js'
import { sendCompatReport, fingerprintConfig, CompatClientReport } from './telemetry.js'

export interface InitOptions {
  apiKey?: string
  projectId?: string
  endpoint?: string
  agentName?: string
  clientFilter?: string[]
  dryRun?: boolean
  unwrap?: boolean
}

export interface ClientReport {
  client: ClientDefinition['id']
  name: string
  path: string
  status: 'patched' | 'no-changes' | 'error' | 'dry-run'
  backupPath?: string
  servers: WrapResult[]
  error?: string
  // True if we created the config file ourselves because the client was
  // installed but had no MCP config yet (mostly Windsurf).
  bootstrapped?: boolean
}

export interface InitReport {
  apiKeyConfigured: boolean
  apiKeySource: 'flag' | 'env' | 'config' | 'none'
  clientsFound: number
  clientsPatched: number
  clients: ClientReport[]
}

export function runInit(opts: InitOptions = {}): InitReport {
  if (opts.apiKey) {
    saveConfig({ apiKey: opts.apiKey })
  }
  if (opts.endpoint) {
    saveConfig({ endpoint: opts.endpoint })
  }

  const cfg = loadConfig()
  const apiKeySource: InitReport['apiKeySource'] = opts.apiKey
    ? 'flag'
    : process.env.MCPSPEND_API_KEY
      ? 'env'
      : cfg.apiKey
        ? 'config'
        : 'none'

  let discovered = discoverClients()
  if (opts.clientFilter && opts.clientFilter.length) {
    const set = new Set(opts.clientFilter)
    discovered = discovered.filter((d) => set.has(d.client.id))
  }

  const clientReports: ClientReport[] = []

  for (const { client, path, bootstrapped } of discovered) {
    const serversKey = client.serversKey || 'mcpServers'
    try {
      const current = readClientConfig(path)

      // Bootstrap-mode: client is installed but has no MCP config yet. We still
      // want to create the file with an empty mcpServers object so the user
      // can add their first server via the UI and have it auto-wrapped on the
      // next `init` run. Unwrap is a no-op here.
      if (bootstrapped && opts.unwrap) {
        clientReports.push({
          client: client.id,
          name: client.name,
          path,
          status: 'no-changes',
          servers: [],
        })
        continue
      }

      const { config: next, results } = opts.unwrap
        ? unwrapAllServers(current, serversKey)
        : wrapAllServers(current, serversKey, {
            projectId: opts.projectId,
            endpoint: opts.endpoint,
            agentName: opts.agentName,
          })

      const changed = bootstrapped || JSON.stringify(current) !== JSON.stringify(next)
      if (bootstrapped && !(next[serversKey] && Object.keys(next[serversKey] as object).length > 0)) {
        // Ensure the key exists in the new file even when empty.
        ;(next as Record<string, unknown>)[serversKey] = {}
      }

      if (opts.dryRun) {
        clientReports.push({
          client: client.id,
          name: client.name,
          path,
          status: 'dry-run',
          servers: results,
        })
        continue
      }

      if (!changed) {
        clientReports.push({
          client: client.id,
          name: client.name,
          path,
          status: 'no-changes',
          servers: results,
        })
        continue
      }

      const backupPath = writeClientConfig(path, next)
      clientReports.push({
        client: client.id,
        name: client.name,
        path,
        status: 'patched',
        backupPath: backupPath || undefined,
        servers: results,
        bootstrapped,
      })
    } catch (err) {
      clientReports.push({
        client: client.id,
        name: client.name,
        path,
        status: 'error',
        servers: [],
        error: (err as Error).message,
      })
    }
  }

  return {
    apiKeyConfigured: !!cfg.apiKey || apiKeySource === 'env',
    apiKeySource,
    clientsFound: discovered.length,
    clientsPatched: clientReports.filter((r) => r.status === 'patched').length,
    clients: clientReports,
  }
}

/**
 * Fire a fire-and-forget anonymous compat report. Caller decides when to call —
 * we don't run it inside runInit() to keep that function pure and testable.
 * Opt out: MCPSPEND_NO_TELEMETRY=1.
 */
export async function reportCompatFromInit(cliVersion: string, init: InitReport): Promise<void> {
  const reports: CompatClientReport[] = init.clients.map((r) => {
    let fp: string | undefined
    let format: 'json' | 'missing' | undefined
    try {
      const parsed = readClientConfig(r.path)
      fp = fingerprintConfig(parsed)
      format = 'json'
    } catch {
      format = 'missing'
    }
    return {
      id: r.client,
      status: r.bootstrapped ? 'bootstrapped' : r.status,
      configFormat: format,
      topLevelKeysFingerprint: fp,
      serverCount: r.servers.length,
      wrappedCount: r.servers.filter((s) => s.status === 'wrapped' || s.status === 'already-wrapped' || s.status === 'rekeyed').length,
    }
  })
  await sendCompatReport({
    cliVersion,
    platform: platform(),
    reports,
  })
}

export function formatReport(report: InitReport, unwrap = false): string {
  const lines: string[] = []
  const action = unwrap ? 'Unwrap' : 'Wrap'

  if (report.clientsFound === 0) {
    lines.push('No supported MCP clients found on this machine.')
    lines.push('')
    lines.push('Looked for:')
    for (const c of CLIENTS) {
      lines.push(`  • ${c.name} — ${c.configPaths().join(', ')}`)
    }
    return lines.join('\n')
  }

  lines.push(`Found ${report.clientsFound} MCP client(s):`)
  for (const r of report.clients) {
    const tag =
      r.status === 'patched' ? (r.bootstrapped ? '✓ bootstrapped (empty config created)' : '✓ patched')
      : r.status === 'no-changes' ? '· no changes'
      : r.status === 'dry-run' ? '∼ dry-run'
      : `✗ error: ${r.error}`
    lines.push(`  [${r.name}] ${tag}`)
    lines.push(`    ${r.path}`)
    if (r.backupPath) {
      lines.push(`    backup: ${r.backupPath}`)
    }
    if (r.bootstrapped && r.servers.length === 0) {
      lines.push(`    (add MCP servers in the client UI — they'll be auto-wrapped next time you run init)`)
    }
    for (const s of r.servers) {
      const sym =
        s.status === 'wrapped' ? '+'
        : s.status === 'rekeyed' ? '↻'
        : s.status === 'already-wrapped' ? '='
        : '·'
      const reasonText = s.status === 'rekeyed' && !s.reason ? ' (key updated to current --key)' : s.reason ? ` (${s.reason})` : ''
      lines.push(`      ${sym} ${s.serverName}${reasonText}`)
    }
  }

  lines.push('')
  if (!report.apiKeyConfigured && !unwrap) {
    lines.push('⚠ No API key configured. Tracking will be disabled until you set one:')
    lines.push('    mcpspend config set apiKey mcps_live_xxx')
    lines.push('  Get a key at https://mcpspend.com/dashboard/keys')
  } else if (!unwrap) {
    lines.push(`API key source: ${report.apiKeySource}`)
  }

  if (action === 'Wrap' && report.clientsPatched > 0) {
    lines.push('')
    lines.push('Restart your MCP clients (Claude Desktop, Cursor, etc.) to pick up the new config.')
  }

  return lines.join('\n')
}

export interface DoctorReport {
  cliVersion: string
  apiKeyConfigured: boolean
  apiKeySource: 'env' | 'config' | 'none'
  endpointReachable?: boolean
  endpointError?: string
  // When the API key resolves, we hit /api/auth/me with it so the doctor can
  // confirm "yes, this key is good, here's the org you'll be writing to".
  // Empty if no key or key was rejected.
  account?: {
    orgName: string
    plan: string
    callsThisMonth: number
    callsLimit: number
  }
  // Most recent call seen — gives users a quick "data is flowing" signal.
  lastCall?: {
    serverName: string
    toolName: string
    calledAt: string
  } | null
  clients: Array<{
    client: ClientDefinition['id']
    name: string
    path?: string
    detected: boolean
    serversCount: number
    wrappedCount: number
  }>
}

export async function runDoctor(cliVersion: string): Promise<DoctorReport> {
  const cfg = loadConfig()
  const apiKeySource: DoctorReport['apiKeySource'] = process.env.MCPSPEND_API_KEY
    ? 'env'
    : cfg.apiKey
      ? 'config'
      : 'none'

  const discovered = discoverClients()
  const discoveredById = new Map(discovered.map((d) => [d.client.id, d]))

  const clients = CLIENTS.map((c) => {
    const found = discoveredById.get(c.id)
    if (!found) {
      return { client: c.id, name: c.name, detected: false, serversCount: 0, wrappedCount: 0 }
    }
    let serversCount = 0
    let wrappedCount = 0
    try {
      const cfg = readClientConfig(found.path)
      const serversKey = c.serversKey || 'mcpServers'
      const servers = (cfg[serversKey] as Record<string, { command: string; args?: string[] }>) || {}
      serversCount = Object.keys(servers).length
      for (const s of Object.values(servers)) {
        if (s && typeof s.command === 'string' && isAlreadyWrapped(s)) wrappedCount++
      }
    } catch {}
    return { client: c.id, name: c.name, path: found.path, detected: true, serversCount, wrappedCount }
  })

  const baseUrl = cfg.endpoint || 'https://api.mcpspend.com'

  let endpointReachable: boolean | undefined
  let endpointError: string | undefined
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 5000)
    const resp = await fetch(baseUrl + '/health', { signal: ac.signal })
    clearTimeout(timer)
    endpointReachable = resp.ok
    if (!resp.ok) endpointError = `HTTP ${resp.status}`
  } catch (err) {
    endpointReachable = false
    endpointError = (err as Error).message
  }

  // Probe the key — gives users actionable confirmation that the key resolves,
  // which org it points at, and current usage. We catch every error so doctor
  // never crashes on a broken backend; account just stays undefined.
  let account: DoctorReport['account']
  let lastCall: DoctorReport['lastCall']
  const key = process.env.MCPSPEND_API_KEY || cfg.apiKey
  if (key && endpointReachable) {
    try {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 5000)
      const r = await fetch(baseUrl + '/api/stats/sessions?limit=1', {
        headers: { Authorization: `Bearer ${key}` },
        signal: ac.signal,
      })
      clearTimeout(timer)
      if (r.ok) {
        const sessions = (await r.json()) as Array<{
          id: string
          startedAt: string
          toolCallCount: number
          totalCostUsd: number
        }>
        if (sessions[0]) {
          // No per-call endpoint here — last session's startedAt is the cheapest
          // proxy for "we've seen activity recently".
          lastCall = {
            serverName: 'session',
            toolName: sessions[0].id,
            calledAt: sessions[0].startedAt,
          }
        } else {
          lastCall = null
        }
      }
    } catch {
      // ignore — best-effort
    }

    // Org/plan probe via /api/auth/me equivalent — API keys reach this through
    // the same auth middleware but only get back their own org details.
    try {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 5000)
      const r = await fetch(baseUrl + '/api/organizations/current', {
        headers: { Authorization: `Bearer ${key}` },
        signal: ac.signal,
      })
      clearTimeout(timer)
      if (r.ok) {
        const org = (await r.json()) as {
          name: string; plan: string; callsThisMonth: number; callsLimit: number
        }
        account = {
          orgName: org.name,
          plan: org.plan,
          callsThisMonth: org.callsThisMonth,
          callsLimit: org.callsLimit,
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    cliVersion,
    apiKeyConfigured: apiKeySource !== 'none',
    apiKeySource,
    endpointReachable,
    endpointError,
    account,
    lastCall,
    clients,
  }
}

export function formatDoctor(report: DoctorReport): string {
  const lines: string[] = []
  lines.push(`mcpspend v${report.cliVersion}`)
  lines.push('')
  lines.push(`API key:    ${report.apiKeyConfigured ? '✓' : '✗'} (${report.apiKeySource})`)
  lines.push(`Endpoint:   ${report.endpointReachable ? '✓ reachable' : `✗ ${report.endpointError || 'unreachable'}`}`)

  if (report.account) {
    const a = report.account
    const pct = a.callsLimit > 0 ? Math.round((a.callsThisMonth / a.callsLimit) * 100) : 0
    lines.push(`Account:    ✓ ${a.orgName} (${a.plan})`)
    lines.push(`Usage:      ${a.callsThisMonth.toLocaleString()} / ${a.callsLimit.toLocaleString()} calls this month (${pct}%)`)
  } else if (report.apiKeyConfigured && report.endpointReachable) {
    lines.push(`Account:    ✗ API key was rejected — generate a new one at https://mcpspend.com/dashboard/keys`)
  }

  if (report.lastCall) {
    const when = report.lastCall.calledAt
    const ago = humanAgo(new Date(when))
    lines.push(`Last call:  ${ago}`)
  } else if (report.account) {
    lines.push(`Last call:  none yet — make any tool call in your MCP client and it shows up here within seconds`)
  }

  lines.push('')
  lines.push('Clients:')
  for (const c of report.clients) {
    if (!c.detected) {
      lines.push(`  · ${c.name} — not installed`)
      continue
    }
    const wrap = c.serversCount === 0 ? 'no servers configured' : `${c.wrappedCount}/${c.serversCount} wrapped`
    lines.push(`  ✓ ${c.name} — ${wrap}`)
    if (c.path) lines.push(`    ${c.path}`)
  }
  if (!report.apiKeyConfigured) {
    lines.push('')
    lines.push('Next: mcpspend config set apiKey mcps_live_xxx  (get one at https://mcpspend.com/dashboard/keys)')
  }
  return lines.join('\n')
}

function humanAgo(d: Date): string {
  const ms = Date.now() - d.getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}
