// Content script — runs in claude.ai's MAIN world so it can patch fetch().
// We intercept the streaming response from claude.ai's chat API and look for
// `tool_use` blocks in the server-sent-event stream. Each tool_use becomes
// one tool-call observation we forward to MCPSpend.
//
// IMPORTANT: this script CANNOT see prompt content, tool arguments, or
// tool results — those flow through Anthropic's servers and only the
// rendered text comes back to the browser. We only forward metadata
// (tool name, model, approximate token count, latency).
//
// Anthropic's internal API shape can change at any time. The parser is
// deliberately defensive — on any structural mismatch we log a single
// warning and keep going (we'd rather miss events than break claude.ai).

(() => {
  // De-dupe across page navigations within the SPA — only patch once
  if (window.__mcpspendPatched) return
  window.__mcpspendPatched = true

  const ORIGINAL_FETCH = window.fetch.bind(window)

  // Pull our config (API key + endpoint) from the content-script bridge
  // we set up in background.js → window.postMessage.
  /** @type {{ apiKey: string | null, endpoint: string }} */
  let cfg = { apiKey: null, endpoint: 'https://api.mcpspend.com' }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return
    if (ev.data?.type !== '__mcpspend_config') return
    cfg = { ...cfg, ...ev.data.payload }
  })

  // Ask the extension service-worker to push us the current config now.
  window.postMessage({ type: '__mcpspend_request_config' }, '*')

  /**
   * Track in-flight chat requests so we can attribute streamed tool_use blocks
   * back to the model + start time of the parent request.
   */
  const inflight = new Map()

  window.fetch = async function patchedFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url ?? ''
    const isChatStream = /\/api\/organizations\/[^/]+\/chat_conversations\/[^/]+\/(append_message|completion)/.test(url)

    if (!isChatStream || !cfg.apiKey) {
      return ORIGINAL_FETCH(input, init)
    }

    const startedAt = Date.now()
    const requestId = crypto.randomUUID()
    let model = 'claude-unknown'
    try {
      if (init?.body && typeof init.body === 'string') {
        const body = JSON.parse(init.body)
        if (body?.model) model = String(body.model)
      }
    } catch { /* ignore — defensive */ }

    inflight.set(requestId, { model, startedAt })

    // We need to tee the body so the page can read its own stream AND we can
    // parse it. Standard pattern: clone the response, return original to page,
    // run our parser on the clone.
    const resp = await ORIGINAL_FETCH(input, init)
    if (!resp.body) {
      inflight.delete(requestId)
      return resp
    }
    const cloned = resp.clone()

    // Background parse — never blocks the page.
    void parseStream(cloned, { model, startedAt, requestId }).finally(() => {
      inflight.delete(requestId)
    })

    return resp
  }

  /**
   * Parse a Claude SSE stream. We watch for `tool_use` content blocks and
   * `message_delta` events that report usage tokens.
   */
  async function parseStream(resp, ctx) {
    if (!resp.body) return
    const reader = resp.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let totalInputTokens = 0
    let totalOutputTokens = 0
    const tools = [] // { serverName, toolName, startedAt }

    while (true) {
      try {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const events = buf.split('\n\n')
        buf = events.pop() ?? ''
        for (const raw of events) {
          const lines = raw.split('\n')
          let data = ''
          for (const line of lines) if (line.startsWith('data:')) data += line.slice(5).trim()
          if (!data || data === '[DONE]') continue
          let evt
          try { evt = JSON.parse(data) } catch { continue }

          // Tool-use block start
          if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
            const tu = evt.content_block
            tools.push({
              serverName: tu.server_name ?? extractServer(tu.name) ?? 'claude-web',
              toolName: tu.name ?? 'unknown',
              startedAt: Date.now(),
            })
          }

          // Usage metadata on message_delta — total tokens for the whole turn.
          if (evt.type === 'message_delta' && evt.usage) {
            if (typeof evt.usage.input_tokens === 'number') totalInputTokens = evt.usage.input_tokens
            if (typeof evt.usage.output_tokens === 'number') totalOutputTokens = evt.usage.output_tokens
          }
        }
      } catch (err) {
        // Logging once is plenty — claude.ai navigates often, half-read streams are normal
        console.warn('[MCPSpend] stream parse error', err)
        break
      }
    }

    // No tools called = nothing to report (chat without MCP usage)
    if (tools.length === 0) return

    // Distribute total tokens across tools proportionally (we don't get per-tool
    // breakdowns from claude.ai). For most queries 1-3 tools max, so equal split.
    const perToolInput = Math.floor(totalInputTokens / tools.length)
    const perToolOutput = Math.floor(totalOutputTokens / tools.length)

    for (const t of tools) {
      void postEvent({
        serverName: t.serverName,
        toolName: t.toolName,
        model: ctx.model,
        inputTokens: perToolInput,
        outputTokens: perToolOutput,
        latencyMs: Date.now() - t.startedAt,
        success: true,
        calledAt: new Date(t.startedAt).toISOString(),
      })
    }
  }

  function extractServer(toolName) {
    if (!toolName) return null
    // Anthropic prefixes some tools with "server:tool". Fall back to first
    // word before underscore so we group sensibly.
    const colon = toolName.indexOf(':')
    if (colon > 0) return toolName.slice(0, colon)
    return null
  }

  async function postEvent(event) {
    try {
      await ORIGINAL_FETCH(`${cfg.endpoint}/api/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(event),
        mode: 'cors',
      })
    } catch (err) {
      // best-effort; never log noisily
      console.warn('[MCPSpend] ingest failed', err)
    }
  }
})()
