# MCPSpend PR Summary Action

A GitHub Action that posts an [MCPSpend](https://mcpspend.com) cost summary as a comment on every pull request. Tells your team what your AI agents have spent in the past week, broken down per MCP tool and server.

## Quickstart

1. Get an MCPSpend API key from [mcpspend.com/dashboard/keys](https://mcpspend.com/dashboard/keys) (free tier 25K calls/mo).
2. Add it as a repo secret: `Settings → Secrets and variables → Actions → New repository secret` named `MCPSPEND_API_KEY`.
3. Drop this file into your repo at `.github/workflows/mcpspend.yml`:

   ```yaml
   name: MCPSpend PR Summary
   on:
     pull_request:
       types: [opened, reopened, synchronize]
   jobs:
     summary:
       runs-on: ubuntu-latest
       permissions:
         pull-requests: write
         contents: read
       steps:
         - uses: andreisirbu91-lab/mcpspend-action@v1
           with:
             api-key: ${{ secrets.MCPSPEND_API_KEY }}
             days: 7
   ```

That's it. Open or push to a PR and a comment appears within seconds.

## What you get

A comment like:

> 🤖 **MCPSpend — agent activity in the last 7 days**
>
> | Metric | Value |
> |---|---|
> | Total cost | **$12.4327** |
> | Tool calls | 8,231 |
> | Tokens (in / out) | 1,240,500 / 320,180 |
>
> **Top tools by cost:**
> - playwright/browser_navigate — $4.81 (1,820 calls)
> - filesystem/read_file — $2.10 (984 calls)
> - github/search_repos — $1.62 (612 calls)
>
> **Top MCP servers:**
> - playwright — $5.42 (2,140 calls)
> - filesystem — $2.10 (984 calls)
> - github — $1.62 (612 calls)

The action is **idempotent** — re-running on the same PR updates the existing comment instead of stacking new ones.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | yes | — | Your MCPSpend API key |
| `days` | no | `7` | Lookback window in days (1–365) |
| `endpoint` | no | `https://api.mcpspend.com` | Override only if you self-host MCPSpend |
| `project-id` | no | _all projects_ | Restrict the summary to a single project |
| `github-token` | no | `${{ github.token }}` | Token to post the comment |

## Permissions

Your workflow needs `pull-requests: write` to post comments. That's covered by the snippet above.

## Cost

This action is free and MIT-licensed. MCPSpend's free tier (25,000 tool calls/month) is enough for most small teams; see [pricing](https://mcpspend.com/pricing).

## Support

- Docs: [mcpspend.com/docs](https://mcpspend.com/docs)
- Issues: <https://github.com/andreisirbu91-lab/MCPSpend/issues>
- Email: support@mcpspend.com
