# 08 — Membership & roles (v0.0.2)

## Entities

`ProgrammerProfile`, `Organization`, `Membership`, `Role` and `Capability` (authorization concept) MUST carry identity, ownership, scope, versioning and verification properties. Schemas are published in [`packages/identity`](../../packages/identity/src/schemas).

Profiles SHOULD contain a handle, display name and visibility of `public`, `members` or `self`. Profiles MUST NOT contain email addresses, credential hashes, session identifiers or private content. A profile projection for another viewer MUST be computed with `profileForViewer`; private fields MUST NOT be serialized into observability or public API payloads.

## Membership

A membership binds an identity to an organization with one or more roles and a status of `invited`, `active`, `suspended` or `revoked`. Membership MAY expire. Revocation MUST be auditable and MUST prevent subsequent use of role-derived privileges.

Membership establishes participation and privileges. It MUST NOT imply unrestricted authority, access to every capability, or permission to observe another member's data.

## Roles and delegated administration

Roles MUST be named, scoped and versioned. Administrator appointments MUST be explicitly delegated by an owner or an already-authorized administrator, scoped to named resources/operations, time-bounded where practical, and revocable. Delegation chains MUST be verifiable and MUST NOT allow an appointee to expand their own authority.

## Invitations

An invitation MUST identify the inviter, the invited identity (or a verified contact proof), the purpose, the role or membership scope, and an expiry. Accepting an invitation creates an auditable membership record. Declining grants nothing.

## Portability

A member MUST be able to export and independently verify their own identity, membership, role and authorization records from an edge database or supported PostgreSQL deployment. Export MUST NOT include another person's private data.
