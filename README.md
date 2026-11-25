# OneOrigin — CoreBase & CoreSkills

Foundational product workspace for two independent, complementary products:

- **CoreBase — EXECUTE:** universal human–agent work and execution environment.
- **CoreSkills — EMPOWER:** universal capability ecosystem.

Both are independently useful, deployable, extensible and self-hostable. Neither requires the other at runtime.

## Repository layout

```
packages/            Shared, dependency-light contracts and libraries
  contracts/         Capability manifest, permissions, audit and result types
  skill-kit/         SKILL.md parsing, conformance, versioning and export
apps/
  coreskills/        Capability catalog (SvelteKit PWA)
  corebase/          Work and execution environment (SvelteKit PWA)
docs/
  specs/             Normative specifications
  decisions/         Architecture decision records
  roadmap.md         Sequenced delivery plan
```

## Status

| Milestone | Status |
| --- | --- |
| Shared specs & contracts | Delivered |
| CoreSkills v0.0.1 | Delivered |
| CoreBase v0.0.1 | Delivered |
| Repo + Cloudflare setup | Delivered |
| Distribution / release | Delivered — [v0.0.1](https://github.com/OriginLabs1/CBase-CSkills/releases/tag/v0.0.1) |

Live deployments: [CoreSkills](https://9d7d2ab9.coreskills.pages.dev) · [CoreBase](https://d1861aaf.corebase-8fb.pages.dev)

## Governing principles

- Own what is essential. Integrate what is proven. Standardize what must interoperate.
- Explicit, revocable, least-authority permissions. No unrestricted shell from an ordinary browser.
- Local-first and self-hostable by default; no mandatory cloud, model, account or vendor.
- Signatures establish integrity and origin, not safety.

See [docs/specs](docs/specs/README.md) and [docs/roadmap.md](docs/roadmap.md).
