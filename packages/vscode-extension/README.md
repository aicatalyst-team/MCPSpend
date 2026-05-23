# MCPSpend for VS Code, Cursor & Windsurf

One-click cost tracking for every MCP server configured on your machine.

This extension is a thin UI on top of [`@mcpspend/proxy`](https://www.npmjs.com/package/@mcpspend/proxy). It detects every supported MCP client (Claude Desktop, Cursor, Windsurf, VS Code, Claude Code) and patches their configs so [MCPSpend](https://mcpspend.com) can attribute tool calls, latency and cost.

## Quick start

1. Install the extension.
2. Open the command palette → **MCPSpend: Set API Key** → paste your key from [mcpspend.com/dashboard/keys](https://mcpspend.com/dashboard/keys).
3. **MCPSpend: Wrap all MCP servers (init)** — your Claude Desktop, Cursor, Windsurf, etc. configs are patched in place (backups left as `*.mcpspend.bak`).
4. Restart the affected clients.

## Commands

| Command | Description |
|---|---|
| `MCPSpend: Set API Key` | Save your API key. Stored in `~/.mcpspend/config.json` (mode `0600`), shared with the CLI proxy. |
| `MCPSpend: Wrap all MCP servers (init)` | Discover & patch every supported MCP client on this machine. |
| `MCPSpend: Restore original MCP configs (unwrap)` | Undo every wrap. Backups are kept. |
| `MCPSpend: Doctor` | Diagnose: API key present? endpoint reachable? per-client wrap status? |
| `MCPSpend: Open dashboard` | Opens [mcpspend.com/dashboard](https://mcpspend.com/dashboard). |

## How it works

For each detected client we rewrite every entry under `mcpServers` (or `servers` for VS Code) to be wrapped by `mcpspend wrap --`. The original `command` + `args` are preserved as the wrapped tail, so the agent's behavior is unchanged. The proxy is fire-and-forget — if our API is unreachable, your MCP server keeps responding normally.

The API key is **not** written into any client config file. It lives only in `~/.mcpspend/config.json` (or `MCPSPEND_API_KEY`). This avoids leaking secrets into dotfile repos.

## Supported on

- VS Code (Microsoft Marketplace)
- Cursor & Windsurf (via [Open VSX](https://open-vsx.org/extension/mcpspend/mcpspend-vscode))

© NewRzs SRL · MIT licensed
