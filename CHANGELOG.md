# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-14

Initial release of Floci UI — the local cloud console for [Floci](https://floci.io).

### Added

- Unified, metadata-driven **Cloud Explorer** that renders multiple local cloud
  runtimes through one interface, talking only to the Cloud Proxy API. Real data
  only — unwired services show explicit empty states or placeholders.
- **Storage** — AWS S3 and Azure Blob: browse buckets/containers, object/blob
  browser with prefix navigation, upload, download, delete, folder prefixes, and
  a metadata inspector.
- **Compute** — AWS EC2: list instances and AMIs, launch instances, start/stop/
  reboot/terminate, console output, create AMIs, edit tags, deregister AMIs.
- **Networking** — AWS VPC: VPCs, subnets, security groups, internet/NAT
  gateways, route tables, Elastic IPs, and a VPC creation wizard.
- **Database** — AWS RDS (list/inspect) and Azure Cosmos DB NoSQL (databases,
  containers, documents, and a SQL query editor).
- **k8s Engine** — AWS EKS cluster list and inspection.
- **Serverless** — AWS Lambda: list, inspect, and invoke functions.
- API backend (`packages/api`) that proxies REST/JSON requests to cloud SDK
  calls against the selected Floci runtime.
- Light/dark theme and the Floci brand logo + color palette.
- Docker Compose stack with a `multicloud` profile for the Azure and GCP emulators.
- CI (lint, type-check, test, build), multi-arch Docker release, end-to-end
  integration (against the real `floci/floci` image), and Conventional Commits
  workflows.
- Contributor tooling: `CONTRIBUTING.md`, issue/PR templates, `CODEOWNERS`, and
  Dependabot.

### Changed

- Standardized local ports to the Floci `45xx` range — UI on `4500`, API on `4501`.
- Consolidated the dev/full Docker Compose files into a single `docker-compose.yml`.
- Reorganized Dockerfiles under `docker/` and added a packaging image that
  bundles CI-built artifacts for releases.
- Upgraded the frontend stack (React 19, Vite 8, React Router 7, ESLint 10 flat
  config) and API dependencies (AWS SDK, Hono).

### Removed

- `docker-compose.dev.yml` (folded into `docker-compose.yml`).
- Legacy dedicated AWS service pages, superseded by the unified Cloud Explorer.

[Unreleased]: https://github.com/floci-io/floci-ui/compare/0.1.0...HEAD
[0.1.0]: https://github.com/floci-io/floci-ui/releases/tag/0.1.0
