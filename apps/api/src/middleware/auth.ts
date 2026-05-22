import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

export interface AuthRequest extends Request {
  userId?: string
  apiKey?: string
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    res.status(401).json({ error: 'Missing authorization header' })
    return
  }

  // Support both Bearer JWT and API key (sk-...)
  if (authHeader.startsWith('Bearer sk-')) {
    const apiKey = authHeader.replace('Bearer ', '')
    const user = await prisma.user.findUnique({ where: { apiKey } })
    if (!user) {
      res.status(401).json({ error: 'Invalid API key' })
      return
    }
    req.userId = user.id
    req.apiKey = apiKey
    next()
    return
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      req.userId = payload.userId
      next()
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' })
    }
    return
  }

  res.status(401).json({ error: 'Invalid authorization format' })
}
