import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { authRouter } from './routes/auth'
import { ingestRouter } from './routes/ingest'
import { statsRouter } from './routes/stats'
import { projectsRouter } from './routes/projects'
import { organizationsRouter } from './routes/organizations'
import { invitationsRouter } from './routes/invitations'
import { apiKeysRouter } from './routes/apiKeys'
import { billingRouter, billingPublicRouter } from './routes/billing'
import { webhookRouter } from './routes/webhooks'
import { authMiddleware } from './middleware/auth'

const app = express()
const PORT = process.env.PORT || 4000

app.set('trust proxy', 1) // behind Coolify / Caddy reverse proxy

app.use(helmet())
app.use(cors({
  origin: (process.env.DASHBOARD_URL || 'http://localhost:3000').split(',').map(s => s.trim()),
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
}))

// Stripe webhooks need raw body — before json middleware
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRouter)

app.use(express.json({ limit: '2mb' }))

// Global rate limit: 1000 req/minute per IP
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
}))

// Tighter limit for auth endpoints (prevent credential stuffing / brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — try again in a few minutes' },
})

// Higher limit for ingest (high-volume writes)
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
})

app.get('/health', (_req, res) => res.json({
  status: 'ok',
  version: '0.2.0',
  ts: new Date().toISOString(),
}))

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/ingest', ingestLimiter, authMiddleware, ingestRouter)
app.use('/api/stats', authMiddleware, statsRouter)
app.use('/api/projects', authMiddleware, projectsRouter)
app.use('/api/organizations', authMiddleware, organizationsRouter)
app.use('/api/invitations', authMiddleware, invitationsRouter)
app.use('/api/keys', authMiddleware, apiKeysRouter)
app.use('/api/billing', billingPublicRouter)            // /start is public
app.use('/api/billing', authMiddleware, billingRouter)  // /checkout, /portal require auth

app.listen(PORT, () => {
  console.log(`MCPSpend API v0.2.0 running on port ${PORT}`)
})

export default app
