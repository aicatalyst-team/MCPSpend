import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/', async (req: AuthRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  })
  res.json(projects)
})

router.post('/', async (req: AuthRequest, res) => {
  const schema = z.object({ name: z.string().min(1).max(100) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }

  const project = await prisma.project.create({
    data: { name: parsed.data.name, userId: req.userId! },
  })
  res.status(201).json(project)
})

router.delete('/:id', async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.id, userId: req.userId! },
  })
  if (!project) { res.status(404).json({ error: 'Not found' }); return }
  await prisma.project.delete({ where: { id: req.params.id } })
  res.status(204).send()
})

export { router as projectsRouter }
