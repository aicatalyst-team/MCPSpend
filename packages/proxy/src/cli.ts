#!/usr/bin/env node
import { loadConfig, saveConfig } from './config.js'
import { runProxy } from './proxy.js'

const VERSION = '0.1.0'

const HELP = `mcpspend — observability proxy for MCP servers (v${VERSION})

USAGE
  mcpspend wrap [options] -- <command> [args...]
  mcpspend config set <key> <value>
  mcpspend config show
  mcpspend --version
  mcpspend --help

WRAP OPTIONS
  --key <value>            API key (overrides config + MCPSPEND_API_KEY)
  --endpoint <url>         API endpoint (default: https://api.mcpspend.com)
  --project <id>           Attribute calls to this project
  --agent <name>           Agent name reported in dashboards
  --model <name>           Model name for cost attribution (default: mcp-stdio)
  --disable                Run in passthrough mode (no tracking)

EXAMPLES
  # Wrap a stdio MCP server, attribute to a specific project
  mcpspend wrap --key mcps_live_xxx --project prj_abc -- npx @modelcontextprotocol/server-filesystem /data

  # Configure once, then run many wrapped servers without flags
  mcpspend config set apiKey mcps_live_xxx
  mcpspend wrap -- npx @modelcontextprotocol/server-github

Environment variables: MCPSPEND_API_KEY, MCPSPEND_ENDPOINT, MCPSPEND_PROJECT_ID, MCPSPEND_AGENT_NAME, MCPSPEND_DISABLED=1
Config file: ~/.mcpspend/config.json
`

interface ParsedArgs {
  command: 'wrap' | 'config' | 'help' | 'version'
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
  childCommand?: string
  childArgs: string[]
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { command: 'help', wrapOpts: {}, childArgs: [] }

  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help') {
    result.command = 'help'
    return result
  }
  if (argv[0] === '-v' || argv[0] === '--version') {
    result.command = 'version'
    return result
  }

  const cmd = argv[0]
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
