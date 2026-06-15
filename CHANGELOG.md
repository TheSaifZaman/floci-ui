# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Theme-aware Floci brand logo (light/dark) and a brand-aligned indigo color palette sourced from floci.io.
- `multicloud` Docker Compose profile to start the Azure and GCP emulators alongside the AWS runtime.
- Continuous Integration workflow running lint, type-check, test, and build on pull requests.
- Multi-architecture (`amd64` + `arm64`) Docker release workflow that publishes `floci/floci-ui` on version tags.
- End-to-end integration workflow that runs the full stack against the real `floci/floci` runtime image.
- Conventional Commits validation on pull requests.
- Contributor tooling: `CONTRIBUTING.md`, issue and pull request templates, `CODEOWNERS`, and Dependabot configuration.

### Changed

- **Breaking:** standardized local ports to the Floci `45xx` range — UI now on `4500` and API on `4501` (were `3000`/`3001`).
- Consolidated `docker-compose.dev.yml` into a single `docker-compose.yml`.
- Reorganized Dockerfiles under `docker/` and added a packaging image that bundles CI-built artifacts for releases.
- Upgraded the frontend stack: React 19, Vite 8, React Router 7, and ESLint 10 (migrated to flat config), plus grouped dependency updates.
- Upgraded the API dependencies: AWS SDK and Hono.
- Bumped pinned GitHub Actions (`checkout`, `setup-node`, `pnpm/action-setup`, `setup-qemu`).
- Revamped the README with the brand logo, status badges, a connected-console screenshot, and a quick-start section.
- Moved the README logo assets into `docs/images/`.

### Removed

- `docker-compose.dev.yml` (folded into `docker-compose.yml`).

[Unreleased]: https://github.com/floci-io/floci-ui/commits/main
