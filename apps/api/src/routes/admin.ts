import { Router } from 'express'
import { AuthRequest, requireSuperAdmin, requireUserSession } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()

// All routes here are gated by requireSuperAdmin — only emails in
// SUPER_ADMIN_EMAILS env var can access. Designed for the platform owner
// (e.g. Andrei) to see the entire customer base from inside the dashboard
// without poking the DB directly.
router.use(requireUserSession, requireSuperAdmin)

// GET /api/admin/overview — single big snapshot for the admin page
router.get('/overview', async (_req: AuthRequest, res) => {
  const [userCount, orgCount, planBreakdown, recentSignups, topByUsage] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.organization.groupBy({
      by: ['plan'],
      _count: { _all: true },
      _sum: { callsThisMonth: true, callsLimit: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, email: true, name: true, createdAt: true, emailVerifiedAt: true,
        memberships: {
          select: {
            role: true,
            organization: { select: { id: true, name: true, plan: true } },
          },
        },
      },
    }),
    prisma.organization.findMany({
      orderBy: { callsThisMonth: 'desc' },
      take: 20,
      select: {
        id: true, name: true, slug: true, plan: true,
        callsThisMonth: true, callsLimit: true, createdAt: true,
        stripeSubscriptionId: true,
        _count: { select: { members: true, projects: true, apiKeys: true } },
      },
    }),
  ])

  res.json({
    totals: {
      users: userCount,
      organizations: orgCount,
    },
    planBreakdown: planBreakdown.map(p => ({
      plan: p.plan,
      orgs: p._count._all,
      callsThisMonth: p._sum.callsThisMonth || 0,
      callsLimitTotal: p._sum.callsLimit || 0,
    })),
    recentSignups,
    topByUsage,
  })
})

// GET /api/admin/orgs — full list with pagination
router.get('/orgs', async (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
  const offset = parseInt(req.query.offset as string) || 0
  const search = (req.query.q as string)?.trim()

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
          { members: { some: { user: { email: { contains: search, mode: 'insensitive' as const } } } } },
        ],
      }
    : {}

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset, take: limit,
      select: {
        id: true, name: true, slug: true, plan: true,
        callsThisMonth: true, callsLimit: true, createdAt: true,
        stripeCustomerId: true, stripeSubscriptionId: true,
        members: {
          where: { role: 'OWNER' },
          select: { user: { select: { email: true, name: true } } },
        },
        _count: { select: { members: true, projects: true, apiKeys: true } },
      },
    }),
    prisma.organization.count({ where }),
  ])

  res.json({ items, total, limit, offset })
})

export { router as adminRouter }
