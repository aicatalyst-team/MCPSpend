import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest, requireOrg, requireRole } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { generateApiKey } from '../lib/apiKey'

const router = Router()

// List API keys for current org
router.get('/', requireOrg, async (req: AuthRequest, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { organizationId: req.organizationId! },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true,
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true, name: true } },
    },
  })
  res.json(keys)
})

// Create a new API key (OWNER/ADMIN only). Returns the plaintext key ONCE.
router.post('/', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const schema = z.object({
    name: z.string().min(1).max(80),
    projectId: z.string().optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  if (parsed.data.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, organizationId: req.organizationId! },
      select: { id: true },
    })
    if (!project) { res.status(400).json({ error: 'Project not found in this organization' }); return }
  }

  const { plaintext, prefix, hash } = generateApiKey()

  const key = await prisma.apiKey.create({
    data: {
      organizationId: req.organizationId!,
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      prefix,
      keyHash: hash,
      createdByUserId: req.userId!,
    },
    select: { id: true, name: true, prefix: true, createdAt: true },
  })

  res.status(201).json({
    ...key,
    plaintext, // shown once — UI must warn the user to copy it now
  })
})

// Revoke a key (OWNER/ADMIN only)
router.post('/:id/revoke', requireOrg, requireRole('OWNER', 'ADMIN'), async (req: AuthRequest, res) => {
  const target = await prisma.apiKey.findFirst({
    where: { id: req.params.id, organizationId: req.organizationId! },
    select: { id: true, revokedAt: true },
  })
  if (!target) { res.status(404).json({ error: 'API key not found' }); return }
  if (target.revokedAt) { res.status(409).json({ error: 'Already revoked' }); return }

  const updated = await prisma.apiKey.update({
    where: { id: target.id },
    data: { revokedAt: new Date() },
    select: { id: true, revokedAt: true },
  })
  res.json(updated)
})

export { router as apiKeysRouter }
