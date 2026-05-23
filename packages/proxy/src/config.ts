import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export interface Config {
  apiKey?: string
  endpoint: string
  projectId?: string
  agentName?: string
  disabled?: boolean
}

const DEFAULT_ENDPOINT = 'https://api.mcpspend.com'

function configPath(): string {
  return process.env.MCPSPEND_CONFIG || join(homedir(), '.mcpspend', 'config.json')
}

function fileConfig(): Partial<Config> {
  const p = configPath()
  if (!existsSync(p)) return {}
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as Partial<Config>
  } catch {
    return {}
  }
}

export function loadConfig(cliOverrides: Partial<Config> = {}): Config {
  const file = fileConfig()
  const apiKey =
    cliOverrides.apiKey ||
    process.env.MCPSPEND_API_KEY ||
    file.apiKey

  return {
    apiKey,
    endpoint: cliOverrides.endpoint || process.env.MCPSPEND_ENDPOINT || file.endpoint || DEFAULT_ENDPOINT,
    projectId: cliOverrides.projectId || process.env.MCPSPEND_PROJECT_ID || file.projectId,
    agentName: cliOverrides.agentName || process.env.MCPSPEND_AGENT_NAME || file.agentName,
    disabled: cliOverrides.disabled || process.env.MCPSPEND_DISABLED === '1' || file.disabled,
  }
}

export function saveConfig(updates: Partial<Config>): string {
  const p = configPath()
  mkdirSync(dirname(p), { recursive: true })
  const current = fileConfig()
  const next = { ...current, ...updates }
  writeFileSync(p, JSON.stringify(next, null, 2), { mode: 0o600 })
  return p
}
