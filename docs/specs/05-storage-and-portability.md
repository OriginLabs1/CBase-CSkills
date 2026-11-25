# 05 — Storage & Portability (v0.0.1)

## Storage responsibility

| Responsibility | Suitable store |
| --- | --- |
| Browser-local catalogs, workspaces, sessions | IndexedDB |
| Self-hosted server catalogs and history | SQLite |
| Portable interchange between implementations | JSON bundles |
| Large immutable resources | Content-addressed blobs (`sha256:<hex>`) |

These are architectural responsibilities, not mandatory services. A browser build MAY use IndexedDB even where a SQLite adapter exists on a server; both MUST conform to the same bundle format.

## Adapter contract

```ts
interface StorageAdapter {
  id: string;
  get(namespace: string, key: string): Promise<Uint8Array | undefined>;
  put(namespace: string, key: string, value: Uint8Array): Promise<void>;
  delete(namespace: string, key: string): Promise<void>;
  list(namespace: string, prefix?: string): Promise<string[]>;
  close(): Promise<void>;
}
```

Namespaces used by v0.0.1: `skills`, `skill-versions`, `projects`, `files`, `sessions`, `checkpoints`, `audit`, `grants`, `settings`.

Implementations MUST treat stored bytes as opaque and MUST validate them on read.

## Bundle format

```json
{
  "schema": "oneorigin.bundle/v0.0.1",
  "kind": "skill-pack" | "workspace",
  "createdAt": "2026-01-01T00:00:00Z",
  "items": [
    {
      "path": "skills/my-skill/SKILL.md",
      "mediaType": "text/markdown",
      "bytes": "<base64>",
      "sha256": "<hex>"
    }
  ],
  "manifests": [],
  "signature": { "algorithm": "sha256", "value": "<hex>" }
}
```

Rules:

1. `bytes` is base64 of UTF-8 or binary content; `sha256` is over decoded bytes.
2. Import MUST verify every item hash before writing any item (atomic import).
3. Import MUST reject absolute paths, `..` segments and paths containing NUL.
4. `signature` covers the canonical bundle without the `signature` field and establishes integrity/origin only.
5. Export MUST include all resources needed for the capability to function; remote resources MUST be declared as requirements rather than silently fetched.

## Versioning

- Skills and manifests use SemVer.
- Each stored version is immutable and content-addressed.
- Editing creates a new version; the previous version remains restorable.
- Version history is part of the bundle so it survives export/import.
