// AES-256-GCM symmetric encryption for secrets stored in the database
// (Slack webhook URLs today, more later). The key comes from APP_ENCRYPTION_KEY
// env var as 64 hex chars (= 32 bytes). If unset, we run in passthrough mode:
// values are stored plain. This keeps local dev cheap while making production
// encryption mandatory once the env var is set.
//
// Ciphertext format: `enc:v1:<base64(iv)>:<base64(tag)>:<base64(ciphertext)>`
// where iv is 12 bytes (96 bits, GCM standard) and tag is 16 bytes.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const PREFIX = 'enc:v1:'

function getKey(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY
  if (!raw) return null
  if (!/^[0-9a-f]{64}$/i.test(raw)) {
    throw new Error('APP_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with `openssl rand -hex 32`.')
  }
  return Buffer.from(raw, 'hex')
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return null
  const key = getKey()
  if (!key) return plain // dev passthrough — value stored plain
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
}

export function decrypt(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') return null
  if (!stored.startsWith(PREFIX)) return stored // legacy plaintext or dev value
  const key = getKey()
  if (!key) {
    // Encrypted value exists but no key configured — refuse to surface to avoid
    // exposing what looks like ciphertext to the client.
    return null
  }
  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) return null
  try {
    const [ivB64, tagB64, ctB64] = parts
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return pt.toString('utf8')
  } catch {
    return null
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX)
}
