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
  id:
    | 'claude-desktop' | 'cursor' | 'windsurf' | 'vscode' | 'vscode-workspace' | 'claude-code'
    | 'zed' | 'continue' | 'cline' | 'goose'
  name: string
  // Absolute paths that may hold this client's MCP config. First existing one wins.
  configPaths: () => string[]
  // Optional directory checks. If a config file doesn't exist yet but ANY of
  // these directories does, we know the client is installed. We then materialise
  // the first configPath with an empty config so init can write into it.
  // Some clients (Windsurf is the canonical example) only create the MCP
  // config file the first time the user adds a server via the UI — without
  // this fallback, init reports "not installed" and the user is stuck.
  installMarkers?: () => string[]
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
    configPaths: () => [
      join(home, '.cursor', 'mcp.json'),
      // Cursor also supports a workspace-scoped config at .cursor/mcp.json
      // in the project. We discover it from process.cwd() so init knows about
      // the project the user is currently in.
      join(process.cwd(), '.cursor', 'mcp.json'),
    ],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    configPaths: () => [
      join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      join(home, '.codeium', 'windsurf-next', 'mcp_config.json'),
    ],
    // Windsurf only creates mcp_config.json after the user adds a server via
    // the UI. The .codeium/windsurf dir exists from the moment Windsurf runs
    // once, and the AppData install dir exists from the install itself.
    installMarkers: () => {
      const markers = [
        join(home, '.codeium', 'windsurf'),
        join(home, '.codeium', 'windsurf-next'),
      ]
      if (isWin) {
        markers.push(join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'Windsurf'))
      } else if (isMac) {
        markers.push('/Applications/Windsurf.app')
      }
      return markers
    },
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
    id: 'vscode-workspace',
    name: 'VS Code (workspace)',
    // Workspace-scoped MCP config that lives inside the project. Cursor also
    // reads this file because Cursor is a VS Code fork, so wrapping it here
    // covers both. We resolve from process.cwd() — `init` should be run from
    // the project root.
    configPaths: () => [join(process.cwd(), '.vscode', 'mcp.json')],
    serversKey: 'servers',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    // User-level config at ~/.claude.json AND project-level `.mcp.json` in
    // the current working directory. The project-level file is the standard
    // way to ship MCP server lists with a repository.
    configPaths: () => [
      join(home, '.claude.json'),
      join(process.cwd(), '.mcp.json'),
    ],
  },
  {
    // Zed editor — fast-growing Rust-based editor with native MCP support.
    // Config lives in ~/.config/zed/settings.json under `context_servers`.
    id: 'zed',
    name: 'Zed',
    configPaths: () => {
      const candidates: string[] = []
      if (isMac) candidates.push(join(home, '.config', 'zed', 'settings.json'))
      else if (isWin) candidates.push(join(appData(), 'Zed', 'settings.json'))
      else candidates.push(join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'zed', 'settings.json'))
      return candidates
    },
    serversKey: 'context_servers',
  },
  {
    // Continue.dev — popular open-source AI coding assistant. Works in both
    // VS Code and JetBrains. Reads MCP config from ~/.continue/config.json
    // under the `experimental.modelContextProtocolServers` key in older
    // versions, `mcpServers` in newer. We support both.
    id: 'continue',
    name: 'Continue.dev',
    configPaths: () => [
      join(home, '.continue', 'config.json'),
      // Workspace-scoped variant
      join(process.cwd(), '.continue', 'config.json'),
    ],
    // Continue stores other settings even when MCP isn't configured, so the
    // file presence alone is the install marker.
  },
  {
    // Cline — VS Code extension (formerly Claude Dev). MCP config lives at
    // ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
    // (similar location under appData on Windows/Linux).
    id: 'cline',
    name: 'Cline (VS Code)',
    configPaths: () => {
      const base = isMac
        ? join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings')
        : isWin
          ? join(appData(), 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings')
          : join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings')
      return [join(base, 'cline_mcp_settings.json')]
    },
  },
  {
    // Goose — Block's open-source AI agent CLI. Config at ~/.config/goose/config.yaml
    // BUT goose also reads JSON via `~/.config/goose/profiles.json` for MCP
    // servers in newer versions. We patch the JSON variant since YAML rewriting
    // is out of scope; Goose users on YAML get a snippet from `mcpspend snippet`.
    id: 'goose',
    name: 'Goose',
    configPaths: () => {
      const base = isWin
        ? join(appData(), 'goose')
        : join(home, '.config', 'goose')
      return [join(base, 'mcp_servers.json'), join(base, 'profiles.json')]
    },
  },
]

export interface DiscoveredClient {
  client: ClientDefinition
  path: string
  // True when we matched via installMarkers (directory exists) but the actual
  // config file is missing. wrapAllServers will write an empty config + the
  // wrapped entries; init's report includes a hint so the user knows.
  bootstrapped?: boolean
}

export function discoverClients(): DiscoveredClient[] {
  const found: DiscoveredClient[] = []
  for (const c of CLIENTS) {
    // Collect EVERY existing config file for this client, not just the first.
    // Claude Code in particular has both a user-level (~/.claude.json) and
    // project-level (./.mcp.json) location and they're independent.
    const existing = c.configPaths().filter(p => existsSync(p))
    if (existing.length > 0) {
      for (const p of existing) {
        found.push({ client: c, path: p })
      }
      continue
    }

    // Fall back to install markers. If the client is installed but has never
    // had a config written, take the first configPath as the destination and
    // mark the discovery as bootstrapped so init creates the file.
    if (c.installMarkers) {
      const installed = c.installMarkers().some(p => existsSync(p))
      if (installed) {
        const paths = c.configPaths()
        if (paths.length > 0) {
          found.push({ client: c, path: paths[0], bootstrapped: true })
        }
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

// True if `pkgArg` is some form of @mcpspend/proxy: bare, @version, or @tag.
//   '@mcpspend/proxy', '@mcpspend/proxy@0.2.1', '@mcpspend/proxy@latest' → true
function isProxyPackageArg(pkgArg: string | undefined): boolean {
  if (!pkgArg) return false
  if (pkgArg === PROXY_PKG) return true
  return pkgArg.startsWith(PROXY_PKG + '@')
}

export function isAlreadyWrapped(entry: McpServerEntry): boolean {
  const cmd = (entry.command || '').toLowerCase()
  const base = cmd.split(/[\\/]/).pop() || cmd
  const args = entry.args || []

  // Shape A: `mcpspend wrap ...`
  if (MCPSPEND_BIN_NAMES.has(base) && args[0] === 'wrap') return true

  // Shape B: `npx [-y] @mcpspend/proxy[@version] wrap ...`
  if (NPX_BIN_NAMES.has(base)) {
    const skipFlag = args[0] === '-y' || args[0] === '--yes' ? 1 : 0
    if (isProxyPackageArg(args[skipFlag]) && args[skipFlag + 1] === 'wrap') return true
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
