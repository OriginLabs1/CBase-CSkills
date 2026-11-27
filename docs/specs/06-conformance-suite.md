# 06 — Conformance suite (v0.0.1)

Conformance is executed by `npm test` in each workspace. The suite is deterministic and offline.

## Coverage

| Area | Checked by | Examples |
| --- | --- | --- |
| Capability manifest | `packages/contracts/src/validate.test.ts` | required fields, permission scopes, unknown fields, canonical JSON |
| SKILL.md | `packages/skill-kit/src/skill-kit.test.ts` | valid Agent Skills file, missing fence, malformed YAML, directory-name mismatch, security diagnostics |
| Identity | `packages/skill-kit/src/skill-kit.test.ts` | stable SHA-256 identity for identical documents |
| Bundles | `packages/skill-kit/src/skill-kit.test.ts` | signature verification, item hash verification, unsafe path rejection |
| CoreSkills helpers | `apps/coreskills` tests | filtering, import decisions, version ordering |
| CoreBase helpers | `apps/corebase` tests | command parsing, permission decisions, audit chain, verification |
| Identity and credentials | `packages/identity` tests | identity ids, OTP shape/limits, credential privacy |
| Consent lifecycle | `packages/identity` tests | state transitions, decline, expiry, revocation, `user-content` boundary |
| Verifiable envelopes | `packages/identity` tests | canonical content hash, hash proof, tampered records |
| Templates | `packages/templates` tests | safe paths, file hashes, typed inputs, rendering, combination |
| Persistence and sync | `packages/persistence` tests | event validation, chain integrity, conflict surfacing, adapter parity |

## Rules for new diagnostics

1. A diagnostic code is stable for the life of a contract version; never reuse it with a different meaning.
2. Every diagnostic is reproducible from the input alone — no clock, locale or environment dependence.
3. Severity changes require a contract version bump.
4. Security diagnostics are advisory unless the input violates an explicit byte/size constraint.

## Adding a conformance case

Add a fixture and assertion to the relevant workspace test file. If the case changes the contract text, update `docs/specs/` in the same change and note it in the release notes.
