---
title: "How I auto-detect 5 different MCP client config formats in 200 lines"
excerpt: "Cursor uses one location, Claude Desktop another, Windsurf hides theirs in ~/.codeium, VS Code splits user vs workspace, Claude Code uses project-relative configs. Here's the unified detector."
publishedAt: "2026-06-03"
author: "Andrei Sirbu"
tags: ["engineering", "mcp", "typescript"]
---

When I first shipped MCPSpend's proxy, users had to manually edit JSON config files. The README had 5 sections — one per IDE — each with a slightly different path and slightly different wrapping syntax. Conversion was around 30% (people gave up after misediting a brace).

Version 2 ships `npx @mcpspend/proxy add` — one command that auto-detects every MCP client on the user's machine, lists what it found, and asks for confirmation before rewriting any file. Conversion jumped to ~80%.

This is the detector code, generalised.

## The 5 config locations

| Client | Path (macOS) | Path (Windows) | Schema |
|---|---|---|---|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | `%APPDATA%\Claude\claude_desktop_config.json` | `{ mcpServers: { ... } }` |
| Cursor | `~/.cursor/mcp.json` | `%USERPROFILE%\.cursor\mcp.json` | `{ mcpServers: { ... } }` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `{ mcpServers: { ... } }` |
| VS Code (user) | `~/Library/Application Support/Code/User/mcp.json` | `%APPDATA%\Code\User\mcp.json` | `{ servers: { ... } }` |
| VS Code (workspace) | `<cwd>/.vscode/mcp.json` | `<cwd>\.vscode\mcp.json` | `{ servers: { ... } }` |
| Claude Code (user) | `~/.claude/settings.json` | `%USERPROFILE%\.claude\settings.json` | `{ mcpServers: { ... } }` |
| Claude Code (project) | `<cwd>/.claude/settings.local.json` | (same) | `{ mcpServers: { ... } }` |

Three observations:
1. Three IDEs use `mcpServers` as the root key; VS Code uses `servers` (annoying).
2. Both VS Code and Claude Code have a user vs workspace split.
3. Path resolution differs per OS — every detector branches on `process.platform`.

## The detector shape

The detector returns a typed array of "candidates" — files that exist on disk and look like valid MCP config:

```typescript
interface ClientCandidate {
  id: 'claude-desktop' | 'cursor' | 'windsurf'
      | 'vscode-user' | 'vscode-workspace'
      | 'claude-code-user' | 'claude-code-project'
  label: string
  configPath: string
  rootKey: 'mcpServers' | 'servers'
  serverCount: number  // count of entries in the root key
}

function detectClients(cwd: string): ClientCandidate[]
```

Each candidate's `configPath` is absolute and verified to exist. `serverCount` is read at scan time so the CLI can say "Cursor (3 servers detected)" before asking confirmation.

## The platform helpers

```typescript
import os from 'node:os'
import path from 'node:path'

function homeJoin(...parts: string[]): string {
  return path.join(os.homedir(), ...parts)
}

function appDataDir(): string {
  // macOS
  if (process.platform === 'darwin') {
    return homeJoin('Library', 'Application Support')
  }
  // Windows
  if (process.platform === 'win32') {
    return process.env.APPDATA ?? homeJoin('AppData', 'Roaming')
  }
  // Linux + everything else — follows XDG_CONFIG_HOME or ~/.config
  return process.env.XDG_CONFIG_HOME ?? homeJoin('.config')
}
```

The Linux case is the one most "AI tool" projects get wrong — they hardcode `~/.config` and break for users who customised `XDG_CONFIG_HOME`.

## A single candidate function

Each client has a tiny function that returns the absolute path it expects, and the detector wraps it in a `fs.existsSync` check:

