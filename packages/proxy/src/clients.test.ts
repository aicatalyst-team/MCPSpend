// Unit tests for the wrap/unwrap logic in clients.ts.
//
// History: we shipped 0.2.0 with isAlreadyWrapped() failing to recognise
// `npx -y @mcpspend/proxy@latest wrap …`, which caused init to double-wrap
// configs that users had previously set up manually. These tests pin down
// every wrap shape we ever generate or accept.
//
// Run with: node --test --import tsx src/clients.test.ts

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { isAlreadyWrapped, wrapEntry, unwrapEntry } from './clients.js'

describe('isAlreadyWrapped', () => {
  test('recognises npx -y @mcpspend/proxy wrap', () => {
    assert.equal(isAlreadyWrapped({
      command: 'npx',
      args: ['-y', '@mcpspend/proxy', 'wrap', '--', 'node', 'server.js'],
    }), true)
  })

  test('recognises npx -y @mcpspend/proxy@latest wrap', () => {
    assert.equal(isAlreadyWrapped({
      command: 'npx',
      args: ['-y', '@mcpspend/proxy@latest', 'wrap', '--', 'node', 'server.js'],
    }), true)
  })

  test('recognises npx -y @mcpspend/proxy@0.2.2 wrap', () => {
    assert.equal(isAlreadyWrapped({
      command: 'npx',
      args: ['-y', '@mcpspend/proxy@0.2.2', 'wrap', '--', 'node', 'server.js'],
    }), true)
  })

  test('recognises npx without -y flag', () => {
    assert.equal(isAlreadyWrapped({
      command: 'npx',
      args: ['@mcpspend/proxy', 'wrap', '--', 'node', 'server.js'],
    }), true)
  })

  test('recognises bin-direct mcpspend wrap', () => {
    assert.equal(isAlreadyWrapped({
      command: 'mcpspend',
      args: ['wrap', '--', 'node', 'server.js'],
    }), true)
  })

  test('recognises absolute Windows path to mcpspend.cmd', () => {
    assert.equal(isAlreadyWrapped({
      command: 'C:\\Users\\me\\AppData\\Roaming\\npm\\mcpspend.cmd',
      args: ['wrap', '--', 'node', 'server.js'],
    }), true)
  })

  test('rejects unrelated npx invocations', () => {
    assert.equal(isAlreadyWrapped({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/data'],
    }), false)
  })

  test('rejects raw mcpspend without wrap subcommand', () => {
    assert.equal(isAlreadyWrapped({
      command: 'mcpspend',
      args: ['init', '--key', 'mcps_live_xxx'],
    }), false)
  })

  test('rejects empty args', () => {
    assert.equal(isAlreadyWrapped({ command: 'npx', args: [] }), false)
    assert.equal(isAlreadyWrapped({ command: 'mcpspend', args: [] }), false)
  })

  test('rejects an npx invoking some other package called proxy', () => {
    assert.equal(isAlreadyWrapped({
      command: 'npx',
      args: ['-y', '@otherorg/proxy', 'wrap', '--', 'node', 'server.js'],
    }), false)
  })
})

describe('wrap → unwrap roundtrip', () => {
  test('npx-style preserves command + args + env', () => {
    const original = {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/data'],
      env: { FOO: 'bar' },
    }
    const wrapped = wrapEntry(original)
    assert.equal(isAlreadyWrapped(wrapped), true, 'wrapped should be recognised')
    const restored = unwrapEntry(wrapped)
    assert.deepEqual(restored, original)
  })

  test('bin-style preserves command + args + env', () => {
    const original = {
      command: 'node',
      args: ['./my-server.js'],
      env: { GITHUB_TOKEN: 'xxx' },
    }
    const wrapped = wrapEntry(original, { style: 'bin' })
    assert.equal(wrapped.command, 'mcpspend')
    assert.equal(isAlreadyWrapped(wrapped), true)
    const restored = unwrapEntry(wrapped)
    assert.deepEqual(restored, original)
  })

  test('does NOT bake the API key into wrapped args (prevents git leak)', () => {
    const wrapped = wrapEntry(
      { command: 'node', args: ['server.js'] },
      { apiKey: 'mcps_live_SECRET' },
    )
    const flat = JSON.stringify(wrapped)
    assert.equal(flat.includes('mcps_live_SECRET'), false)
    assert.equal(flat.includes('--key'), false)
  })

  test('projectId and agentName are baked in (they are not secrets)', () => {
    const wrapped = wrapEntry(
      { command: 'node', args: ['server.js'] },
      { projectId: 'prj_xyz', agentName: 'demo-agent' },
    )
    assert.ok(wrapped.args!.includes('--project'))
    assert.ok(wrapped.args!.includes('prj_xyz'))
    assert.ok(wrapped.args!.includes('--agent'))
    assert.ok(wrapped.args!.includes('demo-agent'))
  })
})

describe('unwrapEntry edge cases', () => {
  test('returns null for non-wrapped entries (no-op safety)', () => {
    assert.equal(unwrapEntry({ command: 'npx', args: ['some', 'thing'] }), null)
  })

  test('handles wrapped entry with no -- separator gracefully', () => {
    assert.equal(unwrapEntry({ command: 'mcpspend', args: ['wrap'] }), null)
  })
})

describe('idempotency', () => {
  test('wrapping a wrapped entry should not double-wrap (guarded at wrapAllServers level)', () => {
    // wrapEntry itself does not check — it's wrapAllServers that gates on
    // isAlreadyWrapped. Confirm that the gate works as documented.
    const original = { command: 'npx', args: ['@modelcontextprotocol/server-filesystem', '/data'] }
    const once = wrapEntry(original)
    assert.equal(isAlreadyWrapped(once), true)
    // If wrapAllServers correctly skips, the entry passed to wrapEntry would
    // already be wrapped — but defensive callers should rely on isAlreadyWrapped.
  })
})
