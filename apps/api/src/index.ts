import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { authRouter } from './routes/auth'
import { ingestRouter } from './routes/ingest'
import { statsRouter } from './routes/stats'
import { projectsRouter } from './routes/projects'
import { webhookRouter } from './routes/webhooks'
import { authMiddleware } from './middleware/auth'

const app = express()
const PORT = process.env.PORT || 4000

app.set('trust proxy', 1) // behind Coolify / Caddy reverse proxy

app.use(helmet())
app.use(cors({
  origin: process.env.DASHBOARD_URL || 'http://localhost:3000',
  credentials: true,
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

// Ingest gets a higher limit: 5000 req/min per IP (high-volume writes)
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
})

app.get('/health', (_req, res) => res.json({
  status: 'ok',
  version: '0.1.0',
  ts: new Date().toISOString(),
}))

app.use('/api/auth', authRouter)
app.use('/api/ingest', ingestLimiter, authMiddleware, ingestRouter)
app.use('/api/stats', authMiddleware, statsRouter)
app.use('/api/projects', authMiddleware, projectsRouter)

app.listen(PORT, () => {
  console.log(`MCPSpend API v0.1.0 running on port ${PORT}`)
})

export default app
