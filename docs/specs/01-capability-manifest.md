# 01 — Capability Manifest (v0.0.1)

A **capability manifest** is the portable description of a reusable capability. It is the common currency between CoreSkills and CoreBase. It does not contain executable code by default; it describes what a capability is, what it needs, how it is invoked and where it came from.

## Conformance levels

- **Core** — MUST be understood by every conforming implementation.
- **Extended** — MAY be ignored by implementations that do not support it, but MUST be preserved on round-trip.

Unknown fields at any level MUST be preserved in `extensions` or ignored without error. Implementations MUST NOT reject a manifest solely because of unknown fields.

## Fields

| Field | Type | Level | Requirement |
| --- | --- | --- | --- |
| `schema` | string literal | Core | MUST be `oneorigin.capability/v0.0.1`. |
| `id` | string | Core | MUST be a stable reverse-domain identifier (`^[a-z0-9][a-z0-9._-]{2,127}$`). |
| `name` | string | Core | 1–80 characters, human readable. |
| `version` | string | Core | SemVer `MAJOR.MINOR.PATCH` without a leading `v`. |
| `kind` | enum | Core | One of the capability domains below. |
| `summary` | string | Core | 1–200 characters. |
| `description` | string | Extended | Markdown, max 64 KiB. |
| `authors` | string[] | Extended | Optional. |
| `license` | string | Extended | SPDX identifier preferred. |
| `tags` | string[] | Extended | Lowercase, max 32 entries, each 1–32 chars. |
| `entry` | string | Extended | Relative path to an entry resource inside the package; MUST NOT be absolute or contain `..`. |
| `requires` | Requirement[] | Extended | Other capabilities or external prerequisites. |
| `permissions` | PermissionRequest[] | Core | Least-authority requests; default is no permissions. |
| `interfaces` | CapabilityInterface[] | Core | How the capability can be used. |
| `provenance` | Provenance | Extended | Origin, signatures, timestamps. |
| `checksum` | string | Extended | `sha256:<hex>` of the canonical manifest without `checksum`. |
| `extensions` | object | Extended | Reserved for implementation-specific data. |

Capability domains (`kind`): `agent-skill`, `human-skill`, `system-capability`, `workflow`, `knowledge`, `standard`.

## Supporting types

```ts
interface Requirement {
  id: string;              // capability id or external prerequisite id
  versionRange?: string;   // semver range; omit = any
  optional?: boolean;      // default false
  reason?: string;
}

interface PermissionRequest {
  scope: PermissionScope;
  level: 'none' | 'ask' | 'grant';
  reason: string;          // MUST explain why the scope is needed
}

type PermissionScope =
  | 'workspace.read' | 'workspace.write' | 'network'
  | 'execution' | 'credentials' | 'model' | 'system';

interface CapabilityInterface {
  name: string;
  type: 'command' | 'function' | 'http' | 'mcp-tool' | 'prompt' | 'resource';
  description?: string;
  inputSchema?: object;    // JSON Schema 2020-12
  outputSchema?: object;   // JSON Schema 2020-12
}

interface Provenance {
  origin?: string;         // URL or publisher identifier
  publishedAt?: string;    // RFC 3339
  signatures?: Array<{ algorithm: 'ed25519' | 'sha256'; value: string; signer?: string }>;
}
```

## Rules

1. A manifest with no `permissions` entry requests **no** permissions.
2. A manifest with no `interfaces` entry is descriptive only (`resource`-like) and MUST be usable for cataloging.
3. `id` + `version` identifies a release; `checksum` identifies an exact byte-level canonical form.
4. Implementations MUST validate `inputSchema`/`outputSchema` as JSON Schema 2020-12 objects when present.
5. Canonical form: keys sorted lexicographically, arrays preserved in order, no insignificant whitespace, UTF-8. Checksums are computed over this form with `checksum` removed.
6. A manifest MUST NOT be treated as safe because it is signed. Signatures establish integrity and origin only.

## Example

```json
{
  "schema": "oneorigin.capability/v0.0.1",
  "id": "oneorigin.skills.skill-md-import",
  "name": "SKILL.md Import",
  "version": "0.0.1",
  "kind": "agent-skill",
  "summary": "Import and validate Agent Skills SKILL.md documents.",
  "tags": ["agent-skills", "import"],
  "permissions": [{ "scope": "workspace.read", "level": "ask", "reason": "Read a file chosen by the user." }],
  "interfaces": [{ "name": "import", "type": "function" }]
}
```

Machine-readable schema: [`packages/contracts/src/schemas/capability-manifest.schema.json`](../../packages/contracts/src/schemas/capability-manifest.schema.json).
