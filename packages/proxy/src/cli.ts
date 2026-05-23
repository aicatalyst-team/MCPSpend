#!/usr/bin/env node
import { loadConfig, saveConfig } from './config.js'
import { runProxy } from './proxy.js'
import { runInit, formatReport, runDoctor, formatDoctor } from './init.js'

const VERSION = '0.3.1'

const HELP = `mcpspend — observability proxy for MCP servers (v${VERSION})

USAGE
  mcpspend init [options]               Auto-detect MCP clients and wrap their servers
  mcpspend doctor                       Diagnose setup (clients, API key, endpoint)
  mcpspend wrap [options] -- <cmd>...   Manually wrap a single MCP server invocation
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

Environment variables: MCPSPEND_API_KEY, MCPSPEND_ENDPOINT, MCPSPEND_PROJECT_ID, MCPSPEND_AGENT_NAME, MCPSPEND_DISABLED=1
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

interface ParsedArgs {
  command: 'wrap' | 'config' | 'init' | 'doctor' | 'help' | 'version'
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
  childCommand?: string
  childArgs: string[]
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: 'help',
    wrapOpts: {},
    initOpts: { clients: [], dryRun: false, unwrap: false },
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
    if (report.clients.some((c) => c.status === 'error')) process.exit(1)
    return
  }

  if (parsed.command === 'doctor') {
    const report = await runDoctor(VERSION)
    process.stdout.write(formatDoctor(report) + '\n')
    if (!report.apiKeyConfigured || !report.endpointReachable) process.exit(1)
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
}

main().catch((err) => {
  process.stderr.write(`mcpspend: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
