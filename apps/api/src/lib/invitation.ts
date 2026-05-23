import { randomBytes, createHash } from 'node:crypto'

export function generateInvitationToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(plaintext).digest('hex')
  return { plaintext, hash }
}

export function hashInvitationToken(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

export function buildAcceptUrl(token: string): string {
  const base = process.env.DASHBOARD_URL || 'https://mcpspend.com'
  return `${base}/accept-invitation?token=${encodeURIComponent(token)}`
}
