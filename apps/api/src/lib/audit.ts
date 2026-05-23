// Write an audit log entry. Designed to be "fire and forget" — failures should
// NOT abort the underlying business operation. Callers `void writeAudit(...)`.
//
// Action names use dotted namespace: <subject>.<verb>. Examples:
//   billing.cancel, billing.resume, billing.upgrade
//   key.create, key.revoke
//   member.invite, member.remove, member.role-change
//   org.settings-update

import { Request } from 'express'
import { prisma } from './prisma'

export interface AuditArgs {
  organizationId: string
  userId?: string | null
  actorEmail?: string | null
  action: string
  target?: string | null
  metadata?: Record<string, unknown>
  req?: Request
}

export async function writeAudit(args: AuditArgs): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: args.organizationId,
        userId: args.userId ?? null,
        actorEmail: args.actorEmail ?? null,
        action: args.action,
        target: args.target ?? null,
        metadata: args.metadata ? (args.metadata as object) : undefined,
        ipAddress: args.req
          ? (args.req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
             args.req.socket?.remoteAddress || null)
          : null,
        userAgent: args.req
          ? (args.req.headers['user-agent']?.toString() || null)
          : null,
      },
    })
  } catch (err) {
    // Never break the caller. Log + swallow.
    console.error('[audit] failed to write', args.action, err)
  }
}
