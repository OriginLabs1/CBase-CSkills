# 11 — Persistence & synchronization (v0.0.2)

This specification extends [05-storage-and-portability.md](05-storage-and-portability.md). v0.0.1 bundle records remain valid.

## Adapter

All three deployment models implement `PersistenceAdapter` from `@oneorigin/persistence`:

- `get`, `put`, `delete`, `list` for opaque validated bytes;
- `append`, `eventsAfter`, `checkpoint` for the change journal.

`kind` is one of `edge-local`, `oneorigin-postgresql` or `independent-postgresql`. Deployment model MUST NOT change record shapes or validation rules. `MemoryPersistenceAdapter` is the conformance reference.

## Journal

Every mutation appends a `oneorigin.event/v0.0.2` record with a unique id, namespace, key, operation, monotonic sequence, timestamp, actor, optional `valueHash` (required for `put`) and `previousEventId`. A chain break MUST be reported by `verifyEventChain` and surfaced to the user; it MUST NOT be silently repaired.

Namespaces extend the v0.0.1 set with `identities`, `credentials`, `profiles`, `organizations`, `memberships`, `roles`, `invitations`, `consents`, `verifications`, `templates`, `template-versions`, `events` and `sync`.

## Checkpoints and sync

A `oneorigin.checkpoint/v0.0.2` stores `storeId`, `lastSequence`, `headHash` and `updatedAt`. Synchronization transfers events after a sequence and resumes from a checkpoint. Checkpoints MUST be immutable and content-addressed.

## Conflicts

`mergeEvents` produces a deterministic union and a conflict list. Conflicting writes to the same namespace/key/sequence MUST be surfaced for resolution. Authorization, membership, consent and audit records MUST NOT be silently resolved by last-write-wins. Automatic convergence mechanisms (for example CRDTs) are deferred until a demonstrated need for low-risk user content exists.

## Deployment requirements

- User-controlled edge/local stores remain functional offline.
- OneOrigin-operated and independently operated PostgreSQL deployments use the same contracts, migrations and conformance suite.
- Operators MUST document trust anchors, migration paths, backups and revocation lists. A connection string alone is not a deployment model.
