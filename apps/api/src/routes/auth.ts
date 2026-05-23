import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { slugify, randomSlugSuffix } from '../lib/slug'
import { hashInvitationToken } from '../lib/invitation'
import { sendEmail } from '../lib/email'
import { welcomeEmail } from '../emails/templates'

const router = Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  organizationName: z.string().min(1).max(80).optional(),
  invitationToken: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

function signToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '30d' })
}

async function uniqueOrgSlug(name: string): Promise<string> {
  const base = slugify(name)
  for (let i = 0; i < 4; i++) {
    const candidate = i === 0 ? base : `${base}-${randomSlugSuffix()}`
    const exists = await prisma.organization.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!exists) return candidate
  }
  return `${base}-${randomSlugSuffix()}-${Date.now().toString(36)}`
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { email, password, name, organizationName, invitationToken } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email already registered' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Optional invitation: claim it during registration
  let invitedOrgId: string | null = null
  let invitedRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER'
  if (invitationToken) {
    const inv = await prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(invitationToken) },
      select: { id: true, organizationId: true, email: true, role: true, expiresAt: true, acceptedAt: true },
    })
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invitation invalid or expired' })
      return
    }
    if (inv.email.toLowerCase() !== email.toLowerCase()) {
      res.status(400).json({ error: 'Invitation email does not match' })
      return
    }
    invitedOrgId = inv.organizationId
    invitedRole = inv.role
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, passwordHash, name } })

    if (invitedOrgId) {
      // Mark invitation accepted + add membership
      await tx.invitation.updateMany({
        where: { tokenHash: hashInvitationToken(invitationToken!), acceptedAt: null },
        data: { acceptedAt: new Date() },
      })
      await tx.organizationMember.create({
        data: { organizationId: invitedOrgId, userId: user.id, role: invitedRole },
      })
    } else {
      // Create personal organization, user is OWNER
      const orgName = organizationName?.trim() || (name?.trim() ? `${name.trim()}'s workspace` : 'Personal workspace')
      const slug = await uniqueOrgSlug(orgName)
      const org = await tx.organization.create({ data: { name: orgName, slug } })
      await tx.organizationMember.create({
        data: { organizationId: org.id, userId: user.id, role: 'OWNER' },
      })
    }

    const memberships = await tx.organizationMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        organization: { select: { id: true, name: true, slug: true, plan: true } },
      },
    })

    return { user: { id: user.id, email: user.email, name: user.name }, memberships }
  })

  const token = signToken(result.user.id)

  // Fire-and-forget welcome email
  const dashboardUrl = process.env.DASHBOARD_URL?.split(',')[0]?.trim() || 'https://mcpspend.com'
  void sendEmail({
    to: result.user.email,
    ...welcomeEmail({ name: result.user.name, dashboardUrl: `${dashboardUrl}/dashboard` }),
  })

  res.status(201).json({
    user: result.user,
    memberships: result.memberships,
    activeOrganizationId: result.memberships[0]?.organization.id ?? null,
    token,
  })
})

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: 'asc' },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true, plan: true } },
    },
  })

  const token = signToken(user.id)
  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    memberships,
    activeOrganizationId: memberships[0]?.organization.id ?? null,
    token,
  })
})

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    const token = authHeader.replace('Bearer ', '')
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    })
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        organization: { select: { id: true, name: true, slug: true, plan: true, callsThisMonth: true, callsLimit: true } },
      },
    })
    res.json({ user, memberships })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export { router as authRouter }
