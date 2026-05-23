import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest, requireOrg, requireRole } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { generateInvitationToken, hashInvitationToken, buildAcceptUrl } from '../lib/invitation'
import { sendEmail } from '../lib/email'
import { invitationEmail } from '../emails/templates'

const router = Router()

const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

// Create an invitation (OWNER/ADMIN only)
router.post('/', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({
    email: z.string().email(),
    role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const email = parsed.data.email.toLowerCase()

  // Already a member?
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, memberships: { where: { organizationId: req.organizationId! }, select: { id: true } } },
  })
  if (existingUser?.memberships.length) {
    res.status(409).json({ error: 'User is already a member' })
    return
  }

  // Outstanding invitation?
  const existingInv = await prisma.invitation.findFirst({
    where: {
      organizationId: req.organizationId!,
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  if (existingInv) {
    res.status(409).json({ error: 'An invitation is already pending for this email' })
    return
  }

  const { plaintext, hash } = generateInvitationToken()
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS)

  const inv = await prisma.invitation.create({
    data: {
      organizationId: req.organizationId!,
      email,
      role: parsed.data.role,
      tokenHash: hash,
      invitedByUserId: req.userId!,
      expiresAt,
    },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
  })

  // Fire-and-forget invitation email (only sends when RESEND_API_KEY is set)
  const acceptUrl = buildAcceptUrl(plaintext)
  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId! },
    select: { name: true },
  })
  const inviter = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { name: true, email: true },
  })
  void sendEmail({
    to: email,
    ...invitationEmail({
      organizationName: org?.name || 'a workspace',
      invitedByName: inviter?.name || inviter?.email || 'A teammate',
      acceptUrl,
    }),
  })

  res.status(201).json({
    invitation: inv,
    acceptUrl, // also returned so admins can share the link manually if email is disabled
  })
})

// List pending invitations for current org
router.get('/', requireOrg, async (req: AuthRequest, res) => {
  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId: req.organizationId!,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, role: true, expiresAt: true, createdAt: true,
      invitedBy: { select: { id: true, email: true, name: true } },
    },
  })
  res.json(invitations)
})

// Revoke an invitation (OWNER/ADMIN only)
router.delete('/:id', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const target = await prisma.invitation.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId! },
  })
  if (!target) { res.status(404).json({ error: 'Invitation not found' }); return }
  await prisma.invitation.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

// Accept an invitation as an already-authenticated user
router.post('/accept', async (req: AuthRequest, res) => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return }
  const schema = z.object({ token: z.string().min(10) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(parsed.data.token) },
  })
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    res.status(400).json({ error: 'Invitation invalid or expired' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) { res.status(401).json({ error: 'User not found' }); return }
  if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
    res.status(400).json({ error: 'Invitation email does not match your account' })
    return
  }

  // Already a member?
  const existing = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: inv.organizationId, userId: user.id } },
  })
  if (existing) {
    await prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } })
    res.status(200).json({ organizationId: inv.organizationId, alreadyMember: true })
    return
  }

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: { organizationId: inv.organizationId, userId: user.id, role: inv.role },
    }),
    prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
  ])

  res.status(200).json({ organizationId: inv.organizationId })
})

// Lookup invitation details by token (used by /accept-invitation page to show context before login/register)
router.get('/lookup/:token', async (req, res) => {
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(req.params.token) },
    select: {
      email: true, role: true, expiresAt: true, acceptedAt: true,
      organization: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { email: true, name: true } },
    },
  })
  if (!inv) { res.status(404).json({ error: 'Invitation not found' }); return }
  const expired = inv.expiresAt < new Date()
  res.json({
    organization: inv.organization,
    invitedBy: inv.invitedBy,
    email: inv.email,
    role: inv.role,
    accepted: !!inv.acceptedAt,
    expired,
  })
})

export { router as invitationsRouter }
