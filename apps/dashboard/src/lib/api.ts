const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.mcpspend.com'

const TOKEN_KEY = 'mcps_token'
const ORG_KEY = 'mcps_org_id'

export const auth = {
  setSession(token: string, organizationId: string | null) {
    if (typeof window === 'undefined') return
    localStorage.setItem(TOKEN_KEY, token)
    if (organizationId) localStorage.setItem(ORG_KEY, organizationId)
  },
  setOrganization(organizationId: string) {
    if (typeof window === 'undefined') return
    localStorage.setItem(ORG_KEY, organizationId)
  },
  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  },
  getOrganizationId(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(ORG_KEY)
  },
  clear() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ORG_KEY)
  },
}

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  const headers: Record<string, string> = { ...extra }
  const token = auth.getToken()
  const orgId = auth.getOrganizationId()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (orgId) headers['X-Organization-Id'] = orgId
  return headers
}

// Trigger a file download. Used for CSV export. Honors auth + active org headers
// without going through the JSON-decoding wrapper above.
export async function apiDownload(path: string, suggestedName: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let payload: unknown
    try { payload = JSON.parse(text) } catch { payload = text }
    throw new ApiError(res.status, payload)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super(typeof payload === 'object' && payload && 'error' in payload ? String((payload as { error: unknown }).error) : `HTTP ${status}`)
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined

  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}
