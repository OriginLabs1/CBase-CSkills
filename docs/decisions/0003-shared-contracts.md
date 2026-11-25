# 0003 — Shared contracts, independent implementations

Status: accepted (v0.0.1)

## Context

CoreBase and CoreSkills must be independently deployable, but need to exchange capability descriptions, permission scopes, execution records and bundles.

## Decision

- Publish `@oneorigin/contracts` and `@oneorigin/skill-kit` as source packages consumed by both apps.
- Normative text lives in `docs/specs/`; TypeScript and JSON Schema are derived views.
- Apps share no runtime service and no central database.

## Consequences

- Conformance tests can be run once in the packages and relied on by both products.
- Contract changes require coordinated version bumps and a documented migration note.
- An implementation may replace either app without breaking the other.
