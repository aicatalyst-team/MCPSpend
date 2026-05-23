import { randomBytes, createHash } from 'node:crypto'

const ENV = process.env.NODE_ENV === 'production' ? 'live' : 'test'
const PREFIX = `mcps_${ENV}_`

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  // 24 bytes → 32 base64url chars → ~192 bits entropy
  const raw = randomBytes(24).toString('base64url')
  const plaintext = `${PREFIX}${raw}`
  const prefix = plaintext.slice(0, 12) + '…'
  const hash = createHash('sha256').update(plaintext).digest('hex')
  return { plaintext, prefix, hash }
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}
