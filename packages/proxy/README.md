# @mcpspend/proxy

One-command observability for [MCP](https://modelcontextprotocol.io) (Model Context Protocol) servers.

Detects every MCP client installed on your machine — Claude Desktop, Cursor, Windsurf, VS Code, Claude Code — and transparently wraps each configured server so MCPSpend can attribute tool calls, latency and cost. The proxy never blocks the MCP wire: if our API is unreachable, your agent keeps working.

## Zero-friction setup — no install needed

```sh
npx @mcpspend/proxy init --key mcps_live_xxx
```

That single command:

1. Saves your API key to `~/.mcpspend/config.json` (mode `0600`).
2. Discovers every supported MCP client config on your machine.
3. Rewrites each `mcpServers` entry to be wrapped by `npx -y @mcpspend/proxy wrap --` (so the moment you restart your MCP client, it auto-fetches the proxy if missing).
4. Leaves a `.mcpspend.bak` backup next to every file it touches.

> Prefer a global binary? `npm install -g @mcpspend/proxy` then use `mcpspend init` — everything below works the same way.

Restart your clients (Claude Desktop, Cursor, Windsurf, etc.) and head to [mcpspend.com](https://mcpspend.com) — calls start showing up within a minute.

Get an API key at [mcpspend.com/dashboard/keys](https://mcpspend.com/dashboard/keys).

## Verify

```sh
npx @mcpspend/proxy doctor
```

Reports API key status, endpoint reachability, and for every detected client: how many MCP servers are configured and how many are wrapped.

## Undo

```sh
npx @mcpspend/proxy init --unwrap
```

Restores every wrapped entry to its original `command` + `args`. The `.mcpspend.bak` files are left in place for paranoia.

## Supported clients

| Client | Config path (detected automatically) |
|---|---|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` · `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| VS Code (user) | `%APPDATA%\Code\User\mcp.json` · `~/.config/Code/User/mcp.json` |
| Claude Code | `~/.claude.json` |

## Manual single-server wrap

If you want to wrap one specific invocation without touching client configs:

```sh
npx @mcpspend/proxy wrap --key mcps_live_xxx -- npx @modelcontextprotocol/server-filesystem /data
```

Or paste this into a client config yourself:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@mcpspend/proxy", "wrap", "--", "npx", "@modelcontextprotocol/server-filesystem", "/Users/me"]
    }
  }
}
```

## Configuration

CLI flags, environment variables, and `~/.mcpspend/config.json` are merged in that order (CLI wins).

| Setting | Flag | Env var | Config key |
|---|---|---|---|
| API key | `--key` | `MCPSPEND_API_KEY` | `apiKey` |
| API endpoint | `--endpoint` | `MCPSPEND_ENDPOINT` | `endpoint` |
| Project ID | `--project` | `MCPSPEND_PROJECT_ID` | `projectId` |
| Agent name | `--agent` | `MCPSPEND_AGENT_NAME` | `agentName` |
| Disable tracking | `--disable` | `MCPSPEND_DISABLED=1` | `disabled: true` |

The API key is **never** written into client config files (which often land in dotfile repos). It lives only in `~/.mcpspend/config.json` (mode `0600`) or `MCPSPEND_API_KEY`.

## Privacy

The proxy reports:

- Tool name (e.g. `read_file`)
- Server name (e.g. `filesystem`)
- Latency, success, error codes
- Approximate input/output sizes (tokens, derived from JSON length)

It does **not** send the actual tool arguments or response bodies to MCPSpend.

## Support

[support@mcpspend.com](mailto:support@mcpspend.com) · [mcpspend.com](https://mcpspend.com)

© NewRzs SRL · CUI RO48756557
