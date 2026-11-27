# 0005 — Provider-independent identity with email OTP proofs

Status: accepted for v0.0.2 implementation

## Context

The v0.0.2 blueprint requires passwordless email OTP registration and sign-in, but also states that no permanent identity should depend on an email or credential provider. Google sign-in and compulsory passkeys are not requirements. Guest mode must work without any identity service.

## Decision

- An `Identity` has an issuer-independent id: `urn:oneorigin:identity:<sha256>` derived from a user-held key. Email addresses are verified `EmailCredential` records attached to that identity, never its primary key.
- Email OTP is the primary proof mechanism: six digits, five-minute expiry, single use, at most five incorrect attempts, hashed challenge storage, rate limiting and generic responses that do not disclose account existence.
- Email delivery is an interchangeable adapter (`smtp`, `api`, `memory` for tests). Optional methods (magic links, TOTP, hardware keys, passkeys) add credentials; they do not replace the identity id.
- Multiple issuers are permitted. Consumers configure trusted issuers and revocation lists; an issuer does not own an identity.
- Verifiable records use the `oneorigin.verification/v0.0.2` envelope with canonical content hashes and optional signatures. Signatures establish integrity and origin, never safety.

## Consequences

- Losing access to an email provider does not destroy the identity; recovery codes and additional credentials are provider-independent.
- The optional service must be implemented before membership and cross-product sync are usable, but no web build may require it.
- Identity ids are not human-readable, so profiles provide handles and display names with explicit visibility.
