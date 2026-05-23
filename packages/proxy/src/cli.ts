#!/usr/bin/env node
import { loadConfig, saveConfig } from './config.js'
import { runProxy } from './proxy.js'
import { runInit, formatReport, runDoctor, formatDoctor, reportCompatFromInit } from './init.js'
import { buildSnippet, formatSnippet, SnippetClient } from './snippet.js'
import { runHttpBridge } from './http-bridge.js'

const VERSION = '0.5.1'

const HELP = `mcpspend — observability proxy for MCP servers (v${VERSION})

USAGE
  mcpspend init [options]               Auto-detect MCP clients and wrap their servers
  mcpspend doctor                       Diagnose setup (clients, API key, endpoint)
  mcpspend wrap [options] -- <cmd>...   Manually wrap a single MCP server invocation
  mcpspend wrap-http [options]          Wrap a REMOTE HTTP MCP server (Figma, etc.)
                                        Speaks stdio to the client, HTTP to the server.
  mcpspend snippet [options] -- <cmd>...
                                        Print a paste-ready JSON snippet for a
                                        specific client (Windsurf protobuf, custom).
  mcpspend config set <key> <value>
  mcpspend config show
  mcpspend --version | --help

INIT OPTIONS
  --key <value>            Save API key to ~/.mcpspend/config.json before patching
  --project <id>           Attribute calls to this project (baked into wrapped args)
  --endpoint <url>         Override API endpoint (default: https://api.mcpspend.com)
  --agent <name>           Agent name reported in dashboards
  --client <id>            Only patch a specific client (repeatable). IDs:
                           claude-desktop, cursor, windsurf, vscode, claude-code
  --dry-run                Show what would change without writing
  --unwrap                 Restore original (non-wrapped) MCP server configs

WRAP OPTIONS
  --key <value>            API key (overrides config + MCPSPEND_API_KEY)
  --endpoint <url>         API endpoint
  --project <id>           Attribute calls to this project
  --agent <name>           Agent name
  --model <name>           Model name for cost attribution (default: mcp-stdio)
  --disable                Run in passthrough mode (no tracking)

WRAP-HTTP OPTIONS
  --url <url>              Required. Remote MCP endpoint (POSTs JSON-RPC there).
  --key <value>            API key (overrides config + MCPSPEND_API_KEY)
  --endpoint <url>         MCPSpend API endpoint (NOT the remote MCP URL)
  --project <id>           Attribute calls to this project
  --agent <name>           Agent name reported in dashboards
  --model <name>           Model name for cost attribution (default: mcp-http)
  --auth <header>          Pass-through Authorization header to the remote MCP

SNIPPET OPTIONS
  --client <id>            One of: claude-desktop, cursor, windsurf, vscode,
                           vscode-workspace, claude-code, generic. Default: generic.
  --name <name>            Server name in the resulting JSON. Default: inferred from --
  --project <id>           Attribute calls to this project (baked into wrap args)
  --endpoint <url>         API endpoint
  --agent <name>           Agent name
  --style <npx|bin>        Wrap style. Default: npx (no global install required).

EXAMPLES
  # First-time setup: paste your API key, patch every installed MCP client
  mcpspend init --key mcps_live_xxx

  # See what init would change without writing
  mcpspend init --dry-run

  # Restore original configs (removes mcpspend wrapping)
  mcpspend init --unwrap

  # Only patch Cursor and Windsurf
  mcpspend init --client cursor --client windsurf

  # Manual single-server wrap (no client config touched)
  mcpspend wrap --key mcps_live_xxx -- npx @modelcontextprotocol/server-filesystem /data

  # Get a copy-paste snippet for Windsurf (which stores config as protobuf)
  mcpspend snippet --client windsurf --name playwright -- npx -y @playwright/mcp@latest

  # Wrap a REMOTE HTTP MCP server (figma-remote etc.)
  mcpspend wrap-http --url https://mcp.figma.com --key mcps_live_xxx \
    --auth "Bearer FIGMA_TOKEN"

Environment variables: MCPSPEND_API_KEY, MCPSPEND_ENDPOINT, MCPSPEND_PROJECT_ID, MCPSPEND_AGENT_NAME, MCPSPEND_DISABLED=1, MCPSPEND_NO_TELEMETRY=1
Config file: ~/.mcpspend/config.json
`

