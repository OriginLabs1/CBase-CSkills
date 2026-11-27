# 10 — Shared templates (v0.0.2)

Templates are excellent, optional starting points. They are data, not mandatory frameworks, and applying one remains subject to normal approval for consequential actions. Schema: [`packages/templates/src/schemas/template.schema.json`](../../packages/templates/src/schemas/template.schema.json).

## Lifecycle

```
discover → preview → select → copy/combine → customize → validate → apply → share
```

Implementations MUST support all eight steps for both products. CoreBase template kinds include `workspace`, `execution-environment`, `policy` and `project-foundation`. CoreSkills kinds include `skill`, `capability-definition`, `instruction`, `workflow` and `agent-competency`.

## Structure

A `oneorigin.template/v0.0.2` record contains identity (`id`, `version`), product and kind, human-readable preview metadata, base64 `files` with per-file `sha256`, optional structured `inputs`, `requires`, `permissions`, `compatibility`, `provenance`, `derivedFrom` and an integrity-only `signature`.

Files MUST use relative paths with no `..` segments, absolute paths or NUL bytes. Importers MUST verify every file hash before applying or publishing a template.

## Human and agent customization

`inputs` are typed (`string`, `number`, `boolean`, `json`, `file`), named, described and optionally defaulted so both people and authorized agents receive structured, understandable inputs. `{{inputName}}` placeholders in text files are substituted by `renderTemplate`, which MUST recompute hashes and drop the original signature because the bytes are now a derivative.

Publication of a derivative MUST link to every source through `derivedFrom` with source ids, versions and content hashes. Provenance MUST be preserved on round-trip.

## Compatibility and validation

Validation MUST cover structure, file hashes, required input types, declared permission scopes and provenance. Combining templates MUST fail when products differ, compatibility constraints conflict or two templates claim the same file path. Validation reports use the shared `Diagnostic` shape with stable codes.
