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
