// Isolated-world bridge between the service worker and the MAIN-world content
// script. Lives in the default content-script world so chrome.* APIs work.
//
// Listens for window.postMessage from content.js (MAIN world) and forwards
// to chrome.runtime; pushes config back via window.postMessage.

window.addEventListener('message', async (ev) => {
  if (ev.source !== window) return
  if (ev.data?.type === '__mcpspend_request_config') {
    try {
      const cfg = await chrome.runtime.sendMessage({ type: 'getConfig' })
      window.postMessage({ type: '__mcpspend_config', payload: cfg }, '*')
    } catch {
      // Extension reloaded — page will re-ask
    }
  }
})

// When the service-worker pushes new config (popup saved a new key), relay
// it into the page so the patched fetch picks it up without reload.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === '__mcpspend_config') {
    window.postMessage(msg, '*')
  }
})
