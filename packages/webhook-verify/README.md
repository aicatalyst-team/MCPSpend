# @mcpspend/webhook-verify

Verify MCPSpend webhook signatures in 3 lines. Zero deps, works anywhere Node-compatible.

## Install

```sh
npm install @mcpspend/webhook-verify
```

## Express

```typescript
import express from 'express'
import { verifyAndParse, MCPSpendEvent } from '@mcpspend/webhook-verify'

const app = express()

app.post('/mcpspend',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    try {
      const event = verifyAndParse<MCPSpendEvent>({
        body: req.body,
        signature: req.header('X-MCPSpend-Signature') ?? '',
        secret: process.env.MCPSPEND_WEBHOOK_SECRET!,
      })
      // Handle the event …
      if (event.type === 'spend.alert') { /* page someone */ }
      res.status(204).end()
    } catch {
      res.status(401).send('bad signature')
    }
  },
)
```

## Next.js Route Handler

```typescript
import { verifyWebhook } from '@mcpspend/webhook-verify'

export async function POST(req: Request) {
  const body = await req.text()
  const ok = verifyWebhook({
    body,
    signature: req.headers.get('x-mcpspend-signature') ?? '',
    secret: process.env.MCPSPEND_WEBHOOK_SECRET!,
  })
  if (!ok) return new Response('bad signature', { status: 401 })

  const event = JSON.parse(body)
  // …
  return new Response(null, { status: 204 })
}
```

## API

- `verifyWebhook(args)` — boolean check, constant-time. Never throws.
- `verifyAndParse<T>(args)` — verifies + JSON parses. Throws on either failure.
- `signBody(body, secret)` — compute the expected signature (useful for tests).

## Event types

Importable union: `MCPSpendEventType`. Current values: `budget.alert`, `spend.alert`, `anomaly.detected`, `key.create`, `key.revoke`, `member.invite`, `member.remove`, `project.create`, `project.delete`.

## License

MIT. © NewRzs SRL.
