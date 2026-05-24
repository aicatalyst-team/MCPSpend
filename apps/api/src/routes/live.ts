// Server-Sent Events stream of live tool calls for the dashboard.
//
// Pattern:
//   - Client opens GET /api/stats/live (EventSource), authenticated via the
//     usual JWT or API-key bearer
//   - We subscribe to the Redis pub/sub channel `live:<orgId>` and forward
//     every message as an SSE `data: {...}` line
//   - 15s heartbeat (SSE comment) keeps reverse proxies from closing idle
//     connections
//   - On client disconnect we unsubscribe + quit the subscriber connection
//
// EventSource is auto-reconnecting in browsers — if the worker briefly
// restarts the dashboard reconnects within ~2 seconds. We don't replay
// missed events; the ticker is "what's happening right now", not history.

import { Router } from 'express'
import { AuthRequest, requireOrg } from '../middleware/auth'
import { createSubscriber } from '../lib/redis'

const router = Router()

router.get('/', requireOrg, async (req: AuthRequest, res) => {
  const orgId = req.organizationId!

  // SSE protocol setup
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disables nginx buffering if behind one
  res.flushHeaders?.()

  // Initial hello so the client knows the connection is up
  res.write(`event: hello\ndata: {"orgId":"${orgId}"}\n\n`)

  const sub = createSubscriber()
  const channel = `live:${orgId}`
  await sub.subscribe(channel)

  const onMessage = (chan: string, message: string) => {
    if (chan !== channel) return
    res.write(`data: ${message}\n\n`)
  }
  sub.on('message', onMessage)

  // 15s heartbeat — SSE comment lines start with ":" and clients ignore them
  // but they keep proxies from killing idle TCP connections.
  const heartbeat = setInterval(() => {
    res.write(`:hb ${Date.now()}\n\n`)
  }, 15_000)

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat)
    void sub.unsubscribe(channel).catch(() => {})
    void sub.quit().catch(() => {})
  })
})

export { router as liveRouter }
