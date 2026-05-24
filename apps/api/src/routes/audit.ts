// GET /api/audit — list audit log entries for the current organization.
// Gated to Team+ plans (matches the comparison matrix on /pricing).

import { Router } from 'express'
import { AuthRequest, requireOrg, requireUserSession, requireRole } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()

const ALLOWED_PLANS = new Set(['TEAM', 'ENTERPRISE'])

router.get('/', requireOrg, requireUserSession, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200)
  const offset = parseInt(req.query.offset as string) || 0

  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { plan: true },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }
  if (!ALLOWED_PLANS.has(org.plan)) {
    res.status(402).json({
      error: 'Audit log requires the Team plan or higher',
      currentPlan: org.plan,
      upgradeUrl: `${process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'}/dashboard/billing`,
    })
    return
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: 'desc' },
      skip: offset, take: limit,
      select: {
        id: true, action: true, target: true,
        actorEmail: true, userId: true,
        ipAddress: true, userAgent: true,
        metadata: true, createdAt: true,
      },
    }),
    prisma.auditLog.count({ where: { organizationId: req.organizationId! } }),
  ])

  res.json({ items, total, limit, offset })
})

export { router as auditRouter }
