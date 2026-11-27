# 13 — Account recovery (v0.0.2)

## Requirement

A user MUST be able to recover control of an identity without depending on a single email provider, credential provider or operator. Recovery MUST NOT silently replace an existing identity key.

## Mechanisms

1. **Recovery codes.** Generated locally or by the service, shown once, stored hashed, single-use and revocable. Using a code requires a fresh authenticated session and MUST revoke all existing sessions.
2. **Additional credentials.** TOTP, hardware security keys or passkeys MAY be added to an identity. They are proofs attached to the identity, not new identities.
3. **Verified alternate channel.** A second verified email address or equivalent channel MAY be used when configured before loss occurs.

## Rules

- Recovery MUST create an auditable record with actor, time, method and affected identity.
- The service MUST rate-limit recovery attempts and MUST NOT disclose whether an identity exists.
- Recovery of an identity MUST NOT grant access to another person's data or to capability grants scoped to a different subject.
- Active consent grants survivor-checked against the recovered identity: grants whose subject is the recovered identity remain valid; grants whose grantee identity cannot be re-verified MUST be suspended pending verification.
- Local edge databases MUST support recovery from an exported, user-held record without contacting a service.
