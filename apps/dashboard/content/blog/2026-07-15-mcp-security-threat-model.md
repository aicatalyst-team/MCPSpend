---
title: "MCP security threat model: what to actually worry about when wrapping a proxy"
excerpt: "Automated scanners flag any tool that uses child_process.spawn as 'critical'. Here's the real threat model for MCP proxies — and what we do about each."
publishedAt: "2026-07-15"
author: "Andrei Sirbu"
tags: ["security", "threat-model", "engineering"]
---

When you make MCPSpend public on GitHub, automated scanners (Socket, Snyk, mcprepository, etc.) start crawling the repo and posting verdicts. One of them gave MCPSpend a `Critical 0/100` score because it flagged `child_process.spawn`. After fixing the obvious doc gaps, we got to `10/100` — still "Critical" in their UI.

But none of those scanners can tell you whether MCPSpend is *actually* safe. They flag patterns, not behavior. So let me walk through the real threat model, because if you're going to run a stdio MCP proxy you should understand what you're trusting.

## The architecture in one paragraph

MCPSpend is a stdio wrapper. When your IDE (Claude Desktop, Cursor, etc.) wants to run an MCP server, it spawns a subprocess. We replace that subprocess command with `npx @mcpspend/proxy wrap -- <original-command>`. We become the subprocess; we then spawn the real MCP server as *our* child; we pipe stdin/stdout between client and server unchanged; we observe what flows by; we send metadata to api.mcpspend.com.

That's it. ~800 lines of TypeScript.

## What automated scanners flag

| Scanner finding | Reality |
|---|---|
| "Uses `child_process.spawn`" | Yes — that's the entire job. We spawn the **user's own** MCP server. Same command they wrote in their config. We do not download, eval, rewrite, or substitute. |
| "Handles sensitive credentials" | Yes — the API key. Read from `MCPSPEND_API_KEY` env var, never logged, sent only to `api.mcpspend.com` over TLS. |
| "Score 0-10/100" | The scanner applies the same multiplier whenever it sees `spawn`. Every observability proxy gets this rating. |

These flags are honest — they describe what the code does. They just don't describe whether it's safe. Safety is in the *details* of how each pattern is used.

## The real threats

### Threat 1: Arbitrary code execution via spawn

**Mitigation:** spawn args come exclusively from the user's local MCP-client config (`claude_desktop_config.json` etc.) — never from network input, never from user-typed prompts during a session. If you trust the contents of your own MCP config file (which you wrote), spawn() inherits that trust.

**Attack surface:** if an attacker could write to your MCP config, they'd have already won regardless of MCPSpend. The proxy doesn't change that exposure.

### Threat 2: Credential theft

**Mitigation:** the API key is read from `process.env.MCPSPEND_API_KEY` or `~/.mcpspend/config.json`. We pass it as a Bearer token to api.mcpspend.com in the Authorization header. It is **never** logged to stdout/stderr (the MCP protocol uses stdout — we'd corrupt the stream). It is **never** written to disk except in the config file the user created.

Server-side: the key is hashed with SHA-256 before storage. We cannot recover a key — only revoke and reissue.

**Attack surface:** another local process with file-read access could grab the config. Same risk as `~/.aws/credentials` or `~/.ssh/`. Lock down your home directory if this is your threat model.

### Threat 3: Data exfiltration via the proxy

**Mitigation:** we transmit metadata only:
- Tool name + server name (you'd see in the request anyway)
- Latency (a timing measurement, not data)
- Success/error flag
- Approximate byte counts for input/output

We do **NOT** transmit:
- Tool arguments (file paths, prompts, queries)
- Tool responses (file contents, search results, API responses)
- LLM prompts or completions
- Source code your agent reads

This is checked by inspecting the actual ingest payload — both in the proxy source (`packages/proxy/src/ingest.ts`) and on the server side. The TypeScript types enforce this; no field carries content.

**Attack surface:** if our code or our server is compromised, the threat would be us starting to log more than we should. We publish SECURITY.md + `/.well-known/security.txt` (RFC 9116) + a public threat model so any audit can verify.

### Threat 4: Supply chain (proxy code itself)

**Mitigation:**
- MIT-licensed proxy with source on GitHub
- Pinned npm version (`@mcpspend/proxy@0.7.0` in MCP configs — never `@latest` for security-sensitive setups)
- Build is reproducible from source
- Published with npm provenance attestation (proves the tarball matches the GitHub source)

**Attack surface:** typical npm supply-chain risk. Use a `package-lock.json`, audit your deps, pin versions.

### Threat 5: Side-channel via timing

**Mitigation:** we measure latency per tool call but only at second granularity in stored data (microseconds aren't preserved). The latency telemetry can't be used to infer payload content.

## What we publish for auditors

- **`SECURITY.md`** in the repo — full threat model + reporting channels
- **`/.well-known/security.txt`** (RFC 9116) — machine-readable disclosure metadata
- **GDPR Art. 15/17/20 self-serve** at `/dashboard/account/privacy`
- **`/legal/sla`** for enterprise procurement
- **`/legal/dpa`** template ready to counter-sign
- **`/api/public/pricing-models`** — public auditable cost math

For a SaaS at our stage (pre-SOC 2 Type I), this is the bar. Vanta SOC 2 audit is in progress, expected complete Q4 2026.

## What we'd do differently if we were paranoid

A user once asked: "what if I want to verify the proxy isn't sending more than you claim?" Three concrete answers:

1. **Run it in `--disable` mode.** That bypasses our entire ingest pipeline — the proxy still wraps but reports nothing. Useful to confirm your MCP setup works correctly before enabling telemetry.

2. **Watch the network traffic with mitmproxy.** The proxy uses HTTPS so you need TLS interception. Run `mitmweb`, install its CA, set `MCPSPEND_ENDPOINT=https://your-mitmproxy/v1/ingest`, then inspect every request body. Everything we send is in plaintext JSON.

3. **Self-host the entire stack.** The proxy + API + dashboard are all open source. Build the Docker images, point the proxy at your own ingest endpoint, never send anything to api.mcpspend.com.

Most users won't do any of this. But the option exists.

## TL;DR

MCPSpend is a transparent stdio wrapper that observes MCP tool calls. The `child_process.spawn` flagged by automated scanners is the entire point of the proxy and is parameterized by user-controlled config, not network input. We send metadata-only telemetry. The API key is the only sensitive credential and it's handled by the same patterns AWS/Stripe/Resend use.

If you wouldn't run a debugger or a process monitor on your machine, don't run our proxy either. If you would, this is a much smaller surface than either.

[Full SECURITY.md](https://github.com/andreisirbu91-lab/MCPSpend/blob/main/SECURITY.md) · [Privacy policy](/privacy) · [SLA](/legal/sla) · [Try free](/register)
