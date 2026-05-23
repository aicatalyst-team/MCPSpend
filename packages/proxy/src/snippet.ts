// Generates ready-to-paste snippets for clients we cannot auto-patch
// (Windsurf in protobuf mode, custom JSON files, etc.).
//
// The user runs:
//   mcpspend snippet --client windsurf -- npx -y @playwright/mcp@latest
//
// We print:
//   1. The destination path / UI navigation for the chosen client
//   2. The wrapped JSON they should paste

import { wrapEntry, McpServerEntry, WrapOptions } from './clients.js'

export type SnippetClient =
  | 'claude-desktop'
  | 'cursor'
  | 'windsurf'
  | 'vscode'
  | 'vscode-workspace'
  | 'claude-code'
  | 'generic'

export interface SnippetOptions extends WrapOptions {
  client: SnippetClient
  serverName: string
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface SnippetOutput {
  client: SnippetClient
  destination: string
  serversKey: string
  /** Stringified JSON ready to paste, plus the entry's name as the object key. */
  json: string
  /** Plain instructions tailored to the client. */
  instructions: string[]
}

const TEMPLATES: Record<SnippetClient, { destination: string; serversKey: string; instructions: (server: string) => string[] }> = {
  'claude-desktop': {
    destination: '%APPDATA%\\Claude\\claude_desktop_config.json (Windows)  ·  ~/Library/Application Support/Claude/claude_desktop_config.json (macOS)',
    serversKey: 'mcpServers',
    instructions: (s) => [
      'Open the file above (create it if missing).',
      `Add the snippet under "mcpServers" → "${s}".`,
      'Quit Claude Desktop fully and reopen.',
    ],
  },
  cursor: {
    destination: '~/.cursor/mcp.json  (or .cursor/mcp.json in this project for workspace-scoped)',
    serversKey: 'mcpServers',
    instructions: (s) => [
      'Open the file above (create it if missing).',
      `Add the snippet under "mcpServers" → "${s}".`,
      'Reload Cursor (Cmd/Ctrl + Shift + P → "Reload Window").',
    ],
  },
  windsurf: {
    destination: 'Settings → Cascade → MCP Servers → Add server (UI only — Windsurf no longer reads JSON)',
    serversKey: 'mcpServers',
    instructions: (s) => [
      'Recent Windsurf versions store MCP config in a protobuf binary; you have to add the server through the UI.',
      'Open Windsurf → Settings → Cascade → MCP Servers → "Add server".',
      `Use this server name: ${s}`,
      'Paste the command + args from the JSON snippet below into the corresponding fields.',
      'Start a NEW Cascade conversation — the existing one won\'t see the new server until then.',
    ],
  },
  vscode: {
    destination: '%APPDATA%\\Code\\User\\mcp.json (Windows)  ·  ~/.config/Code/User/mcp.json (Linux)  ·  ~/Library/Application Support/Code/User/mcp.json (macOS)',
    serversKey: 'servers',
    instructions: (s) => [
      'Open the file above (create it if missing).',
      `Add the snippet under "servers" → "${s}".`,
      'Reload VS Code.',
    ],
  },
  'vscode-workspace': {
    destination: '.vscode/mcp.json (in your project root)',
    serversKey: 'servers',
    instructions: (s) => [
      'Create .vscode/mcp.json in your project root (if missing).',
      `Add the snippet under "servers" → "${s}".`,
      'Reload VS Code.',
    ],
  },
  'claude-code': {
    destination: '.mcp.json (project root)  or  ~/.claude.json (user-level)',
    serversKey: 'mcpServers',
    instructions: (s) => [
      'For per-project: create .mcp.json in the project root.',
      'For user-global: edit ~/.claude.json (add an "mcpServers" key if missing).',
      `Place the snippet under "mcpServers" → "${s}".`,
      'Restart the Claude Code panel / re-open the conversation.',
    ],
  },
  generic: {
    destination: 'Wherever your MCP client reads its config.',
    serversKey: 'mcpServers',
    instructions: (s) => [
      `Add the snippet below as the value for "${s}" inside your client's mcpServers (or equivalent) object.`,
      'Restart the client.',
    ],
  },
}

export function buildSnippet(opts: SnippetOptions): SnippetOutput {
  const tmpl = TEMPLATES[opts.client]
  const baseEntry: McpServerEntry = { command: opts.command, args: opts.args }
  if (opts.env) baseEntry.env = opts.env

  const wrapped = wrapEntry(baseEntry, {
    projectId: opts.projectId,
    endpoint: opts.endpoint,
    agentName: opts.agentName,
    style: opts.style ?? 'npx',
  })

  const obj = { [opts.serverName]: wrapped }
  const json = JSON.stringify(obj, null, 2)

  return {
    client: opts.client,
    destination: tmpl.destination,
    serversKey: tmpl.serversKey,
    json,
    instructions: tmpl.instructions(opts.serverName),
  }
}

export function formatSnippet(out: SnippetOutput): string {
  const lines: string[] = []
  lines.push('')
  lines.push(`▾ ${out.client.toUpperCase()} — paste-ready snippet`)
  lines.push('')
  lines.push('Destination:')
  lines.push(`  ${out.destination}`)
  lines.push('')
  lines.push('Steps:')
  out.instructions.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`))
  lines.push('')
  lines.push(`JSON (under "${out.serversKey}"):`)
  lines.push('')
  out.json.split('\n').forEach((l) => lines.push('  ' + l))
  lines.push('')
  return lines.join('\n')
}
