# 0007 — Three deployments, one persistence contract

Status: accepted for v0.0.2 implementation

## Context

The blueprint requires user-controlled edge/local databases, OneOrigin-operated PostgreSQL and independently operated PostgreSQL, all through identical contracts. v0.0.1 web apps are static and store data in IndexedDB.

## Decision

- All stores implement `PersistenceAdapter` from `@oneorigin/persistence`: opaque byte get/put/delete/list plus append-only `eventsAfter` and `checkpoint`.
- Local edge deployments use IndexedDB; SQL deployments use PostgreSQL through the same adapter and the same validated record envelopes.
- Synchronization transfers change events and checkpoints. Authorization, consent and audit records are never silently last-write-wins merged; conflicts are surfaced for human resolution.
- A `MemoryPersistenceAdapter` is the conformance reference. Every adapter must pass the same tests.
- New contracts are additive: `oneorigin.capability/v0.0.1` and `oneorigin.bundle/v0.0.1` remain valid and importable in v0.0.2.

## Consequences

- Offline guest use remains fully functional; the service is an optional capability, not a dependency.
- Implementing a CRDT is deferred until a concrete need is demonstrated for low-risk user content.
- PostgreSQL operators need documented trust anchors, migration paths and backups; a connection string alone is not a deployment model.
