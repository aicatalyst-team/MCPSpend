import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest, requireOrg, requireRole, requireUserSession } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { slugify, randomSlugSuffix } from '../lib/slug'

const router = Router()

// List orgs the current user belongs to
router.get('/', async (req: AuthRequest, res) => {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: req.userId! },
    orderBy: { joinedAt: 'asc' },
    select: {
      role: true,
      joinedAt: true,
      organization: {
        select: {
          id: true, name: true, slug: true, plan: true,
          callsThisMonth: true, callsLimit: true,
          createdAt: true,
        },
      },
    },
  })
  res.json(memberships)
})

// Create a new organization (current user becomes OWNER)
router.post('/', async (req: AuthRequest, res) => {
  const schema = z.object({ name: z.string().min(1).max(80) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const baseSlug = slugify(parsed.data.name)
  let slug = baseSlug
  for (let i = 0; i < 4; i++) {
    const exists = await prisma.organization.findUnique({ where: { slug } })
    if (!exists) break
    slug = `${baseSlug}-${randomSlugSuffix()}`
  }

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug,
      members: { create: { userId: req.userId!, role: 'OWNER' } },
    },
  })
  res.status(201).json(org)
})

// Get current organization details
router.get('/current', requireOrg, async (req: AuthRequest, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: {
      id: true, name: true, slug: true, plan: true,
      callsThisMonth: true, callsLimit: true,
      billingCycleStart: true, createdAt: true,
    },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }
  res.json(org)
})

// Update organization (OWNER/ADMIN only)
router.patch('/current', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({ name: z.string().min(1).max(80).optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const org = await prisma.organization.update({
    where: { id: req.organizationId! },
    data: parsed.data,
    select: { id: true, name: true, slug: true, plan: true },
  })
  res.json(org)
})

// List members of current organization
router.get('/current/members', requireOrg, async (req: AuthRequest, res) => {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: req.organizationId! },
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true, role: true, joinedAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  })
  res.json(members)
})

// Change a member's role (OWNER only)
router.patch('/current/members/:memberId', requireOrg, requireUserSession, requireRole('OWNER'), async (req: AuthRequest, res) => {
  const schema = z.object({ role: z.enum(['OWNER', 'ADMIN', 'MEMBER']) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const target = await prisma.organizationMember.findFirst({
    where: { id: req.params.memberId, organizationId: req.organizationId! },
  })
  if (!target) { res.status(404).json({ error: 'Member not found' }); return }

  // Prevent demoting the last OWNER
  if (target.role === 'OWNER' && parsed.data.role !== 'OWNER') {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: req.organizationId!, role: 'OWNER' },
    })
    if (ownerCount <= 1) {
      res.status(400).json({ error: 'Cannot remove the last owner' })
      return
    }
  }

  const updated = await prisma.organizationMember.update({
    where: { id: req.params.memberId },
    data: { role: parsed.data.role },
    select: { id: true, role: true },
  })
  res.json(updated)
})

// Remove a member (OWNER/ADMIN; users can also remove themselves)
router.delete('/current/members/:memberId', requireOrg, requireUserSession, async (req: AuthRequest, res) => {
  const target = await prisma.organizationMember.findFirst({
    where: { id: req.params.memberId, organizationId: req.organizationId! },
  })
  if (!target) { res.status(404).json({ error: 'Member not found' }); return }

  const isSelf = target.userId === req.userId
  const canManage = req.role === 'OWNER' || req.role === 'ADMIN'
  if (!isSelf && !canManage) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }

  if (target.role === 'OWNER') {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: req.organizationId!, role: 'OWNER' },
    })
    if (ownerCount <= 1) {
      res.status(400).json({ error: 'Cannot remove the last owner' })
      return
    }
  }

  await prisma.organizationMember.delete({ where: { id: req.params.memberId } })
  res.status(204).send()
})

export { router as organizationsRouter }
