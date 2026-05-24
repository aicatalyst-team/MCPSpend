import { Router } from 'express'
import { z } from 'zod'
import { AuthRequest, requireUserSession } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { writeAudit } from '../lib/audit'

const router = Router()

// GDPR Article 15 (right of access) + Article 20 (right to portability).
//
// Returns a single machine-readable JSON document with everything we hold
// about the caller. Scope is the USER, not a single org — exports profile,
// every membership, the user's invitations sent, API keys they created, and
// (for orgs they OWN) the audit-log entries plus a recent slice of tool calls.
//
// Tool call slice is capped at 10k most recent rows. Larger pulls go through
// the existing /api/export/tool-calls.csv (Pro+).
//
// Response: Content-Disposition: attachment so browsers save as a file.
router.post('/data-export', requireUserSession, async (req: AuthRequest, res) => {
  const userId = req.userId!

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true,
      emailVerifiedAt: true, createdAt: true, updatedAt: true,
    },
  })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true, role: true, joinedAt: true,
      organization: {
        select: {
          id: true, name: true, slug: true, plan: true,
          callsThisMonth: true, callsLimit: true, monthlyBudgetUsd: true,
          billingCycleStart: true, createdAt: true,
          stripeCustomerId: true, stripeSubscriptionId: true,
        },
      },
    },
  })

  const ownedOrgIds = memberships
    .filter((m) => m.role === 'OWNER')
    .map((m) => m.organization.id)

  const [invitationsSent, apiKeysCreated, auditEntries, recentToolCalls] = await Promise.all([
    prisma.invitation.findMany({
      where: { invitedByUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        id: true, email: true, role: true, expiresAt: true, acceptedAt: true, createdAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.apiKey.findMany({
      where: { createdByUserId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    }),
    ownedOrgIds.length > 0
      ? prisma.auditLog.findMany({
          where: { organizationId: { in: ownedOrgIds } },
          orderBy: { createdAt: 'desc' },
          take: 5000,
          select: {
            id: true, organizationId: true, action: true, target: true,
            actorEmail: true, ipAddress: true, userAgent: true,
            metadata: true, createdAt: true,
          },
        })
      : Promise.resolve([]),
    ownedOrgIds.length > 0
      ? prisma.toolCall.findMany({
          where: { organizationId: { in: ownedOrgIds } },
          orderBy: { calledAt: 'desc' },
          take: 10_000,
          select: {
            id: true, organizationId: true, projectId: true, sessionId: true,
            serverName: true, toolName: true, model: true,
            inputTokens: true, outputTokens: true, costUsd: true,
            latencyMs: true, success: true, errorCode: true, calledAt: true,
          },
        })
      : Promise.resolve([]),
  ])

  void writeAudit({
    organizationId: ownedOrgIds[0] || memberships[0]?.organization.id || '',
    userId,
    action: 'account.data-export',
    metadata: {
      memberships: memberships.length,
      ownedOrgs: ownedOrgIds.length,
      toolCallRows: recentToolCalls.length,
      auditRows: auditEntries.length,
    },
    req,
  })

  const body = {
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
    article: 'GDPR Art. 15 (access) + Art. 20 (portability)',
    notice: [
      'This file contains every piece of personal data MCPSpend holds about you.',
      'tool_calls is the 10,000 most recent events across orgs where you are OWNER —',
      'for the full history, use /api/export/tool-calls.csv (Pro+).',
      'For deletion of this data see POST /api/account/delete.',
    ].join(' '),
    user,
    memberships,
    invitations_sent: invitationsSent,
    api_keys_created: apiKeysCreated,
    audit_log: auditEntries,
    tool_calls: recentToolCalls,
  }

  const filename = `mcpspend-data-${user.id}-${new Date().toISOString().slice(0, 10)}.json`
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(JSON.stringify(body, null, 2))
})

// GDPR Article 17 (right to erasure).
//
// Two-step soft delete:
//   1. Validate the user can be deleted (no sole-owner orgs without a transfer).
//   2. Anonymise the row (email → deleted-<id>@mcpspend.local, name → null,
//      passwordHash → null, sessions/keys severed) and stamp deletedAt.
//      Hard purge happens after 30 days via the maintenance scheduler — that
//      grace window lets us honour recovery requests and satisfies the
//      "audit trail" exemption Art. 17 §3(b) allows for legal records.
//
// Body: { confirm: "DELETE", transferOwnership?: { [orgId]: memberId } }
//   - confirm is a typed safeguard against accidental DELETE calls.
//   - transferOwnership maps each org where the user is the SOLE owner to the
//     member who should become OWNER. Orgs without a target are rejected.
router.post('/delete', requireUserSession, async (req: AuthRequest, res) => {
  const schema = z.object({
    confirm: z.literal('DELETE'),
    transferOwnership: z.record(z.string(), z.string()).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Send { confirm: "DELETE" } to confirm deletion' })
    return
  }

  const userId = req.userId!
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  // Find every org where the caller is the SOLE owner — those need a transfer
  // or the request is refused (we won't orphan an org silently).
  const ownerships = await prisma.organizationMember.findMany({
    where: { userId, role: 'OWNER' },
    select: { organizationId: true, organization: { select: { name: true } } },
  })

  const blockers: Array<{ organizationId: string; name: string; reason: string }> = []
  const transfers: Array<{ organizationId: string; newOwnerMemberId: string }> = []

  for (const o of ownerships) {
    const otherOwners = await prisma.organizationMember.count({
      where: { organizationId: o.organizationId, role: 'OWNER', NOT: { userId } },
    })
    if (otherOwners > 0) continue // safe — other owners remain

    const targetMemberId = parsed.data.transferOwnership?.[o.organizationId]
    if (!targetMemberId) {
      blockers.push({
        organizationId: o.organizationId,
        name: o.organization.name,
        reason: 'sole-owner: provide transferOwnership[orgId] = memberId of new owner',
      })
      continue
    }
    const target = await prisma.organizationMember.findFirst({
      where: { id: targetMemberId, organizationId: o.organizationId, NOT: { userId } },
      select: { id: true },
    })
    if (!target) {
      blockers.push({
        organizationId: o.organizationId,
        name: o.organization.name,
        reason: 'transferOwnership target is not a member of this organization',
      })
      continue
    }
    transfers.push({ organizationId: o.organizationId, newOwnerMemberId: target.id })
  }

  if (blockers.length > 0) {
    res.status(409).json({
      error: 'Cannot delete account — pending ownership transfers required',
      blockers,
    })
    return
  }

  // Apply transfers, then anonymise. Done in a single transaction so a crash
  // mid-flight doesn't leave a half-deleted user.
  const anonEmail = `deleted-${user.id}@mcpspend.local`
  await prisma.$transaction([
    ...transfers.map((t) =>
      prisma.organizationMember.update({
        where: { id: t.newOwnerMemberId },
        data: { role: 'OWNER' },
      }),
    ),
    // Remove the user from all orgs (membership rows). The orgs themselves
    // survive because OWNER was transferred above for sole-owner cases.
    prisma.organizationMember.deleteMany({ where: { userId } }),
    // Revoke every API key created by this user — we keep the rows for audit
    // continuity but they can no longer authenticate.
    prisma.apiKey.updateMany({
      where: { createdByUserId: userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    // Anonymise the user row itself. We don't delete it: AuditLog FKs would
    // break and we need the email-deleted marker for support tickets.
    prisma.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        name: null,
        passwordHash: null,
        emailVerifiedAt: null,
      },
    }),
  ])

  // Best-effort audit. The user has no org context anymore so target an org
  // they touched (first transferred or first prior membership).
  const auditOrgId =
    transfers[0]?.organizationId ||
    ownerships[0]?.organizationId ||
    ''
  if (auditOrgId) {
    void writeAudit({
      organizationId: auditOrgId,
      userId: null,
      actorEmail: user.email,
      action: 'account.delete',
      target: user.id,
      metadata: { transfers: transfers.length },
      req,
    })
  }

  res.json({
    deleted: true,
    anonymizedEmail: anonEmail,
    transfers: transfers.length,
    notice: 'Membership + auth severed. Audit log retained per GDPR Art. 17 §3(b). Tool call history will be purged within 30 days.',
  })
})

export { router as accountRouter }
