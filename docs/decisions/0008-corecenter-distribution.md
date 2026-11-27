# 0008 — CoreCenter as an independently deployed Android application

Status: accepted for v0.0.2 implementation

## Context

CoreCenter is a privileged observability application for authorized programmers. It already exists as a separate GitHub repository, `OriginLabs1/CoreCenter`, and must remain independently deployable. It must not become a runtime dependency of CoreBase or CoreSkills, and this repository does not vendor or mirror its source.

## Decision

- CoreCenter is maintained in the existing external repository `OriginLabs1/CoreCenter` as a Kotlin + Jetpack Compose application with its own build, release artifacts and versioning.
- This repository publishes the contracts CoreCenter consumes: `packages/api/openapi.yaml` and the JSON Schemas under `packages/*/src/schemas`. CoreCenter generates HTTP clients and record types from those artifacts rather than hand-copying TypeScript definitions.
- CoreCenter is read-only by default. Administration requires a separately scoped, revocable consent grant of kind `administration`.
- The UI shows live, offline and stale states explicitly. It must never present cached data as live.
- Distribution is a signed APK/AAB from CoreCenter's own repository with reproducible build instructions. Eligibility checks are performed by the service, never by a hard-coded address list in the app.
- No credentials, API tokens or GitHub access are required to build or test CoreBase, CoreSkills or the optional service in this repository.

## Consequences

- The Android toolchain, signing material and release workflow live in `OriginLabs1/CoreCenter`; this repository's web and service releases are unaffected.
- Contract changes here must be published before CoreCenter can generate new clients; breaking changes need an explicit version negotiation step.
- CoreCenter cannot observe anything until a consent grant is accepted; the app has no ambient access to either product.
