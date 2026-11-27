# 07 — Identity & passwordless authentication (v0.0.2)

Normative language as defined in [the specs index](README.md). Machine-readable schemas: [`packages/identity/src/schemas`](../../packages/identity/src/schemas).

## Identity

An identity is provider-independent. Its id MUST be `urn:oneorigin:identity:<64 lowercase hex chars>` and MUST NOT be an email address, provider user id or credential. Email addresses and other sign-in methods are `Credential` records that prove control at a point in time.

An `Identity` MAY carry a `keyId` referencing a public key or key handle. Secret material MUST NOT appear in any identity record, bundle or audit entry.

## Email OTP

1. A client submits an email address; the service normalizes it (trim, lowercase) and stores only `sha256:<hex>` of the normalized value.
2. The service generates a cryptographically secure six-digit code, stores `sha256:<hex>` of `code + challengeId`, and sets expiry to five minutes.
3. An interchangeable SMTP/API adapter delivers the code. Delivery failures MUST NOT disclose account existence.
4. Verification accepts exactly six digits. A challenge permits at most five incorrect attempts, then becomes `exhausted`.
5. Successful verification marks the challenge `verified` (single use), creates or links an `EmailCredential`, and issues a `Session`.
6. Responses for unknown, expired, exhausted and already-used challenges MUST be indistinguishable to the caller.

Rate limiting MUST apply per email hash and per source address. Codes MUST be compared in constant time. Code values MUST NOT be logged, returned by any API, or persisted in plaintext.

## Sessions

Sessions have an id, identity id, issue time and expiry. Refresh MUST rotate the session id. Revocation MUST take effect for subsequent requests immediately. Session identifiers MUST NOT be placed in URLs or bundles.

## Guest mode

Guest mode MUST remain fully usable with no identity service, no account and no network. Membership adds capabilities; it is never a precondition for local work.

## Verifiable records

Identity, membership, consent and authorization records intended for independent verification use `oneorigin.verification/v0.0.2`:

```
contentHash = sha256:<hex> of canonicalJson(schema, kind, subject, issuer, issuedAt, expiresAt, payload)
```

`proof` and `chain` are excluded from the hash. A `sha256` proof is a self-integrity check; an `ed25519` proof requires a trusted public key and MUST NOT be described as verified without that check. A hash-chain break MUST be surfaced, never silently repaired.
