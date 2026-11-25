# 0002 — Static PWA deployment, hand-written service worker

Status: accepted (v0.0.1)

## Context

SvelteKit 3 does not support Vite plugins that rely on the `transformIndexHtml` hook, which rules out the current PWA plugin. The products need an installable offline-capable shell on Cloudflare Pages.

## Decision

- Use `@sveltejs/adapter-static` with a `404.html` SPA fallback.
- Ship a small hand-written service worker and web app manifest as static assets.
- Register the service worker only in production builds.

## Consequences

- No PWA plugin dependency; the cache policy is explicit and auditable.
- Asset hashing is handled by Vite; cache names are versioned per product release.
- Deployments are static files on any host, including Cloudflare Pages.
