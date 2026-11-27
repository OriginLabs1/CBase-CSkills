# Specifications index

These documents are the shared contracts for CoreBase and CoreSkills. They describe responsibilities and interfaces, not mandatory services. Implementations may differ as long as they conform.

| Document | Purpose | Status |
| --- | --- | --- |
| [01-capability-manifest.md](01-capability-manifest.md) | Portable capability description and conformance | v0.0.1 |
| [02-skill-md-conformance.md](02-skill-md-conformance.md) | `SKILL.md` format, validation codes and canonical form | v0.0.1 |
| [03-trust-permissions.md](03-trust-permissions.md) | Identity, scopes, grants, approvals, revocation | v0.0.1 |
| [04-execution-lifecycle.md](04-execution-lifecycle.md) | Intent → result lifecycle, verification, provenance | v0.0.1 |
| [05-storage-and-portability.md](05-storage-and-portability.md) | Local storage adapter, bundles, export/import | v0.0.1 |
| [06-conformance-suite.md](06-conformance-suite.md) | Deterministic tests and stable diagnostic codes | v0.0.1 |
| [07-identity-and-auth.md](07-identity-and-auth.md) | Provider-independent identity, email OTP, sessions, verifiable records | v0.0.2 |
| [08-membership.md](08-membership.md) | Programmer profiles, organizations, memberships, roles | v0.0.2 |
| [09-consent.md](09-consent.md) | Consent lifecycle and programmer observability boundaries | v0.0.2 |
| [10-templates.md](10-templates.md) | Shared template lifecycle, customization and provenance | v0.0.2 |
| [11-synchronization.md](11-synchronization.md) | Persistence adapter, change journal, checkpoints, conflicts | v0.0.2 |
| [12-observability-api.md](12-observability-api.md) | CoreCenter HTTP surface and live/offline/stale semantics | v0.0.2 |
| [13-recovery.md](13-recovery.md) | Provider-independent account recovery | v0.0.2 |

Normative language: **MUST**, **MUST NOT**, **SHOULD**, **MAY** as defined by RFC 2119.

Versioning: all contracts use semantic versioning. A `v0.0.x` contract may change; `v0.1.0` is the first stability commitment.
