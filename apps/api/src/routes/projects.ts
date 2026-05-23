import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest, requireOrg, requireRole } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { slugify, randomSlugSuffix } from '../lib/slug'

const router = Router()

router.get('/', requireOrg, async (req: AuthRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { organizationId: req.organizationId! },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
  })
  res.json(projects)
})

// Pricing.tsx promises: FREE = 1 project; PRO/TEAM/ENT = unlimited.
const PROJECT_LIMITS: Record<string, number | null> = {
  FREE: 1,
  PRO: null,
  TEAM: null,
  ENTERPRISE: null,
}

router.post('/', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({ name: z.string().min(1).max(80) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { plan: true },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }

  const limit = PROJECT_LIMITS[org.plan]
  if (limit !== null) {
    const count = await prisma.project.count({ where: { organizationId: req.organizationId! } })
    if (count >= limit) {
      res.status(402).json({
        error: `${org.plan} plan is limited to ${limit} project${limit === 1 ? '' : 's'}. Upgrade to add more.`,
        currentPlan: org.plan,
        upgradeUrl: `${process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'}/dashboard/billing`,
      })
      return
    }
  }

  const base = slugify(parsed.data.name)
  let slug = base
  for (let i = 0; i < 4; i++) {
    const exists = await prisma.project.findUnique({
      where: { organizationId_slug: { organizationId: req.organizationId!, slug } },
    })
    if (!exists) break
    slug = `${base}-${randomSlugSuffix()}`
  }

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      slug,
      organizationId: req.organizationId!,
    },
    select: { id: true, name: true, slug: true, createdAt: true },
  })
  res.status(201).json(project)
})

router.delete('/:id', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId! },
  })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.project.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

export { router as projectsRouter }
