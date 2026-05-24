# Security Policy

## Reporting a vulnerability

Please report security issues privately to **security@mcpspend.com**.

We acknowledge within **48 hours** and aim to ship a fix within **7 days** for critical issues. Coordinated disclosure preferred — please give us time to patch before publishing details.

For non-security questions use `support@mcpspend.com`.

---

## Threat model & architecture

MCPSpend is composed of three layers; the threat model is different for each.

### 1. The proxy (`@mcpspend/proxy` — runs on the user's machine)

The proxy is a **local stdio wrapper**. It:

- Spawns the user's **own** MCP server as a child process (`child_process.spawn`) — *not* arbitrary commands. The command + args come from the MCP client config the user wrote (Claude Desktop, Cursor, Windsurf, VS Code, Claude Code) **before** MCPSpend touched anything. We never download, eval, or rewrite the command itself.
- Streams JSON-RPC messages between the client and that child server — observing tool names, server names, latencies, success/error, and payload **sizes**. Payload **contents** never leave the user's machine.
- Sends metadata only (no arguments, no responses) to `https://api.mcpspend.com/v1/ingest` over TLS, authenticated with the user's API key (passed as `MCPSPEND_API_KEY` env var).

**Why automated scanners flag this as "executes system commands":**
that flag fires whenever a Node package uses `child_process.spawn`. Wrapping another process is *the entire purpose* of an MCP proxy — every observability proxy (Helicone, Langfuse, Portkey, our peers) does the equivalent at some layer. The risk model is:

| Concern | Mitigation |
|---|---|
| Arbitrary RCE from a remote attacker | Not possible — spawn args come from the user's local MCP-client config, never from network input. |
| Privilege escalation | The proxy inherits the user's own UID — no `sudo`, no setuid, no daemon. |
| Credential theft | API key read from `MCPSPEND_API_KEY` env. Never logged, never written to disk by the proxy. |
| Tool-arg / response data leak | Tool arguments and tool responses are **not** transmitted — only metadata (tool/server name, latency, success, byte counts). |
| Supply-chain risk | Proxy is MIT, source on GitHub, build is reproducible. Pin a version (`@mcpspend/proxy@0.x.x`) in your config. |

### 2. The hosted API (`api.mcpspend.com`)

- API keys: stored as **SHA-256 hashes** server-side. We cannot reveal a key once issued — only revoke and reissue.
- Passwords: **bcrypt cost factor 12**.
- Secrets at rest (Slack webhook URLs, etc.): **AES-256-GCM** with `APP_ENCRYPTION_KEY`.
- Authentication: JWT for user sessions (15-min refresh window) + API-key bearer tokens for proxy traffic.
- Tenant isolation: every query scopes by `organizationId`. No cross-tenant data path at the query layer.
- No payment-card data ever touches our servers — Stripe Checkout handles all of that and we only see a `stripeCustomerId`.

### 3. The dashboard (`mcpspend.com`)

- HTTPS-only, HSTS enabled.
- CSP headers via `helmet`.
- Cookies: `Secure`, `HttpOnly`, `SameSite=Lax`.
- No third-party analytics until the user **explicitly opts in** via the cookie banner (GDPR ePrivacy compliant).
- GDPR Art. 15 / 17 / 20 self-serve: `/dashboard/account/privacy`.

---

## What we do NOT collect

To make this explicit: we deliberately do not collect, and the proxy does not transmit,

- MCP tool arguments (file paths, prompts, search queries, etc.)
- MCP tool responses (file contents, search results, API responses)
- LLM prompts or completions
- Source code your agent reads
- Files your agent writes
- IP addresses (in tool-call records — only request-level for rate limiting + audit log)

We collect: **the fact that** a tool was called, **which** tool, **how long** it took, **how big** the payload was (bytes / approximate tokens), **whether** it succeeded.

---

## Compliance posture

- **GDPR** — EU-hosted (Hostinger EU region), full data-subject rights via dashboard, DPA available for Enterprise.
- **SOC 2 Type I** — audit in progress with Vanta (Q4 2026, Type II expected Q2 2027).
- **ISO 27001** — on roadmap (H2 2027 post-SOC-2).
- **HIPAA / PHI** — not designed for; email us if you need a BAA + dedicated deployment.

Full controls list and sub-processor table: <https://mcpspend.com/security>.

---

## Public security contacts

- General reports: **security@mcpspend.com**
- Privacy / GDPR: **privacy@mcpspend.com**
- Procurement / DPA: **support@mcpspend.com**
- Disclosure file (machine-readable): <https://mcpspend.com/.well-known/security.txt>

---

## Acknowledgements

We credit (with permission) every researcher who reports a verified vulnerability — name + link in our `THANKS.md`. Bug bounty program planned post-SOC-2.
