# MCPSpend for Claude.ai (Browser Extension)

Tracks MCP tool calls made by **Claude.ai web** in your MCPSpend dashboard. This is the only way to observe Claude.ai web-managed OAuth connectors (Figma, Gmail, Canva, Vercel, etc.) — for everything else use the [proxy CLI](https://www.npmjs.com/package/@mcpspend/proxy) which is simpler and more comprehensive.

## What it does

When you have a conversation on `claude.ai` and Claude calls an MCP tool (Figma connector, custom MCP, etc.), this extension parses the streamed response and forwards **metadata only** to your MCPSpend dashboard:

- Tool name
- Server name (parsed from the tool prefix)
- Model used
- Approximate input/output token counts (distributed across tools called in that turn)
- Latency
- Success/failure

## What it does NOT do

- **Never reads your prompts.** The patched `fetch` only looks at the **streamed response** from claude.ai.
- **Never reads tool arguments.** Those are passed server-side at Anthropic; nothing reaches the browser.
- **Never reads tool results.** Same — server-side only.
- **No telemetry beyond the metadata above.** All other extension activity stays on your machine.

## Install (development)

1. `git clone https://github.com/andreisirbu91-lab/MCPSpend.git`
2. Chrome → `chrome://extensions/` → toggle **Developer mode** → **Load unpacked** → select `packages/browser-extension/`
3. Click the puzzle icon → pin **MCPSpend**
4. Click MCPSpend → paste your API key from <https://mcpspend.com/dashboard/keys>
5. Open `claude.ai`, have a conversation, watch tool calls appear in the dashboard

## Install (production)

Coming soon to:
- Chrome Web Store
- Firefox Add-ons (firefox.com/addons)
- Edge Add-ons

## How it works

```
┌────────────────────────────────────────────────────────────────┐
│ claude.ai (web app)                                            │
│                                                                │
│   user types message → fetch('/api/.../append_message')        │
│                                          ↓                     │
│                              [content.js intercepts fetch]     │
│                                          ↓                     │
│   Anthropic streams SSE response                               │
│     - text deltas                                              │
│     - tool_use blocks  ← we extract these                      │
│     - usage metadata    ← we extract token counts              │
│                                          ↓                     │
│                              [parses stream, forwards          │
│                               metadata to api.mcpspend.com]    │
└────────────────────────────────────────────────────────────────┘
```

## Architecture

- `manifest.json` — Manifest V3, two content scripts (bridge in isolated world, content.js in MAIN world)
- `content.js` — runs in MAIN world, patches `window.fetch` to tee the SSE response stream and parse `tool_use` content blocks
- `bridge.js` — runs in isolated world, bridges `chrome.storage` to the MAIN-world content script via `window.postMessage`
- `background.js` — service worker that stores config + pushes updates to content scripts when the popup saves
- `popup.html` + `popup.js` — settings UI (API key + endpoint)

## Known limitations

- **Token attribution per tool is approximate.** Anthropic doesn't expose per-tool-call token counts; we divide the turn total evenly across all tools used in that turn.
- **Anthropic's internal API can change at any time.** The fetch URL pattern + SSE event shape are not public contracts. If claude.ai changes them, this extension may silently stop reporting until we ship an update.
- **Browser tabs only.** Mobile claude.ai is not supported.

## License

MIT. © NEW RZS SRL.
