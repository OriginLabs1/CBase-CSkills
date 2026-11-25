# 02 — SKILL.md Conformance (v0.0.1)

CoreSkills treats the open Agent Skills `SKILL.md` convention as a first-class input. This specification **extends without redefining** it: an ordinary Agent Skills `SKILL.md` MUST validate with no extra fields.

## File form

- **Directory form:** a directory containing a file named exactly `SKILL.md` (case-sensitive) plus optional resources. The directory name MUST equal the frontmatter `name`.
- **Standalone form:** a single Markdown file named `SKILL.md` or pasted text. Directory-name matching does not apply.

Encoding MUST be UTF-8. Size MUST NOT exceed 256 KiB of text for v0.0.1.

## Frontmatter

The file MUST begin with a YAML frontmatter block delimited by `---` lines. The block MAY be empty of optional fields but MUST contain `name` and `description`.

| Field | Type | Requirement |
| --- | --- | --- |
| `name` | string | Required. `^[a-z0-9]+(-[a-z0-9]+)*$`, 1–64 chars. In directory form MUST equal directory name. |
| `description` | string | Required. 1–1024 chars. Should state when to use the skill. |
| `version` | string | Optional. SemVer without leading `v`. |
| `author` / `authors` | string / string[] | Optional. |
| `license` | string | Optional SPDX identifier. |
| `tags` | string[] | Optional. Lowercase, 1–32 chars each. |
| `allowed-tools` | string[] | Optional. Advisory only; not an enforcement boundary. |
| `compatibility` | string | Optional. |
| `metadata` | object | Optional. Implementation-specific extension data; preserved on round-trip. |
| `permissions` | array | Optional. CoreBase permission requests using the shared permission scope vocabulary. |

The Markdown body MAY contain any valid Markdown. It is instruction text, not executable code.

## Validation diagnostics

Every diagnostic has a stable code, a severity (`error`, `warning`, `info`), a JSON pointer-ish `path` and a human-readable message. An `error` MUST block import/activation. A `warning` SHOULD be surfaced but MAY be overridden by the user.

| Code | Severity | Condition |
| --- | --- | --- |
| `FM000` | error | Frontmatter fence present but YAML is invalid. |
| `FM001` | error | Missing frontmatter block. |
| `FM002` | error | Missing or invalid `name`. |
| `FM003` | error | Missing or invalid `description`. |
| `FM004` | warning | `description` longer than 200 chars (discoverability concern). |
| `FM005` | info | Unknown top-level frontmatter field (preserved as extension). |
| `FM006` | error | Invalid `version` when present. |
| `FM007` | error | Directory form name mismatch. |
| `FM008` | warning | Invalid `tags` entry; ignored for indexing. |
| `BODY001` | error | Empty body. |
| `BODY002` | error | Body exceeds 256 KiB. |
| `SEC001` | warning | Instruction-like text attempting to override prior instructions (e.g. "ignore previous instructions"). |
| `SEC002` | warning | Reference to credential-like paths or environment secret access. |
| `SEC003` | info | Absolute filesystem path in body; not portable. |

Diagnostics are deterministic for a given input so they can be used in conformance tests.

## Canonical form and identity

1. Parse frontmatter, keep unknown fields in `metadata.extensions`.
2. Normalize: lowercase tags, trim strings, sort tag arrays, drop empty optional arrays.
3. Canonical bytes = UTF-8 JSON with lexicographically sorted keys and no insignificant whitespace, containing only `name`, `description`, `version` (if any), normalized optional core fields and the body text.
4. Identity = `sha256:<hex>` of canonical bytes. Two inputs with the same identity are the same skill version.

Conforming implementations MUST preserve frontmatter field order and body bytes when exporting a single `SKILL.md` that was imported, except where the user explicitly edits it.

## Conversion to a capability manifest

A conforming `SKILL.md` maps to a manifest with:

- `kind: "agent-skill"`
- `id: "skill.<name>"` unless `metadata.id` is provided
- `name`, `version`, `tags`, `permissions` from frontmatter
- `summary` = first sentence of `description` (max 200 chars)
- `interfaces: [{ name: "instructions", type: "resource" }]`
- `extensions["agentSkills"] = { skillMd: true }`

This mapping is lossless with respect to the original `SKILL.md`.
