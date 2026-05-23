import {
  CLIENTS,
  ClientDefinition,
  discoverClients,
  readClientConfig,
  unwrapAllServers,
  wrapAllServers,
  writeClientConfig,
  WrapResult,
} from './clients.js'
import { loadConfig, saveConfig } from './config.js'

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

  for (const { client, path } of discovered) {
    const serversKey = client.serversKey || 'mcpServers'
    try {
      const current = readClientConfig(path)
      const { config: next, results } = opts.unwrap
        ? unwrapAllServers(current, serversKey)
        : wrapAllServers(current, serversKey, {
            projectId: opts.projectId,
            endpoint: opts.endpoint,
            agentName: opts.agentName,
          })

      const changed = JSON.stringify(current) !== JSON.stringify(next)

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
      r.status === 'patched' ? '✓ patched'
      : r.status === 'no-changes' ? '· no changes'
      : r.status === 'dry-run' ? '∼ dry-run'
      : `✗ error: ${r.error}`
    lines.push(`  [${r.name}] ${tag}`)
    lines.push(`    ${r.path}`)
    if (r.backupPath) {
      lines.push(`    backup: ${r.backupPath}`)
    }
    for (const s of r.servers) {
      const sym =
        s.status === 'wrapped' ? '+'
        : s.status === 'already-wrapped' ? '='
        : '·'
      const reason = s.reason ? ` (${s.reason})` : ''
      lines.push(`      ${sym} ${s.serverName}${reason}`)
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
      const servers = (cfg[serversKey] as Record<string, { command?: string; args?: string[] }>) || {}
      serversCount = Object.keys(servers).length
      for (const s of Object.values(servers)) {
        const cmdBase = (s.command || '').toLowerCase().split(/[\\/]/).pop() || ''
        if (cmdBase === 'mcpspend' || cmdBase === 'mcpspend.cmd' || cmdBase === 'mcpspend.exe') {
          if ((s.args || [])[0] === 'wrap') wrappedCount++
        }
      }
    } catch {}
    return { client: c.id, name: c.name, path: found.path, detected: true, serversCount, wrappedCount }
  })

  let endpointReachable: boolean | undefined
  let endpointError: string | undefined
  try {
    const url = (cfg.endpoint || 'https://api.mcpspend.com') + '/health'
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 5000)
    const resp = await fetch(url, { signal: ac.signal })
    clearTimeout(timer)
    endpointReachable = resp.ok
    if (!resp.ok) endpointError = `HTTP ${resp.status}`
  } catch (err) {
    endpointReachable = false
    endpointError = (err as Error).message
  }

  return {
    cliVersion,
    apiKeyConfigured: apiKeySource !== 'none',
    apiKeySource,
    endpointReachable,
    endpointError,
    clients,
  }
}

export function formatDoctor(report: DoctorReport): string {
  const lines: string[] = []
  lines.push(`mcpspend v${report.cliVersion}`)
  lines.push('')
  lines.push(`API key:    ${report.apiKeyConfigured ? '✓' : '✗'} (${report.apiKeySource})`)
  lines.push(`Endpoint:   ${report.endpointReachable ? '✓ reachable' : `✗ ${report.endpointError || 'unreachable'}`}`)
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
