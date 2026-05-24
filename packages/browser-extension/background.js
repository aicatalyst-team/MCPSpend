// Background service worker. Two jobs:
//   1. Listen for popup → save/restore config
//   2. Bridge config from extension storage to the content script
//      (content scripts in MAIN world don't have chrome.storage access)

const STORAGE_KEY = 'mcpspend_config'
const DEFAULTS = { apiKey: '', endpoint: 'https://api.mcpspend.com' }

async function loadConfig() {
  const r = await chrome.storage.local.get(STORAGE_KEY)
  return { ...DEFAULTS, ...(r[STORAGE_KEY] || {}) }
}

async function saveConfig(patch) {
  const current = await loadConfig()
  const next = { ...current, ...patch }
  await chrome.storage.local.set({ [STORAGE_KEY]: next })
  // Push to any active claude.ai tabs so the patched fetch picks up the new key
  const tabs = await chrome.tabs.query({ url: 'https://claude.ai/*' })
  for (const tab of tabs) {
    if (typeof tab.id === 'number') {
      void chrome.tabs.sendMessage(tab.id, { type: '__mcpspend_config', payload: next }).catch(() => {})
    }
  }
  return next
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'getConfig') {
    void loadConfig().then(sendResponse)
    return true // async
  }
  if (msg?.type === 'saveConfig') {
    void saveConfig(msg.payload).then(sendResponse)
    return true
  }
  if (msg?.type === 'ping') {
    sendResponse({ ok: true })
    return false
  }
  return false
})

// When a claude.ai tab finishes loading, push config so content.js gets it
// at startup. Content.js also re-asks via window.postMessage if it loaded
// before the bridge was ready.
chrome.tabs.onUpdated.addListener(async (tabId, change, tab) => {
  if (change.status !== 'complete') return
  if (!tab.url?.startsWith('https://claude.ai/')) return
  const cfg = await loadConfig()
  void chrome.tabs.sendMessage(tabId, { type: '__mcpspend_config', payload: cfg }).catch(() => {})
})
