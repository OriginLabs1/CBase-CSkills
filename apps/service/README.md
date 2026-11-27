# @oneorigin/service — optional v0.0.2 service

This is an **optional** companion for CoreBase and CoreSkills. Neither product needs it: guest mode, local storage, authoring, import/export and audit all work offline. The service adds portable identity, memberships, consent records, shared templates and authorized observability endpoints.

## Run locally

From the repository root:

```sh
npm install
npm run dev --workspace @oneorigin/service
```

The service listens on `http://localhost:8787` by default. Check `GET /health`.

The `.mjs` runtime modules are loaded through `scripts/register-ts.mjs` so that workspace packages written in TypeScript can be imported without a build step. This is a development-runner detail, not part of the public contract.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SERVICE_PORT` | `8787` | HTTP port |
| `SERVICE_HOST` | `0.0.0.0` | Bind address |
| `SERVICE_STORE` | `memory` | Deployment label: `memory`, `oneorigin-postgresql` or `independent-postgresql` |
| `SERVICE_SECURE_COOKIES` | `false` | Add `Secure` to the session cookie (enable behind HTTPS) |
| `EMAIL_ADAPTER` | `noop` | `noop`, `memory` (tests only) or `webhook` |
| `EMAIL_WEBHOOK_URL` | — | HTTPS relay URL for `webhook` delivery |
| `EMAIL_WEBHOOK_TOKEN` | — | Optional bearer token for the relay |

Production deployments must inject a real `PersistenceAdapter` (see `@oneorigin/sql`) and a real `EmailSender` through `createService({ adapter, emailSender, ... })`. The built-in memory store and no-op sender exist for local development and tests only: they do not survive a restart and deliver no email. Codes are never logged by the service.

## Contract and boundaries

- The HTTP contract is `packages/api/openapi.yaml`; record shapes are the JSON Schemas in `packages/*/src/schemas`.
- Email OTP uses six-digit, single-use codes with a five-minute expiry, a maximum of five attempts, hashed storage, constant-time comparison and rate limits by address and IP.
- Responses never reveal whether an account exists. Verification creates a provider-independent `urn:oneorigin:identity:<sha256>` identity; email is a verified credential, not a primary key.
- Sessions are rotated on refresh and revoked immediately on sign-out.
- Consent lifecycle: `invited → identity-verified → scope-disclosed → accepted | declined → expired | revoked`. Acceptance is impossible before verification and disclosure.
- Observability endpoints require an active, application-scoped consent grant and return operational metadata only. User content needs a separate authorization.
- Templates are validated (including per-file hashes) before being offered to clients. Applying one remains a local, reviewable action.

## Embedding

```js
import { createService } from './src/http.mjs';
import { PostgresPersistenceAdapter } from '@oneorigin/sql';
import { MyEmailSender } from './email-sender.mjs';

const service = createService({
  adapter: new PostgresPersistenceAdapter(client, { kind: 'oneorigin-postgresql' }),
  emailSender: new MyEmailSender(),
  secureCookies: true,
  allowedOrigins: ['https://base.example.org', 'https://skills.example.org'],
});
await service.listen(8787);
```

`createService` returns `{ server, store, adapter, emailSender, listen, close }`, which makes the same domain logic usable from tests, edge workers or a different HTTP host.
