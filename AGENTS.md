Guidance for AI coding agents working in the Floci UI repository.

This file defines repository-specific operating rules for autonomous or semi-autonomous
coding agents. Follow these instructions unless a maintainer explicitly tells you otherwise.

`AGENTS.md` is the canonical agent-instructions file for this repository, following the
[AGENTS.md standard](https://agents.md/). `CLAUDE.md`, `GEMINI.md`, and
`.github/copilot-instructions.md` are symlinks to this file — edit `AGENTS.md` only.

---

## Project Overview

Floci UI is the web console / DevTools for [Floci](https://floci.io), the local multi-cloud
emulator. It is an AWS-Console-style UI for a locally running cloud runtime.

It does **not** emulate anything itself. The frontend renders cloud resources; the API
translates the UI's REST/JSON requests into cloud-SDK calls against the locally running
Floci emulators (AWS, Azure, GCP).

- pnpm workspace monorepo, two packages:
  - `packages/frontend` — React + Vite + TypeScript, served on port `4500`
  - `packages/api` — Bun + Hono + AWS SDK v3, served on port `4501`
- Emulator endpoints it talks to: Floci core (AWS) `:4566`, Floci-AZ `:4577`, Floci-GCP `:4588`

---

## First Principles

When making changes, follow these priorities:

1. Use real cloud-provider contracts — never invent custom backend endpoints for UI convenience
2. Reuse the schema-driven multi-cloud pattern instead of bespoke per-service code
3. Keep the frontend talking only to `/api/*`; never reach a cloud endpoint directly from the browser
4. Prefer real empty states over fake/sample data
5. Keep changes narrow and testable

Critical rules:

- Do not add custom protocols just for the UI unless the core project accepts that contract
- Do not have the frontend call AWS/Azure/GCP endpoints directly — always go through `packages/api`
- Do not introduce decorative data or fake operational metrics — unwired states stay empty
- Do not perform broad refactors unless the task explicitly requires them

---

## Architecture

```
Browser (React/Vite :4500)
  → /api/*  (Hono, Bun :4501)
    → CloudProxyService → CloudAdapterRegistry → CloudServiceAdapter
      → AWS SDK v3 (:4566) | Floci-AZ HTTP (:4577) | Floci-GCP HTTP (:4588)
```

The repo is mid-migration from an older **AWS-only per-service** style to a newer
**schema-driven, multi-cloud generic explorer**. The generic pattern is the one to use
for all new work; the legacy routes survive only for deep EC2 panels and Secrets Manager.

### The multi-cloud SPI (the part you will use most)

- `packages/api/src/cloud-spi/types.ts` — `CloudProvider` (`aws|azure|gcp`),
  `CloudServiceType` (`storage|k8s|database|serverless|compute|networking|…`),
  the `CloudServiceAdapter` interface, and `ServiceSchema`.
- `packages/api/src/registry/CloudAdapterRegistry.ts` — registry keyed by `"cloud:service"`.
- `packages/api/src/service/CloudProxyService.ts` — the single dispatcher.
- `packages/api/src/cloudProxy.ts` — where adapters are instantiated and registered.
- `packages/api/src/routes/clouds.ts` — the generic `/api/clouds/...` REST surface.

A `ServiceSchema` (fields, `actions`, `capabilities`, `filters`, `columns`) drives the UI:
the frontend's `DynamicResourceView` renders list / create / delete / inspect generically
from the schema — most services need **no bespoke UI**.

### Frontend layout

- `packages/frontend/src/App.tsx` — routes (`/console/:cloud`, `/cloud-explorer/:cloud/:service`)
- `packages/frontend/src/components/Layout.tsx` — nav (`CLOUD_SERVICE_ITEMS`, `CLOUD_SERVICE_ICONS`)
- `packages/frontend/src/pages/CloudExplorerPage.tsx` — `normalizeService()` route handling
- `packages/frontend/src/components/DynamicResourceView.tsx` — schema → table/form/inspector orchestrator
- Reusable: `ResourceTable`, `DynamicFormRenderer`, `ResourceInspector`, `StorageObjectBrowser`,
  `CosmosNoSqlPanel`, `EmptyState`, `lib/capabilities.ts`
- API client: `src/api/cloudProxyClient.ts`, `src/api/api.ts`, `src/api/HttpClient.ts`

### Legacy (do not extend without reason)

`packages/api/src/routes/{ec2,rds,eks,secretsmanager}.ts` and the matching
`features/ec2/*` frontend code. New services go through the generic SPI, not here.

---

## Build & Run

    pnpm install
    pnpm dev          # API (:4501) + frontend (:4500) together
    pnpm dev:api      # API only
    pnpm dev:web      # frontend only

Requires a running Floci core (`:4566`) — see `README.md` / `docker compose` (use the
`multicloud` profile to also start Azure + GCP).

### Checks (run all before finishing)

    pnpm lint          # eslint, frontend
    pnpm type-check    # tsc on both packages
    pnpm test          # bun test, packages/api
    pnpm build         # production build

---

## Adding a New Service to the Cloud Explorer

This is the canonical pattern (also referenced by the open service-coverage issues).

**Backend (`packages/api`):**

1. `src/cloud-spi/<service>Schema.ts` — export `<service>SchemaFor(cloud)` returning a
   `ServiceSchema`. Model: `src/cloud-spi/storageSchema.ts`.
2. Add the literal to `CloudServiceType` in `src/cloud-spi/types.ts` (once per new category).
3. `src/adapter-<cloud>/<Cloud><Service>Adapter.ts implements CloudServiceAdapter` with a
   `.test.ts` alongside. Model: `src/adapter-aws/AwsStorageAdapter.ts`. AWS adapters use AWS
   SDK v3 against `FLOCI_ENDPOINT`; Azure/GCP adapters call the local runtime over HTTP
   (`adapter-azure/azure.ts`, `adapter-gcp/gcp.ts`).
4. Register `new <Cloud><Service>Adapter()` in `src/cloudProxy.ts`.
5. Add a `services.push({...})` entry + `schema()` fallback in `service/CloudProxyService.ts`,
   and extend `isServiceType()` in `routes/clouds.ts`. The generic `/api/clouds/...` routes
   then work with no new handler.

**Frontend (`packages/frontend`):**

1. Extend `CloudServiceType` in `src/types/cloud.ts` (and `types/schema.ts` if new shapes).
2. Add a nav entry + icon and per-cloud gating in `components/Layout.tsx`.
3. Handle the literal in `normalizeService()` in `pages/CloudExplorerPage.tsx`.
4. `DynamicResourceView` renders it generically. Only add a `service === '<x>'` panel for
   deep UX (models: `ComputePanel`, `NetworkingPanel`, `CosmosNoSqlPanel`).

Rule: copy an existing adapter + schema before introducing a new shape.

---

## Code Style

- TypeScript throughout; prefer self-explanatory code over comments
- Match the surrounding code's naming, structure, and idiom
- Frontend: function components + hooks; data fetching via the existing React Query wrappers
- Keep controllers/routes thin; put logic in adapters/services
- Follow existing project patterns; introduce new patterns only when they clearly improve clarity

---

## Testing

- API tests use `bun test` (`packages/api`); colocate `*.test.ts` next to the adapter
- Add or update tests for any change to request handling, response shape, or adapter behavior
- Documentation, formatting, or low-risk refactors may not need new tests, but the existing
  suite plus `pnpm lint`, `pnpm type-check`, and `pnpm build` must still pass
- If you change behavior without adding coverage, say why in the PR

---

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR; avoid unrelated refactors
- Branch off `main`; open the PR against `main`
- The PR title must follow [Conventional Commits](https://www.conventionalcommits.org/)
  (it becomes the squash-merge commit). Scopes identify the package or service area
  (`frontend`, `api`, `s3`, `serverless`, `docker`, `ci`, …)
- Keep README service-status notes accurate; add verification notes for newly wired operations

Do not add `Co-Authored-By` trailers for AI tools in commit messages. Keep attribution
limited to human contributors.

---

## Release Awareness

Releases are tag-driven. Docker images are never published on PR merge — only when a
maintainer pushes an `X.Y.Z` tag, which triggers `.github/workflows/release.yml` to build
and push the multi-arch `floci/floci-ui` image. Treat release workflows as critical infra.

---

## Common Mistakes

- Adding custom backend endpoints instead of using real cloud contracts / the generic SPI
- Calling cloud endpoints directly from the frontend instead of through `/api/*`
- Adding fake/sample data instead of real empty states
- Extending the legacy `ec2/rds/eks/secretsmanager` routes for new work
- Forgetting to register the adapter (`cloudProxy.ts`) or wire the nav (`Layout.tsx`)
- Skipping `pnpm type-check` / `pnpm test` before finishing

---

## Human Handoff

If behavior is unclear, prefer the real cloud-provider contract, then the existing Floci UI
convention, then the corresponding emulator's behavior. If a task would require broad
architectural change, stop and surface the tradeoffs instead of refactoring blindly.
