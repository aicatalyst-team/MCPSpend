export { loadConfig, saveConfig } from './config.js'
export { runProxy } from './proxy.js'
export type { Config } from './config.js'
export type { ToolCallEvent } from './ingest.js'

// Programmatic API for embedders (VS Code extension, etc.)
export {
  CLIENTS,
  discoverClients,
  readClientConfig,
  writeClientConfig,
  wrapAllServers,
  unwrapAllServers,
  wrapEntry,
  unwrapEntry,
  isAlreadyWrapped,
} from './clients.js'
export type {
  ClientDefinition,
  ClientConfig,
  DiscoveredClient,
  McpServerEntry,
  WrapResult,
  WrapOptions,
} from './clients.js'
export { runInit, runDoctor, formatReport, formatDoctor } from './init.js'
export type { InitOptions, InitReport, ClientReport, DoctorReport } from './init.js'
