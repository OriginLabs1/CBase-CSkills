# Delivery roadmap

## v0.0.2 planning

The unified v0.0.2 blueprint adds shared identity, membership, consent, templates, optional PostgreSQL persistence and CoreCenter. The gap analysis, decisions and sequenced workstreams are in [docs/v0.0.2-gap-analysis.md](v0.0.2-gap-analysis.md). P0 (decisions), P1 (shared contracts), P2 (product integration) and P3 (optional service) are delivered; CoreCenter is maintained in the external `OriginLabs1/CoreCenter` repository. The milestones below describe the v0.0.1 baseline that v0.0.2 extends additively.

## Milestone 0 — Shared specs & contracts (v0.0.1)

**Goal:** make both products implementable without a central service.

Exit criteria:

- Capability manifest JSON Schema and TypeScript types published in `packages/contracts`.
- `SKILL.md` conformance rules and stable diagnostic codes published in `packages/skill-kit`.
- Trust/permission model and execution lifecycle specified.
- Storage and portability bundle format specified.
- Conformance tests run in CI.

## Milestone 1 — CoreSkills v0.0.1

**Goal:** a polished, local-first capability catalog that speaks the open Agent Skills dialect.

Exit criteria:

- Import `SKILL.md` (file picker and paste) with a readable validation report.
- Author and edit skills in CodeMirror with live conformance feedback.
- Immutable version history with content hashes and restore.
- Discovery: search, tag/domain filters, sorting.
- Export: single `SKILL.md` and portable JSON bundle; bundle import.
- Guest mode works fully offline with transparent limitations.
- PWA installable on constrained Android devices.
- `check`, `test` and conformance suite pass.

## Milestone 2 — CoreBase v0.0.1

**Goal:** a polished workspace with working, bounded execution and a visible trust chain.

Exit criteria:

- Persistent projects, files and editor with CodeMirror.
- Terminal sessions over an explicit, sandboxed virtual shell (safe command subset).
- Adapter interfaces for remote and native execution; no unrestricted browser shell.
- Provider-neutral model/agent adapter contract with an offline deterministic adapter.
- Permission prompts, revocation and hash-chained audit/provenance for consequential actions.
- Resumable sessions and checkpoints.
- `check`, `test` and conformance suite pass.

## Milestone 3 — Repo + Cloudflare

Exit criteria:

- Git history initialized with a clean, reviewable structure.
- GitHub remote configured; Actions run checks and publish releases.
- Secrets stored as GitHub Actions/Repository secrets, never in source.
- Cloudflare Pages configuration for both apps, deployable independently.

## Milestone 4 — Distribution

Exit criteria:

- GitHub Release with source archives, checksums and release notes.
- Published npm packages for shared contracts (when stable).
- PWA/web deployments for both products.
- Documented self-hosting path.

## Deliberate non-goals for v0.0.1

- Accounts, billing, federation, remote catalogs, multi-user collaboration.
- Real privileged native execution from the browser.
- Redefining or forking the Agent Skills standard.
- Introducing libraries without a demonstrated need.