interface InitArgs {
  apiKey?: string
  projectId?: string
  endpoint?: string
  agentName?: string
  clients: string[]
  dryRun: boolean
  unwrap: boolean
}

interface SnippetArgs {
  client: SnippetClient
  name?: string
  projectId?: string
  endpoint?: string
  agentName?: string
  style: 'npx' | 'bin'
}

interface HttpArgs {
  url?: string
  apiKey?: string
  endpoint?: string
  projectId?: string
  agentName?: string
  model?: string
  auth?: string
}

interface ParsedArgs {
  command: 'wrap' | 'wrap-http' | 'config' | 'init' | 'doctor' | 'snippet' | 'help' | 'version'
  configAction?: 'set' | 'show'
  configKey?: string
  configValue?: string
  wrapOpts: {
    apiKey?: string
    endpoint?: string
    projectId?: string
    agentName?: string
    model?: string
    disabled?: boolean
  }
  initOpts: InitArgs
  snippetOpts: SnippetArgs
  httpOpts: HttpArgs
  childCommand?: string
  childArgs: string[]
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: 'help',
    wrapOpts: {},
    initOpts: { clients: [], dryRun: false, unwrap: false },
    snippetOpts: { client: 'generic', style: 'npx' },
    httpOpts: {},
    childArgs: [],
  }

  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    result.command = 'help'
    return result
  }
  if (argv[0] === '-v' || argv[0] === '--version') {
    result.command = 'version'
    return result
  }

  const cmd = argv[0]

  if (cmd === 'init') {
    result.command = 'init'
    let i = 1
    while (i < argv.length) {
      const a = argv[i]
      const next = argv[i + 1]
      switch (a) {
        case '--key':       result.initOpts.apiKey = next; i += 2; break
        case '--project':   result.initOpts.projectId = next; i += 2; break
        case '--endpoint':  result.initOpts.endpoint = next; i += 2; break
        case '--agent':     result.initOpts.agentName = next; i += 2; break
        case '--client':    result.initOpts.clients.push(next); i += 2; break
        case '--dry-run':   result.initOpts.dryRun = true; i += 1; break
        case '--unwrap':    result.initOpts.unwrap = true; i += 1; break
        default:
          process.stderr.write(`mcpspend: unknown option ${a}\n`)
          process.exit(2)
      }
    }
    return result
  }

  if (cmd === 'doctor') {
    result.command = 'doctor'
    return result
  }

  if (cmd === 'wrap-http') {
    result.command = 'wrap-http'
    let i = 1
    while (i < argv.length) {
      const a = argv[i]
      const next = argv[i + 1]
      switch (a) {
        case '--url':       result.httpOpts.url = next; i += 2; break
        case '--key':       result.httpOpts.apiKey = next; i += 2; break
        case '--endpoint':  result.httpOpts.endpoint = next; i += 2; break
        case '--project':   result.httpOpts.projectId = next; i += 2; break
        case '--agent':     result.httpOpts.agentName = next; i += 2; break
        case '--model':     result.httpOpts.model = next; i += 2; break
        case '--auth':      result.httpOpts.auth = next; i += 2; break
        default:
          process.stderr.write(`mcpspend: unknown option ${a}\n`)
          process.exit(2)
      }
    }
    if (!result.httpOpts.url) {
      process.stderr.write('mcpspend: wrap-http requires --url <https://...>\n')
      process.exit(2)
    }
    return result
  }

  if (cmd === 'snippet') {
    result.command = 'snippet'
    let i = 1
    while (i < argv.length) {
      const a = argv[i]
      if (a === '--') { i++; break }
      const next = argv[i + 1]
      switch (a) {
        case '--client':    result.snippetOpts.client = next as SnippetClient; i += 2; break
        case '--name':      result.snippetOpts.name = next; i += 2; break
        case '--project':   result.snippetOpts.projectId = next; i += 2; break
        case '--endpoint':  result.snippetOpts.endpoint = next; i += 2; break
        case '--agent':     result.snippetOpts.agentName = next; i += 2; break
        case '--style':
          if (next === 'npx' || next === 'bin') result.snippetOpts.style = next
          else { process.stderr.write('mcpspend: --style must be npx or bin\n'); process.exit(2) }
          i += 2; break
        default:
          process.stderr.write(`mcpspend: unknown option ${a}\n`)
          process.exit(2)
      }
    }
    if (i >= argv.length) {
      process.stderr.write('mcpspend: missing command for snippet. Use: mcpspend snippet [options] -- <command> [args...]\n')
      process.exit(2)
    }
    result.childCommand = argv[i]
    result.childArgs = argv.slice(i + 1)
    return result
  }

  if (cmd === 'wrap') {
    result.command = 'wrap'
    let i = 1
    while (i < argv.length) {
      const a = argv[i]
      if (a === '--') { i++; break }
      const next = argv[i + 1]
      switch (a) {
        case '--key':       result.wrapOpts.apiKey = next; i += 2; break
        case '--endpoint':  result.wrapOpts.endpoint = next; i += 2; break
        case '--project':   result.wrapOpts.projectId = next; i += 2; break
        case '--agent':     result.wrapOpts.agentName = next; i += 2; break
        case '--model':     result.wrapOpts.model = next; i += 2; break
        case '--disable':   result.wrapOpts.disabled = true; i += 1; break
        default:
          process.stderr.write(`mcpspend: unknown option ${a}\n`)
          process.exit(2)
      }
    }
    if (i >= argv.length) {
      process.stderr.write('mcpspend: missing command to wrap. Use: mcpspend wrap [options] -- <command> [args...]\n')
      process.exit(2)
    }
    result.childCommand = argv[i]
    result.childArgs = argv.slice(i + 1)
    return result
  }

  if (cmd === 'config') {
    result.command = 'config'
    const action = argv[1]
    if (action === 'show') {
      result.configAction = 'show'
      return result
    }
    if (action === 'set') {
      result.configAction = 'set'
      result.configKey = argv[2]
      result.configValue = argv[3]
      if (!result.configKey || result.configValue === undefined) {
        process.stderr.write('mcpspend: usage: mcpspend config set <key> <value>\n')
        process.exit(2)
      }
      return result
    }
    process.stderr.write(`mcpspend: unknown config action ${action}\n`)
    process.exit(2)
  }

  process.stderr.write(`mcpspend: unknown command ${cmd}\n`)
  process.exit(2)
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))

  if (parsed.command === 'help') {
    process.stdout.write(HELP)
    return
  }

  if (parsed.command === 'version') {
    process.stdout.write(`${VERSION}\n`)
    return
  }

  if (parsed.command === 'init') {
    const report = runInit({
      apiKey: parsed.initOpts.apiKey,
      projectId: parsed.initOpts.projectId,
      endpoint: parsed.initOpts.endpoint,
      agentName: parsed.initOpts.agentName,
      clientFilter: parsed.initOpts.clients.length ? parsed.initOpts.clients : undefined,
      dryRun: parsed.initOpts.dryRun,
      unwrap: parsed.initOpts.unwrap,
    })
    process.stdout.write(formatReport(report, parsed.initOpts.unwrap) + '\n')
    // Fire-and-forget anonymous compat report. Tells us when a client's schema
    // changes so we can ship a fix BEFORE users notice. Opt out via
    // MCPSPEND_NO_TELEMETRY=1. We swallow errors — telemetry is never blocking.
    void reportCompatFromInit(VERSION, report)
    if (report.clients.some((c) => c.status === 'error')) process.exit(1)
    return
  }

  if (parsed.command === 'doctor') {
    const report = await runDoctor(VERSION)
    process.stdout.write(formatDoctor(report) + '\n')
    if (!report.apiKeyConfigured || !report.endpointReachable) process.exit(1)
    return
  }

  if (parsed.command === 'snippet') {
    const inferredName = guessServerName(parsed.childCommand!, parsed.childArgs)
    const out = buildSnippet({
      client: parsed.snippetOpts.client,
      serverName: parsed.snippetOpts.name || inferredName,
      command: parsed.childCommand!,
      args: parsed.childArgs,
      projectId: parsed.snippetOpts.projectId,
      endpoint: parsed.snippetOpts.endpoint,
      agentName: parsed.snippetOpts.agentName,
      style: parsed.snippetOpts.style,
    })
    process.stdout.write(formatSnippet(out) + '\n')
    return
  }

  if (parsed.command === 'config') {
    if (parsed.configAction === 'show') {
      const cfg = loadConfig()
      const masked = cfg.apiKey ? cfg.apiKey.slice(0, 12) + '…' : '(not set)'
      process.stdout.write(JSON.stringify({ ...cfg, apiKey: masked }, null, 2) + '\n')
      return
    }
    if (parsed.configAction === 'set') {
      const k = parsed.configKey!
      const v = parsed.configValue!
      const allowed = ['apiKey', 'endpoint', 'projectId', 'agentName', 'disabled']
      if (!allowed.includes(k)) {
        process.stderr.write(`mcpspend: unknown config key ${k}. Allowed: ${allowed.join(', ')}\n`)
        process.exit(2)
      }
      const updates: Record<string, string | boolean> = {}
      updates[k] = k === 'disabled' ? (v === 'true' || v === '1') : v
      const path = saveConfig(updates)
      process.stdout.write(`Saved ${k} → ${path}\n`)
      return
    }
  }

  if (parsed.command === 'wrap') {
    const cfg = loadConfig(parsed.wrapOpts)
    const code = await runProxy({
      command: parsed.childCommand!,
      args: parsed.childArgs,
      config: cfg,
      model: parsed.wrapOpts.model || process.env.MCPSPEND_MODEL || 'mcp-stdio',
    })
    process.exit(code)
  }

  if (parsed.command === 'wrap-http') {
    const cfg = loadConfig({
      apiKey: parsed.httpOpts.apiKey,
      endpoint: parsed.httpOpts.endpoint,
      projectId: parsed.httpOpts.projectId,
      agentName: parsed.httpOpts.agentName,
    })
    const code = await runHttpBridge({
      url: parsed.httpOpts.url!,
      config: cfg,
      model: parsed.httpOpts.model || process.env.MCPSPEND_MODEL || 'mcp-http',
      remoteAuthHeader: parsed.httpOpts.auth,
    })
    process.exit(code)
  }
}

