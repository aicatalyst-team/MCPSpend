# Contributing to MCPSpend

Thanks for considering a contribution! MCPSpend is a small project run by a
solo founder, so every PR — typo fix, bug report, feature idea — is genuinely
appreciated.

## Ground rules

- Be kind. We follow the [Contributor Covenant](CODE_OF_CONDUCT.md).
- Search existing [issues](https://github.com/andreisirbu91-lab/MCPSpend/issues)
  before opening a new one.
- One PR per logical change. Big PRs are harder to review and slower to merge.
- Security issues do **not** go in public issues — email **security@mcpspend.com**
  (see [SECURITY.md](SECURITY.md)).

## Project layout

```
apps/
  api/         Express + Prisma + BullMQ — ingest, billing, MCP HTTP server
  dashboard/   Next.js 15 + Tailwind — mcpspend.com
packages/
  proxy/             @mcpspend/proxy — stdio observability proxy (on npm)
  mcp-server/        @mcpspend/mcp-server — query MCPSpend from any MCP client
  vscode-extension/  mcpspend-vscode (on Open VSX)
```

## Local development

Prerequisites: Node 20+, pnpm 9+, Postgres 15+, Redis 7+.

```sh
git clone https://github.com/andreisirbu91-lab/MCPSpend.git
cd MCPSpend
pnpm install

# Copy + edit env
cp apps/api/.env.example apps/api/.env

# Run migrations
pnpm --filter @mcpspend/api db:migrate

# Start everything (api on :4000, dashboard on :3000)
pnpm dev
```

## Submitting a PR

1. Fork the repo, create a branch off `main` (`git checkout -b feat/your-thing`).
2. Make your change. Keep diffs focused.
3. Run `pnpm lint && pnpm typecheck` before pushing.
4. Open the PR against `main`. The PR template will guide you on what to include.
5. CI must be green before review.

## Commit messages

We use Conventional Commits loosely:

- `feat(scope): short imperative description`
- `fix(scope): short imperative description`
- `chore(scope): tooling / cleanup`
- `docs(scope): docs only`

Examples: `feat(audit): add member.invite-revoke chip`, `fix(billing): handle Stripe 4xx on cancel`.

## What we won't merge (without discussion first)

- New runtime dependencies — keep the proxy small.
- Telemetry that increases what the proxy sends home (it currently sends metadata only, never tool arguments / responses).
- Breaking API changes to `/v1/ingest` — paying users depend on it.

Open an issue first if you're planning anything in those areas, and we'll figure
out the cleanest path together.

## Questions?

- General: `support@mcpspend.com`
- Security: `security@mcpspend.com`
- Conduct concerns: `conduct@mcpspend.com`
