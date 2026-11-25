# 0004 — Current major platform versions

Status: accepted (v0.0.1)

## Context

The product blueprint recommends choosing technology by capability, maturity, efficiency and replaceability. Staying on current major releases avoids security debt and compatibility forks.

## Decision

Use current major versions as of the v0.0.1 build:

| Layer | Version family |
| --- | --- |
| Runtime | Node 22+ |
| UI | Svelte 5, SvelteKit 3 |
| Build | Vite 8, TypeScript 6 |
| Styling | Tailwind CSS 4 |
| Testing | Vitest 5 |
| Icons | @lucide/svelte 1 |
| Storage | idb 8 |
| Editor | CodeMirror 6 |
| Deploy | Cloudflare Pages via wrangler-action 3 |

Where a current plugin is incompatible with SvelteKit 3 (see 0002), implement the small needed behaviour directly rather than pinning the framework backwards.

## Consequences

- Configuration uses SvelteKit 3's Vite-plugin config API; legacy `svelte.config.js` is absent.
- Dependency updates are automated weekly by Dependabot.
- Core contracts remain framework-neutral, so a future platform change does not invalidate them.