// Very small heuristic — keeps snippet code self-contained without exporting
// extractServerName from proxy.ts. Same trade-off rules apply: drop versions,
// drop scopes that reduce to "mcp", strip mcp-server- prefixes.
function guessServerName(command: string, args: string[]): string {
  const skip = new Set(['npx', 'npx.cmd', 'uvx', 'pnpx', 'bunx', 'pipx', 'node', 'bun', 'deno', 'python', 'python3'])
  const tokens = [command, ...args].filter((t) => t && !t.startsWith('-') && !skip.has(t.toLowerCase()))
  for (const raw of tokens) {
    let t = raw
    const lastAt = t.lastIndexOf('@')
    if (lastAt > 0) t = t.slice(0, lastAt)
    let scope: string | null = null
    if (t.startsWith('@')) {
      const slash = t.indexOf('/')
      if (slash > 0) { scope = t.slice(1, slash); t = t.slice(slash + 1) }
    }
    t = (t.split(/[\\/]/).pop() || t).replace(/\.(js|cjs|mjs|ts|tsx|py)$/i, '')
    t = t.replace(/^mcp-server-/i, '').replace(/-mcp-server$/i, '')
    t = t.replace(/^server-/i, '').replace(/-server$/i, '')
    t = t.replace(/^mcp-/i, '').replace(/-mcp$/i, '')
    t = t.toLowerCase().trim()
    if (!t || t === 'mcp' || t === 'server') {
      if (scope) return scope.toLowerCase()
      continue
    }
    return t
  }
  return 'mcp-server'
}

main().catch((err) => {
  process.stderr.write(`mcpspend: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
