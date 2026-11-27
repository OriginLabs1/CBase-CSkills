# 12 — Observability API (v0.0.2)

The authoritative HTTP contract is [`packages/api/openapi.yaml`](../../packages/api/openapi.yaml). It is optional: no web product requires the service for ordinary local use.

## Principles

- Every privileged endpoint requires an authenticated session and an active, scoped consent grant.
- CoreBase data and CoreSkills data are independent product namespaces. CoreCenter MUST state which product a snapshot belongs to.
- Responses contain operational metadata by default. User content requires a separate explicit authorization.
- Reads are read-only. Administration requires a grant of kind `administration`.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/email/request`, `/auth/email/verify` | Passwordless OTP authentication |
| `POST /auth/session/refresh`, `/auth/session/revoke` | Session rotation and immediate revocation |
| `GET /memberships` | Verified membership records |
| `POST /consent-grants`, `GET /consent-grants/{id}` | Invitation and disclosure records |
| `POST /consent-grants/{id}/accept|decline|revoke` | Consent transitions |
| `GET /verification/{id}` | Independently verifiable records |
| `GET /templates`, `POST /templates/validate` | Template discovery and validation |
| `GET /observability/health` | Health snapshot with `live`, `offline` or `stale` |
| `GET /observability/events` | Server-sent events for connected clients |

## Live, offline and stale

Clients MUST NOT present cached data as live. A snapshot is `live` when its source responded within the freshness window, `stale` when the last successful read exceeds that window, and `offline` when no connection is available. Reconnection MUST resume from the last checkpoint and MUST NOT replay already-applied events twice.

## Authorized programmer observability

CoreCenter MUST display consent purpose, data categories, expiry and revocation controls alongside observed data. Revocation MUST stop subsequent streams and requests immediately. Historical observations remain in the audit trail and remain verifiable after revocation.
