# @oneorigin/api

Draft OpenAPI 3.1 contract for the **optional** OneOrigin service. It is not a runtime dependency: CoreBase and CoreSkills remain usable offline in guest mode.

The service can be operated by OneOrigin or independently, backed by user-controlled edge/local databases or either PostgreSQL deployment model. All operators expose the same endpoints and validation rules.

Domain records are defined by the JSON Schemas shipped with:

- `@oneorigin/identity` — identity, membership, consent, verifiable envelope
- `@oneorigin/templates` — template
- `@oneorigin/persistence` — change event, sync checkpoint
- `@oneorigin/contracts` — capability manifest, bundle

Generate Kotlin types for CoreCenter from this document rather than hand-copying TypeScript types.
