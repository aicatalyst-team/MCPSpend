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

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' })
    return
  }

  const token = authHeader.replace('Bearer ', '').trim()

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
