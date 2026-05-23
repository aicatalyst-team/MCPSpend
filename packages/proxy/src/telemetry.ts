// Anonymous compatibility telemetry.
//
// Why: clients like Windsurf or Cursor occasionally change where or how they
// store MCP config. The moment they do, our `init` silently stops auto-
// patching for that client. We won't hear about it until a user files an
// issue — by then the bad version has shipped to thousands.
//
// Solution: when init/doctor runs, POST a small payload to
//   /api/internal/compat-report
// describing what we found per client. The backend aggregates schema
// fingerprints + version hashes. When a new fingerprint appears for an
// existing client we get an alert and ship a fix.
//
// Payload is anonymous: no user identity, no config contents — only:
//   - cli version (so we know which mcpspend rolled into the wall)
//   - per-client: { id, configFormat, fingerprint, status }
//     where fingerprint = sha256(sorted top-level keys) — leaks zero PII but
//     lets us spot "this file used to have mcpServers, now has serverGroups".
//
// Opt out: MCPSPEND_NO_TELEMETRY=1

import { createHash } from 'node:crypto'

const ENDPOINT_DEFAULT = 'https://api.mcpspend.com/api/internal/compat-report'

export interface CompatClientReport {
  id: string
  status: 'patched' | 'no-changes' | 'error' | 'dry-run' | 'bootstrapped' | 'not-detected'
  configFormat?: 'json' | 'protobuf' | 'binary-unknown' | 'missing'
  // sha256 of sorted top-level keys of the parsed JSON, or 'NA' for non-JSON.
  topLevelKeysFingerprint?: string
  // Just a count, never the values.
  serverCount?: number
  wrappedCount?: number
}

export interface CompatPayload {
  cliVersion: string
  platform: string  // win32 / darwin / linux
  reports: CompatClientReport[]
  errorSummary?: string
}

export function fingerprintConfig(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return 'NA'
  const keys = Object.keys(parsed as object).sort()
  return createHash('sha256').update(keys.join(',')).digest('hex').slice(0, 16)
}

export async function sendCompatReport(payload: CompatPayload, endpoint?: string): Promise<void> {
  if (process.env.MCPSPEND_NO_TELEMETRY === '1') return
  const url = endpoint || process.env.MCPSPEND_COMPAT_ENDPOINT || ENDPOINT_DEFAULT

  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 4000)
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ac.signal,
    }).catch(() => undefined)
    clearTimeout(timer)
  } catch {
    // Never propagate telemetry failures.
  }
}
