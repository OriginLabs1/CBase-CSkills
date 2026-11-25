# 03 — Trust, Identity & Permissions (v0.0.1)

## Principles

1. **Default deny.** No capability receives a permission it did not request and the user did not grant.
2. **Least authority.** Requests are scoped, purpose-bound and time-bounded where practical.
3. **Explicit consent.** Consequential actions require a human-visible approval with the exact scope and target.
4. **Revocable.** Every grant can be revoked; revocation takes effect for subsequent actions immediately.
5. **No ambient authority.** A browser build MUST NOT expose unrestricted shell, filesystem or credential access.
6. **Guest-first.** Useful operation and user-owned data MUST NOT depend on registration.

## Subjects and resources

- **Subject:** the actor requesting an action — a human session, an agent run, or a capability invoked by either.
- **Resource:** a workspace, file set, model provider, network destination, credential store or execution environment.
- **Grant:** an authorization binding a subject to a scope on a resource.

```ts
interface Grant {
  id: string;                     // sha256 of canonical grant fields
  subject: string;                // session or capability identity
  capabilityId: string;
  capabilityVersion: string;
  scope: PermissionScope;         // from capability manifest
  resource: string;               // e.g. "workspace:ws_123", "network:api.example.com"
  decision: 'allow' | 'deny';
  grantedAt: string;              // RFC 3339
  expiresAt?: string;
  revokedAt?: string;
  reason: string;
}
```

Scopes: `workspace.read`, `workspace.write`, `network`, `execution`, `credentials`, `model`, `system`.

## Decision procedure

For each action, an implementation MUST:

1. Resolve the subject and the exact target resource.
2. Determine the required scope from the capability manifest or execution adapter.
3. Check for an active, non-revoked, unexpired grant with `decision: 'allow'`.
4. If none exists, request approval showing capability identity, scope, target and reason.
5. Record the decision in the audit log with a hash chain.

An approval MUST be attributable to a human action in the UI or to a pre-authorized policy that the user configured. Silent escalation is prohibited.

## Trust signals

- `checksum` proves that bytes match a known version.
- `provenance.signatures` prove origin/integrity under a known key.
- Neither proves safety. Trust badges MUST be presented as "origin verified" / "integrity verified", never as "safe".

## Credential handling

- Credentials MUST be stored outside capability manifests and exported bundles.
- In a browser build, credentials MUST NOT be persisted to IndexedDB or local storage in plaintext.
- Server/self-hosted builds SHOULD use environment variables or a secret manager and expose only opaque references to capabilities.
- Telemetry MUST be privacy-conscious and off by default for diagnostics that include content.

## Guest and membership modes

- **Guest mode:** full local catalog/workspace use, local persistence, transparent limitations (no sync, no collaboration, no privileged execution).
- **Membership mode:** adds persistent identity, personalization, continuity and collaboration. Membership does not grant permission to every capability.

## Revocation

Revoking a grant MUST append a revocation audit event and prevent subsequent use of that grant. Already-completed actions are not retroactively undone, but their provenance records remain and MUST remain verifiable.