```typescript
import fs from 'node:fs'

function readMcpServerCount(filePath: string, rootKey: string): number {
  try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const root = json?.[rootKey]
    return root && typeof root === 'object' ? Object.keys(root).length : 0
  } catch {
    return 0  // malformed JSON — we'll skip this candidate
  }
}

function makeCandidate(
  id: ClientCandidate['id'],
  label: string,
  configPath: string,
  rootKey: ClientCandidate['rootKey'],
): ClientCandidate | null {
  if (!fs.existsSync(configPath)) return null
  return { id, label, configPath, rootKey, serverCount: readMcpServerCount(configPath, rootKey) }
}
```

## The full detector

```typescript
export function detectClients(cwd: string): ClientCandidate[] {
  const appData = appDataDir()
  return [
    // Claude Desktop
    makeCandidate(
      'claude-desktop',
      'Claude Desktop',
      path.join(appData, 'Claude', 'claude_desktop_config.json'),
      'mcpServers',
    ),
    // Cursor
    makeCandidate(
      'cursor',
      'Cursor',
      homeJoin('.cursor', 'mcp.json'),
      'mcpServers',
    ),
    // Windsurf
    makeCandidate(
      'windsurf',
      'Windsurf',
      homeJoin('.codeium', 'windsurf', 'mcp_config.json'),
      'mcpServers',
    ),
    // VS Code user
    makeCandidate(
      'vscode-user',
      'VS Code (user)',
      path.join(appData, 'Code', 'User', 'mcp.json'),
      'servers',
    ),
    // VS Code workspace (only if running inside a project)
    makeCandidate(
      'vscode-workspace',
      'VS Code (workspace)',
      path.join(cwd, '.vscode', 'mcp.json'),
      'servers',
    ),
    // Claude Code user
    makeCandidate(
      'claude-code-user',
      'Claude Code (user)',
      homeJoin('.claude', 'settings.json'),
      'mcpServers',
    ),
    // Claude Code project
    makeCandidate(
      'claude-code-project',
      'Claude Code (project)',
      path.join(cwd, '.claude', 'settings.local.json'),
      'mcpServers',
    ),
  ].filter((c): c is ClientCandidate => c !== null)
}
```

That's the whole thing — fits in a single file, no dependencies, deterministic. Output:

```
$ npx @mcpspend/proxy add
Detected MCP clients on this machine:
  ✓ Claude Desktop          (3 servers)
  ✓ Cursor                  (5 servers)
  ✓ VS Code (workspace)     (1 server)

Wrap all 9 servers with MCPSpend? [Y/n]
```

## The wrap step

For each chosen server, we rewrite the entry in-place. Backup first (`.mcpspend.bak`), then replace the entry with one that calls our proxy as the actual command + passes the original command + args:

```typescript
function wrap(originalCommand: string, originalArgs: string[], apiKey: string) {
  return {
    command: 'npx',
    args: [
      '-y', '@mcpspend/proxy', 'wrap',
      '--key', apiKey,
      '--',
      originalCommand,
      ...originalArgs,
    ],
  }
}
```

The IDE doesn't know anything has changed — it still launches the wrapped command, still talks stdio JSON-RPC. We sit in the middle.

## Edge cases I hit

A few things took longer than they should have:

1. **Windows path separators in JSON**: VS Code's `mcp.json` can have `\\` escapes. `JSON.parse` handles it, but I almost wrote a custom parser before I caught myself.
2. **VS Code Insiders has a different appdata folder**: separate detection branch for `Code - Insiders`.
3. **Claude Code's settings file uses `mcpServers` not `servers`**: caught only when a user reported they couldn't see the wrap take effect. Test matrix now includes all 7.
4. **A user's Cursor config had MCP servers under a top-level `cursor.mcpServers` key** (custom setup). Now I check both common roots; if neither matches, we skip with a warning instead of crashing.

## Get the whole thing

The actual implementation lives in [`packages/proxy/src/clients.ts`](https://github.com/andreisirbu91-lab/MCPSpend/tree/main/packages/proxy/src) — MIT licensed. The detector logic is ~200 lines including comments. Fork it, copy it, whatever.

If you ship a tool that needs to auto-detect MCP clients, save yourself a weekend.

Next week: how I instrument tool calls without changing payloads, using a transparent stdio proxy.
