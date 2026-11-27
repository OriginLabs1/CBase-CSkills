# 0006 — Separate capability grants from observability consent

Status: accepted for v0.0.2 implementation

## Context

v0.0.1 already has permission grants for subjects invoking capabilities. The blueprint adds a different authorization: an authorized programmer or CoreCenter observing another person's operational data. Conflating these would silently expand a local capability permission into cross-user access.

## Decision

- Capability grants remain in `@oneorigin/contracts` and govern a subject acting on a resource inside one product.
- `ConsentGrant` in `@oneorigin/identity` governs observation or administration of a person's data and follows invitation → identity verification → scope disclosure → accept/decline → authorization → expiry/revocation.
- No transition may skip verification or disclosure. A declined grant grants no access. Expiry is computed from `expiresAt` even without a background job.
- The `user-content` data category requires a separate explicit `userContentAuthorizationId`. Default observability covers operational metadata only.
- Initial CoreCenter eligibility is enforced server-side through verified authorization records, not by matching email addresses in application code.
- Revocation takes effect for subsequent reads immediately; already-observed records remain in the audit trail and remain verifiable.

## Consequences

- CoreCenter cannot use a capability grant as a substitute for consent.
- Product teams must disclose data categories in human-readable form before acceptance.
- Tests must assert that private fields never appear in observability payloads or public profiles.
