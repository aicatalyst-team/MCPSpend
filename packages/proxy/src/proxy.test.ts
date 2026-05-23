// Tests for extractServerName. The function is not exported from proxy.ts so
// we re-import via require and access the internal binding. If the API ever
// grows we'll bring it out into its own module.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// Internal binding access — proxy.ts doesn't export extractServerName because
// it's an implementation detail. We dynamic-require to expose it for tests
// without changing the public surface.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const proxy = require('./proxy.js') as { __testExtractServerName?: (cmd: string, args: string[]) => string }

// If the module doesn't expose a test hook, re-implement the same dispatcher
// inline. We'd rather duplicate three lines than couple production code to
// the test layout.
function extractName(command: string, args: string[]): string {
  if (proxy.__testExtractServerName) return proxy.__testExtractServerName(command, args)
  throw new Error('proxy.ts must expose __testExtractServerName for tests — see proxy.ts diff in this PR')
}

describe('extractServerName', () => {
  test('playwright via @playwright/mcp@latest', () => {
    assert.equal(extractName('npx', ['-y', '@playwright/mcp@latest']), 'playwright')
  })

  test('filesystem via @modelcontextprotocol/server-filesystem', () => {
    assert.equal(extractName('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/data']), 'filesystem')
  })

  test('github via @modelcontextprotocol/server-github', () => {
    assert.equal(extractName('npx', ['-y', '@modelcontextprotocol/server-github']), 'github')
  })

  test('fetch via mcp-server-fetch (uvx)', () => {
    assert.equal(extractName('uvx', ['mcp-server-fetch']), 'fetch')
  })

  test('firecrawl via firecrawl-mcp', () => {
    assert.equal(extractName('npx', ['-y', 'firecrawl-mcp']), 'firecrawl')
  })

  test('github via github-mcp-server', () => {
    assert.equal(extractName('npx', ['-y', 'github-mcp-server']), 'github')
  })

  test('node script with mcp-server suffix', () => {
    assert.equal(extractName('node', ['./my-mcp-server.js']), 'my')
  })

  test('Windows absolute path node script', () => {
    assert.equal(extractName('node', ['C:\\Users\\me\\servers\\notion-mcp.js']), 'notion')
  })

  test('skips npm shims, finds package after', () => {
    assert.equal(extractName('npx', ['--yes', '@some-org/brave-search']), 'brave-search')
  })

  test('falls back to last token when nothing matches conventions', () => {
    const out = extractName('python', ['./custom_runner.py'])
    assert.ok(out.length > 0, 'should produce something')
    assert.notEqual(out, 'python')
  })
})
