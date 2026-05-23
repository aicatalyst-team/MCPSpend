import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join, dirname } from 'node:path'

export interface McpServerEntry {
  command: string
  args?: string[]
  env?: Record<string, string>
  // Some clients allow extra fields (e.g. disabled). We preserve them as-is.
  [key: string]: unknown
}

export interface ClientConfig {
  mcpServers?: Record<string, McpServerEntry>
  // Preserve unknown top-level keys verbatim.
  [key: string]: unknown
}

export interface ClientDefinition {
  id: 'claude-desktop' | 'cursor' | 'windsurf' | 'vscode' | 'vscode-workspace' | 'claude-code'
  name: string
  // Absolute paths that may hold this client's MCP config. First existing one wins.
  configPaths: () => string[]
  // The JSON shape stores MCP servers under this key. Default: "mcpServers".
  serversKey?: string
}

const home = homedir()
const isWin = platform() === 'win32'
const isMac = platform() === 'darwin'

function appData(): string {
  if (isWin) return process.env.APPDATA || join(home, 'AppData', 'Roaming')
  if (isMac) return join(home, 'Library', 'Application Support')
  return process.env.XDG_CONFIG_HOME || join(home, '.config')
}

export const CLIENTS: ClientDefinition[] = [
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    configPaths: () => [join(appData(), 'Claude', 'claude_desktop_config.json')],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    configPaths: () => [join(home, '.cursor', 'mcp.json')],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    configPaths: () => [
      join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      join(home, '.codeium', 'windsurf-next', 'mcp_config.json'),
    ],
  },
  {
    id: 'vscode',
    name: 'VS Code (user)',
    configPaths: () => {
      const candidates: string[] = []
      if (isWin) {
        candidates.push(join(appData(), 'Code', 'User', 'mcp.json'))
      } else if (isMac) {
        candidates.push(join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json'))
      } else {
        candidates.push(join(home, '.config', 'Code', 'User', 'mcp.json'))
      }
      return candidates
    },
    serversKey: 'servers',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    configPaths: () => [join(home, '.claude.json')],
  },
]

export interface DiscoveredClient {
  client: ClientDefinition
  path: string
}

export function discoverClients(): DiscoveredClient[] {
  const found: DiscoveredClient[] = []
  for (const c of CLIENTS) {
    for (const p of c.configPaths()) {
      if (existsSync(p)) {
        found.push({ client: c, path: p })
        break
      }
    }
  }
  return found
}

export function readClientConfig(path: string): ClientConfig {
  if (!existsSync(path)) return {}
  try {
    const raw = readFileSync(path, 'utf-8')
    if (!raw.trim()) return {}
    return JSON.parse(raw) as ClientConfig
  } catch (err) {
    throw new Error(`Failed to parse ${path}: ${(err as Error).message}`)
  }
}

export function writeClientConfig(path: string, config: ClientConfig, backupSuffix = '.mcpspend.bak'): string {
  mkdirSync(dirname(path), { recursive: true })
  let backupPath: string | undefined
  if (existsSync(path)) {
    backupPath = path + backupSuffix
    if (!existsSync(backupPath)) {
      copyFileSync(path, backupPath)
    }
  }
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
  return backupPath ?? ''
}

export interface WrapResult {
  serverName: string
  status: 'wrapped' | 'already-wrapped' | 'skipped'
  reason?: string
}

const MCPSPEND_BIN_NAMES = new Set(['mcpspend', 'mcpspend.cmd', 'mcpspend.exe'])

function isAlreadyWrapped(entry: McpServerEntry): boolean {
  const cmd = (entry.command || '').toLowerCase()
  const base = cmd.split(/[\\/]/).pop() || cmd
  if (!MCPSPEND_BIN_NAMES.has(base)) return false
  const firstArg = (entry.args || [])[0]
  return firstArg === 'wrap'
}

export interface WrapOptions {
  apiKey?: string
  projectId?: string
  endpoint?: string
  agentName?: string
}

/**
 * Wrap a single MCP server entry with `mcpspend wrap -- <original>`.
 * Returns a NEW entry; does not mutate the original.
 *
 * Strategy:
 * - Keep env untouched.
 * - command becomes "mcpspend".
 * - args = [wrap, --project X (if any), --agent Y (if any), --, <original command>, ...original args]
 *   We deliberately do NOT bake the API key into args — it would land in plaintext config files
 *   committed to git. Users set it via `mcpspend config set apiKey` (stored in ~/.mcpspend/config.json
 *   with 0600 perms) or MCPSPEND_API_KEY env.
 */
export function wrapEntry(entry: McpServerEntry, opts: WrapOptions = {}): McpServerEntry {
  const args: string[] = ['wrap']
  if (opts.endpoint) args.push('--endpoint', opts.endpoint)
  if (opts.projectId) args.push('--project', opts.projectId)
  if (opts.agentName) args.push('--agent', opts.agentName)
  args.push('--', entry.command, ...(entry.args || []))

  const next: McpServerEntry = { ...entry, command: 'mcpspend', args }
  return next
}

export function unwrapEntry(entry: McpServerEntry): McpServerEntry | null {
  if (!isAlreadyWrapped(entry)) return null
  const args = entry.args || []
  const sepIdx = args.indexOf('--')
  if (sepIdx === -1 || sepIdx + 1 >= args.length) return null
  const restored: McpServerEntry = {
    ...entry,
    command: args[sepIdx + 1],
    args: args.slice(sepIdx + 2),
  }
  return restored
}

/**
 * Apply wrapping to all MCP servers in a config. Returns the modified config + per-server results.
 */
export function wrapAllServers(
  config: ClientConfig,
  serversKey: string,
  opts: WrapOptions = {},
): { config: ClientConfig; results: WrapResult[] } {
  const results: WrapResult[] = []
  const servers = (config[serversKey] as Record<string, McpServerEntry> | undefined) || {}
  const next: Record<string, McpServerEntry> = {}

  for (const [name, entry] of Object.entries(servers)) {
    if (!entry || typeof entry !== 'object' || !('command' in entry)) {
      next[name] = entry
      results.push({ serverName: name, status: 'skipped', reason: 'no command field' })
      continue
    }
    if (isAlreadyWrapped(entry)) {
      next[name] = entry
      results.push({ serverName: name, status: 'already-wrapped' })
      continue
    }
    next[name] = wrapEntry(entry, opts)
    results.push({ serverName: name, status: 'wrapped' })
  }

  return { config: { ...config, [serversKey]: next }, results }
}

export function unwrapAllServers(
  config: ClientConfig,
  serversKey: string,
): { config: ClientConfig; results: WrapResult[] } {
  const results: WrapResult[] = []
  const servers = (config[serversKey] as Record<string, McpServerEntry> | undefined) || {}
  const next: Record<string, McpServerEntry> = {}

  for (const [name, entry] of Object.entries(servers)) {
    const restored = unwrapEntry(entry)
    if (restored) {
      next[name] = restored
      results.push({ serverName: name, status: 'wrapped', reason: 'restored to original' })
    } else {
      next[name] = entry
      results.push({ serverName: name, status: 'skipped', reason: 'not wrapped by mcpspend' })
    }
  }

  return { config: { ...config, [serversKey]: next }, results }
}
