# 0001 — Local-first storage with a portable bundle format

Status: accepted (v0.0.1)

## Context

The blueprint names SQLite for local catalogs and IndexedDB where browser-native storage fits better. Cloudflare Pages has no native SQLite, and the products must be independently self-hostable without a mandatory server.

## Decision

- Browser apps use IndexedDB through a small `StorageAdapter`-shaped API.
- Server/self-hosted builds may add a SQLite adapter later without changing the bundle format.
- All interchange uses the content-addressed `oneorigin.bundle/v0.0.1` JSON format with hash verification before writes.

## Consequences

- v0.0.1 works offline and on constrained Android devices with no backend.
- Server-side SQL queries are not available in the browser build.
- The bundle format becomes the compatibility boundary; changes require a schema version bump.
