// Popup controller — read/save config, probe API health, render status.

const apiKeyInput = document.getElementById('apiKey')
const endpointInput = document.getElementById('endpoint')
const saveBtn = document.getElementById('save')
const dot = document.getElementById('dot')
const msg = document.getElementById('msg')

function setStatus(state, text) {
  dot.className = 'dot ' + state // ok | warn | err
  msg.textContent = text
}

async function load() {
  const cfg = await chrome.runtime.sendMessage({ type: 'getConfig' })
  apiKeyInput.value = cfg.apiKey ?? ''
  endpointInput.value = cfg.endpoint ?? 'https://api.mcpspend.com'
  if (!cfg.apiKey) {
    setStatus('warn', 'No API key set yet. Paste yours above.')
    return
  }
  setStatus('warn', 'Verifying key…')
  void probe(cfg)
}

async function probe(cfg) {
  try {
    const r = await fetch(`${cfg.endpoint}/health`, { method: 'GET' })
    if (!r.ok) {
      setStatus('err', `Endpoint unreachable (HTTP ${r.status})`)
      return
    }
    // Now probe with the API key — /api/organizations/current accepts an
    // API key bearer and returns the org metadata.
    const r2 = await fetch(`${cfg.endpoint}/api/organizations/current`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    })
    if (r2.ok) {
      const org = await r2.json()
      setStatus('ok', `Connected → ${org.name ?? 'your org'}`)
    } else if (r2.status === 401) {
      setStatus('err', 'Key rejected — check it on mcpspend.com')
    } else {
      setStatus('warn', `Unexpected status: HTTP ${r2.status}`)
    }
  } catch (err) {
    setStatus('err', err instanceof Error ? err.message : 'Network error')
  }
}

saveBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim()
  const endpoint = (endpointInput.value || 'https://api.mcpspend.com').trim()
  if (!apiKey.startsWith('mcps_')) {
    setStatus('err', 'API key should start with mcps_live_ or mcps_test_')
    return
  }
  saveBtn.disabled = true
  saveBtn.textContent = 'Saving…'
  const next = await chrome.runtime.sendMessage({ type: 'saveConfig', payload: { apiKey, endpoint } })
  saveBtn.disabled = false
  saveBtn.textContent = 'Save'
  setStatus('warn', 'Saved — testing key…')
  void probe(next)
})

void load()
