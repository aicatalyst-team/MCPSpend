import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { hashApiKey } from '../lib/apiKey'

export interface AuthRequest extends Request {
  userId?: string
  organizationId?: string
  apiKeyId?: string
  projectId?: string
  role?: 'OWNER' | 'ADMIN' | 'MEMBER'
}

// Auth via JWT in Authorization header.
// The caller picks the active organization via X-Organization-Id header (or falls back to first membership).
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  // Token resolution order: Authorization header > ?token= query param (SSE
  // fallback because EventSource can't set headers) > 401. Same for orgId via
  // header X-Organization-Id or ?orgId= query param.
  let token: string | null = null
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '').trim()
  } else if (typeof req.query.token === 'string' && req.query.token.length > 0) {
    token = req.query.token
  }
  if (!token) {
    res.status(401).json({ error: 'Missing authorization header' })
    return
  }

  // Allow ?orgId= as alternative to X-Organization-Id (same SSE constraint).
  if (typeof req.query.orgId === 'string' && req.query.orgId.length > 0 && !req.headers['x-organization-id']) {
    req.headers['x-organization-id'] = req.query.orgId
  }

  // API key path: proxy authenticates here
  if (token.startsWith('mcps_')) {
    const keyHash = hashApiKey(token)
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: { id: true, organizationId: true, projectId: true, revokedAt: true },
    })
    if (!apiKey || apiKey.revokedAt) {
      res.status(401).json({ error: 'Invalid or revoked API key' })
      return
    }
    req.apiKeyId = apiKey.id
    req.organizationId = apiKey.organizationId
    req.projectId = apiKey.projectId ?? undefined
    // API keys are treated as ADMIN-level in their own org for non-destructive
    // management operations (creating projects, listing members, etc.). Truly
    // destructive operations (member removal, billing, owner transfers) still
    // require an actual user session (req.userId set) — see requireUserSession.
    req.role = 'ADMIN'
    // Update lastUsedAt in background (don't block request)
    void prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
    next()
    return
  }

  // JWT path: dashboard / user sessions
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId

    const requestedOrgId = (req.headers['x-organization-id'] as string | undefined)?.trim()

    if (requestedOrgId) {
      const member = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: requestedOrgId, userId: payload.userId } },
        select: { organizationId: true, role: true },
      })
      if (!member) {
        res.status(403).json({ error: 'Not a member of this organization' })
        return
      }
      req.organizationId = member.organizationId
      req.role = member.role
    } else {
      // Default to first membership (stable ordering by joinedAt)
      const first = await prisma.organizationMember.findFirst({
        where: { userId: payload.userId },
        orderBy: { joinedAt: 'asc' },
        select: { organizationId: true, role: true },
      })
      if (first) {
        req.organizationId = first.organizationId
        req.role = first.role
      }
    }

    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Stricter guard: requires an active organization context.
export function requireOrg(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.organizationId) {
    res.status(400).json({ error: 'Active organization required (X-Organization-Id header)' })
    return
  }
  next()
}

export function requireRole(...allowed: Array<'OWNER' | 'ADMIN' | 'MEMBER'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.role || !allowed.includes(req.role)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }
    next()
  }
}

// Ensures the caller is a real user session (JWT), not just an API key.
// Use for destructive / privileged operations (member removal, billing).
export function requireUserSession(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(403).json({ error: 'User session required (API keys cannot perform this action)' })
    return
  }
  next()
}

// Platform-owner guard. SUPER_ADMIN_EMAILS env var is a comma-separated list of
// emails allowed to call admin endpoints. Defaults to none — explicit opt-in.
export async function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(403).json({ error: 'User session required' })
    return
  }
  const allowList = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (allowList.length === 0) {
    res.status(403).json({ error: 'Admin access not configured' })
    return
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } })
  if (!user || !allowList.includes(user.email.toLowerCase())) {
    res.status(403).json({ error: 'Not authorized' })
    return
  }
  next()
}
