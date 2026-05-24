import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest, requireOrg, requireRole, requireUserSession } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { slugify, randomSlugSuffix } from '../lib/slug'
import { encrypt, decrypt } from '../lib/crypto'
import { writeAudit } from '../lib/audit'

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

// Get current organization details. slackWebhookUrl is transparently decrypted
// before being returned to the client (we never surface the at-rest ciphertext).
router.get('/current', requireOrg, async (req: AuthRequest, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: {
      id: true, name: true, slug: true, plan: true,
      callsThisMonth: true, callsLimit: true,
      billingCycleStart: true, createdAt: true,
      slackWebhookUrl: true,
      monthlyBudgetUsd: true,
    },
  })
  if (!org) { res.status(404).json({ error: 'Organization not found' }); return }

  // Month-to-date spend for the budget widget. One aggregate query — same
  // shape the dashboard already uses but scoped to this month UTC.
  const since = new Date()
  since.setUTCDate(1)
  since.setUTCHours(0, 0, 0, 0)
  const spendAgg = await prisma.dailyStats.aggregate({
    where: { organizationId: req.organizationId!, date: { gte: since } },
    _sum: { costUsd: true },
  })

  res.json({
    ...org,
    slackWebhookUrl: decrypt(org.slackWebhookUrl),
    spendThisMonthUsd: spendAgg._sum.costUsd ?? 0,
  })
})

// Update organization (OWNER/ADMIN only). Accepts name + Slack webhook URL
// for budget alerts. Slack URL is only meaningful on Pro+ (alerts are gated
// at the maintenance scheduler).
router.patch('/current', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(80).optional(),
    slackWebhookUrl: z.string().url().startsWith('https://hooks.slack.com/').nullable().optional(),
    // monthly cost cap in USD. null clears it.
    monthlyBudgetUsd: z.number().positive().max(1_000_000).nullable().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  // Encrypt secrets at rest before persisting. The crypto helper is a no-op
  // when APP_ENCRYPTION_KEY is not set (dev mode passthrough).
  // Spread first so we don't mutate parsed.data; only the slack value goes
  // through the encryption helper.
  const data: Record<string, unknown> = { ...parsed.data }
  if ('slackWebhookUrl' in parsed.data) {
    data.slackWebhookUrl = encrypt(parsed.data.slackWebhookUrl) as string | null
  }
  // Resetting the budget should also reset the alert tracking so the next
  // run alerts fresh against the new number.
  if ('monthlyBudgetUsd' in parsed.data) {
    data.lastSpendAlertAt = null
    data.lastSpendAlertLevel = null
  }

  const org = await prisma.organization.update({
    where: { id: req.organizationId! },
    data,
    select: {
      id: true, name: true, slug: true, plan: true,
      slackWebhookUrl: true, monthlyBudgetUsd: true,
    },
  })

  // Log which fields were touched (NOT the values — could be secrets).
  void writeAudit({
    organizationId: req.organizationId!,
    userId: req.userId,
    action: 'org.settings-update',
    metadata: { fields: Object.keys(parsed.data) },
    req,
  })

  res.json({ ...org, slackWebhookUrl: decrypt(org.slackWebhookUrl) })
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
