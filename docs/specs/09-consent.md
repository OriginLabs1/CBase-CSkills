# 09 — Consent & programmer observability (v0.0.2)

Programmer observability is **disabled by default**. It exists only when an explicit, scoped, revocable `ConsentGrant` is active. This contract is distinct from the capability grants in [03-trust-permissions.md](03-trust-permissions.md).

## Lifecycle

```
invited → identity-verified → scope-disclosed → active
                                    ↘ declined
active → expired | revoked
```

`verify` requires a verification id. `disclose` requires a human-readable scope disclosure. `accept` may only follow `scope-disclosed` and MUST record `acceptedAt`, producing an auditable authorization record. `decline` grants no access. `expire` takes effect when `expiresAt` is reached even without a background job. `revoke` MUST record `revokedAt` and stop subsequent access immediately. No transition out of `declined`, `expired` or `revoked` is permitted.

## Required invitation content

Every invitation MUST specify:

- the inviting owner or explicitly delegated administrator;
- the verified identity of the programmer or operator;
- the purpose and application concerned;
- data categories and permitted operations;
- duration and expiry;
- the revocation mechanism.

## Data categories

Operational categories: `application-health`, `execution-lifecycle`, `authorization-outcome`, `audit-integrity`, `operational-failure`, `workspace-diagnostics`, `capability-health`, `skill-lifecycle`, `execution-provenance`, `compatibility`.

`user-content` is a separate category. It MUST NOT be included without an explicit `userContentAuthorizationId`. Consent to operational metrics never authorizes access to private user content.

The `administrate` operation is valid only for grants of kind `administration`. Observation grants are `read`/`diagnose` by default.

## Eligibility

The blueprint names `sircollins1@protonmail.com` and `nasirusuleiman3786@gmail.com`, plus individuals explicitly notified and authorized by Sir Collins or an appointed administrator, as initially eligible for CoreCenter. Eligibility MUST be established by verified authorization records held by the service. Email addresses alone never establish authorization, and client applications MUST NOT treat an address string as a grant.

## Privacy and revocation

Observability responses MUST contain operational metadata only by default. Telemetry MUST be minimal and off by default for anything containing content. Consent history, including declines, expiries and revocations, MUST remain auditable. Revocation does not undo past observations, but their provenance records MUST remain verifiable.
