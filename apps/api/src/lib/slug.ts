import { randomBytes } from 'node:crypto'

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'org'
}

export function randomSlugSuffix(): string {
  return randomBytes(3).toString('hex')
}
