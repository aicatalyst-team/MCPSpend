# @mcpspend/mcp-server

Query your [MCPSpend](https://mcpspend.com) usage from any MCP client — see your cost, recent sessions, and top tools right in the chat.

## What it does

Exposes 5 tools to your AI agent:

- **`get_today_cost`** — total cost & calls today
- **`get_usage_this_month`** — calls used, plan limit, projected end-of-month
- **`list_top_tools`** — most expensive tools (last N days)
- **`list_recent_sessions`** — recent agent sessions with cost
- **`get_session_details`** — drill into one session, every tool call

Then ask the agent things like *"How much did I spend on AI yesterday?"*, *"What's the most expensive MCP tool we use?"*, *"What did session X do?"* — it'll call these tools and answer with real numbers.

## Install

Get an API key at [mcpspend.com/dashboard/keys](https://mcpspend.com/dashboard/keys), then add the server to whichever MCP client you use:

```json
{
  "mcpServers": {
    "mcpspend": {
      "command": "npx",
      "args": ["-y", "@mcpspend/mcp-server"],
      "env": {
        "MCPSPEND_API_KEY": "mcps_live_xxx"
      }
    }
  }
}
```

Locations:
- Claude Desktop: `%APPDATA%\Claude\claude_desktop_config.json` · `~/Library/Application Support/Claude/claude_desktop_config.json`
- Cursor: `~/.cursor/mcp.json`
- Windsurf: Settings → Cascade → MCP Servers → Add server (UI)
- VS Code: `%APPDATA%\Code\User\mcp.json`
- Claude Code: `.mcp.json` in your project

## Config

| Env var | Purpose |
|---|---|
| `MCPSPEND_API_KEY` | **Required.** Bearer key for your org. |
| `MCPSPEND_ENDPOINT` | Override API endpoint. Default `https://api.mcpspend.com`. |

## Related

- **[`@mcpspend/proxy`](https://www.npmjs.com/package/@mcpspend/proxy)** — the actual tracker; wraps every MCP server you have configured to forward usage to MCPSpend.
- **[mcpspend.com](https://mcpspend.com)** — web dashboard with full history, CSV export, budget alerts.

© NewRzs SRL · MIT licensed
