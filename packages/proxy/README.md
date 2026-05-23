# @mcpspend/proxy

Transparent observability proxy for MCP (Model Context Protocol) servers.

Wraps any stdio MCP server, intercepts JSON-RPC `tools/call` traffic, and reports each call (tool, latency, success, approximate token sizes) to [MCPSpend](https://mcpspend.com) for cost attribution and analytics.

Fire-and-forget: the proxy never blocks the MCP wire — if the MCPSpend API is unreachable, your agent keeps working.

## Install

```sh
npm install -g @mcpspend/proxy
```

## Quick start

1. Sign in at [mcpspend.com](https://mcpspend.com) and create an API key.
2. Configure once:
   ```sh
   mcpspend config set apiKey mcps_live_xxx
   ```
3. Wrap any MCP server you already use:
   ```sh
   mcpspend wrap -- npx @modelcontextprotocol/server-filesystem /path
   ```

## Usage with Claude Desktop / Claude Code

Wherever you have an MCP server configured, prepend `mcpspend wrap --` to the command:

**Before:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/Users/me"]
    }
  }
}
```

**After:**
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "mcpspend",
      "args": ["wrap", "--key", "mcps_live_xxx", "--", "npx", "@modelcontextprotocol/server-filesystem", "/Users/me"]
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
