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

// We support two wrap shapes:
//  - npx-first  (default, recommended): command='npx', args=['-y','@mcpspend/proxy','wrap',...]
//     No global install required — works the moment Node is on PATH.
//  - bin-direct (legacy / for users who installed -g @mcpspend/proxy):
//     command='mcpspend', args=['wrap',...]
// `isAlreadyWrapped` accepts BOTH shapes so we don't re-wrap when migrating from
// the old layout, and so users who manually pinned the global binary aren't disturbed.

const MCPSPEND_BIN_NAMES = new Set(['mcpspend', 'mcpspend.cmd', 'mcpspend.exe'])
const NPX_BIN_NAMES = new Set(['npx', 'npx.cmd', 'npx.exe'])
const PROXY_PKG = '@mcpspend/proxy'

function isAlreadyWrapped(entry: McpServerEntry): boolean {
  const cmd = (entry.command || '').toLowerCase()
  const base = cmd.split(/[\\/]/).pop() || cmd
  const args = entry.args || []

  // Shape A: `mcpspend wrap ...`
  if (MCPSPEND_BIN_NAMES.has(base) && args[0] === 'wrap') return true

  // Shape B: `npx [-y] @mcpspend/proxy wrap ...`
  if (NPX_BIN_NAMES.has(base)) {
    const skipFlag = args[0] === '-y' || args[0] === '--yes' ? 1 : 0
    if (args[skipFlag] === PROXY_PKG && args[skipFlag + 1] === 'wrap') return true
  }

  return false
}

/**
 * Find the position of the original command/args after the wrap prefix. Returns
 * the index of the `--` separator, or -1 if the entry isn't wrapped.
 */
function findOriginalCommandStart(entry: McpServerEntry): number {
  if (!isAlreadyWrapped(entry)) return -1
  const args = entry.args || []
  const sepIdx = args.indexOf('--')
  return sepIdx === -1 ? -1 : sepIdx
}

export interface WrapOptions {
  apiKey?: string
  projectId?: string
  endpoint?: string
  agentName?: string
  /**
   * Wrap style:
   *  - 'npx' (default): emits `npx -y @mcpspend/proxy wrap -- <orig>`. Works without a global install.
   *  - 'bin': emits `mcpspend wrap -- <orig>`. Requires `npm i -g @mcpspend/proxy`.
   */
  style?: 'npx' | 'bin'
}

/**
 * Wrap a single MCP server entry. Returns a NEW entry; does not mutate the original.
 *
 * - Keeps `env` untouched.
 * - API key is NOT baked into args (would leak into git-tracked dotfiles). The proxy
 *   reads it from ~/.mcpspend/config.json (mode 0600) or MCPSPEND_API_KEY env.
 */
export function wrapEntry(entry: McpServerEntry, opts: WrapOptions = {}): McpServerEntry {
  const style = opts.style || 'npx'

  const wrapArgs: string[] = ['wrap']
  if (opts.endpoint) wrapArgs.push('--endpoint', opts.endpoint)
  if (opts.projectId) wrapArgs.push('--project', opts.projectId)
  if (opts.agentName) wrapArgs.push('--agent', opts.agentName)
  wrapArgs.push('--', entry.command, ...(entry.args || []))

  if (style === 'bin') {
    return { ...entry, command: 'mcpspend', args: wrapArgs }
  }
  // npx style — prefix wrapArgs with `-y @mcpspend/proxy`.
  return { ...entry, command: 'npx', args: ['-y', PROXY_PKG, ...wrapArgs] }
}

export function unwrapEntry(entry: McpServerEntry): McpServerEntry | null {
  const sepIdx = findOriginalCommandStart(entry)
  if (sepIdx === -1) return null
  const args = entry.args || []
  if (sepIdx + 1 >= args.length) return null
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
    results.push({ serverName: name, status: 'wrapped' as const })
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
