<!-- Thanks for the PR! Please fill in the sections below. -->

## What

<!-- One sentence: what does this PR change? -->

## Why

<!-- One sentence: why is this change needed? Link an issue if there is one (Closes #123). -->

## How

<!-- Brief notes on the approach, anything reviewers should look at carefully. -->

## Checklist

- [ ] CI is green (`pnpm lint && pnpm typecheck` pass locally)
- [ ] No new runtime dependencies in `packages/proxy` (or rationale below)
- [ ] No changes to what the proxy sends home (tool args / response bodies still stay on the user's machine)
- [ ] If this changes the public API surface (`/v1/ingest`, `/api/mcp` RPCs, dashboard `/api/*`), updated docs / `server-card.json` accordingly
- [ ] If this touches billing, tested both the upgrade and the cancel path
- [ ] Security-relevant change? Cross-referenced [`SECURITY.md`](../SECURITY.md)

## Screenshots / output

<!-- For UI changes, drop a screenshot. For CLI changes, paste the new output. -->
