# Deployment & distribution

## Local development

```sh
npm ci
npm run dev:skills   # CoreSkills, http://localhost:5173
npm run dev:base     # CoreBase, http://localhost:5174
npm run check
npm run test
npm run build
```

Both apps are static, local-first PWAs. No account, backend or network service is required for ordinary use.

## GitHub

Remote: `https://github.com/OriginLabs1/CBase-CSkills.git`

Workflows:

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` | push to `main`, pull requests | check, test, build |
| `deploy.yml` | push to `main`, manual | deploy both apps to Cloudflare Pages |
| `release.yml` | tags matching `v*` | versioned GitHub Release with archives and SHA256SUMS |

Actions use the built-in `GITHUB_TOKEN` for releases. No PAT is stored in the repository.

## Repository secrets

Set these in **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN` — an API token with **Account:Cloudflare Pages:Edit** permission.
- `CLOUDFLARE_ACCOUNT_ID` — the account identifier (not secret, stored as a secret for uniform workflow handling).

Do not place tokens in source, workflow files, logs, bundles or skill manifests. Rotate any token that has been pasted into a chat or logged.

Cloudflare Pages projects: `coreskills` and `corebase`. Build output directories: `apps/coreskills/build` and `apps/corebase/build`. The `404.html` fallback provides SPA routing.

Live v0.0.1 deployments:

- CoreSkills: https://9d7d2ab9.coreskills.pages.dev
- CoreBase: https://d1861aaf.corebase-8fb.pages.dev

Published release: https://github.com/OriginLabs1/CBase-CSkills/releases/tag/v0.0.1

## Release process

1. Complete milestone acceptance criteria in `docs/roadmap.md`.
2. Update version numbers in root, package and app manifests.
3. Tag and push: `git tag v0.0.1 && git push origin v0.0.1`.
4. `release.yml` publishes source, both web builds and checksums.
5. Cloudflare deploys `main`; GitHub Releases carry distributable artifacts.

## Other distribution channels

- **PWA:** install from the deployed URL on Android/desktop; service worker caches the shell.
- **Skill packs:** portable `oneorigin.bundle/v0.0.1` JSON files exported from CoreSkills.
- **npm:** shared packages are publishable once the v0.1.0 contract stability commitment is made.
- **Self-hosting:** serve the `build/` directory from any static host; no server-side runtime is required.

## Verification before release

```sh
npm run check && npm run test && npm run build
```

Every artifact in a release is accompanied by `SHA256SUMS.txt`.
