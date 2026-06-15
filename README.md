<p align="center">
  <img src="docs/images/floci-black.svg#gh-light-mode-only" alt="Floci UI" width="460" />
  <img src="docs/images/floci-white.svg#gh-dark-mode-only" alt="Floci UI" width="460" />
</p>

<p align="center">
  <strong>Any Cloud. Locally.</strong><br />
  The local cloud console for <a href="https://floci.io">Floci</a> — an AWS-Console-style UI for your
  multi-cloud runtime. No account, no mock data, just <code>docker compose up</code>.
</p>

<p align="center">
  <a href="https://github.com/floci-io/floci-ui/releases/latest"><img src="https://img.shields.io/github/v/release/floci-io/floci-ui?label=latest%20release&color=blue" alt="Latest Release"></a>
  <a href="https://github.com/floci-io/floci-ui/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/floci-io/floci-ui/ci.yml?branch=main&label=ci" alt="CI Status"></a>
  <a href="https://hub.docker.com/r/floci/floci-ui"><img src="https://img.shields.io/docker/pulls/floci/floci-ui?label=docker%20pulls" alt="Docker Pulls"></a>
  <a href="https://hub.docker.com/r/floci/floci-ui"><img src="https://img.shields.io/docker/image-size/floci/floci-ui/latest?label=image%20size" alt="Docker Image Size"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT"></a>
  <a href="https://github.com/floci-io/floci-ui/stargazers"><img src="https://img.shields.io/github/stars/floci-io/floci-ui?style=flat" alt="GitHub Stars"></a>
</p>

<p align="center">
  <img src="docs/images/floci-ui-console.png" alt="Floci UI console — connected to a local AWS runtime" width="900" />
</p>

Floci UI is a unified, local-first multi-cloud runtime explorer for
[Floci](https://github.com/floci-io/floci) and compatible local cloud runtimes. It feels familiar to AWS Console
users while staying honest about what's implemented: the UI renders only real data returned by Floci-compatible APIs.
If a service or operation isn't wired yet, the screen stays empty or shows an explicit placeholder — no fake
resources, demo rows, or mock service data.

## Quick Start

```bash
docker compose up        # starts the frontend, API, and Floci AWS core
```

Then open **http://localhost:4500** — the console detects the local runtime automatically. See
[Setup](#setup) for the multi-cloud profile, the manual dev workflow, and configuration.

## Why Floci UI?

Floci exposes cloud-compatible APIs that are ideal for SDKs, CLI scripts, and automated tests, but day-to-day local
development also needs a visual layer:

- See which local cloud runtime the UI is connected to.
- Browse real local cloud resources without leaving the browser.
- Inspect service state without inventing resources.
- Keep observability and inspection explicit through the Cloud Explorer and future telemetry adapters.
- Keep unsupported screens explicit instead of hiding gaps behind dummy data.

## Project Vision

Floci UI is moving from an AWS-focused local console toward a metadata-driven explorer that can render multiple local
cloud runtimes through one consistent interface.

The initial unified scope is intentionally small:

- AWS S3 through Floci AWS Core.
- Azure Blob Storage through Floci-AZ.
- AWS Compute through the Cloud Explorer adapter model.
- AWS Networking through the Cloud Explorer adapter model.
- GCP appears only as a coming-soon placeholder.

Future scope:

- More AWS services.
- More Azure services.
- GCP support coming soon.
- Plugin/adapters ecosystem.
- Observability and resource inspection.

## Architecture Principle

The rule of the project is:

- The UI does not know clouds.
- The proxy does not know internal implementations.
- The SPI defines the contracts.
- The adapters perform the translation.
- Floci Core executes the runtime.

```mermaid
flowchart LR
    Browser["Browser"]
    UI["floci-ui-web\nReact + TypeScript"]
    Proxy["Cloud Proxy API\n/api/clouds/*"]
    Registry["Cloud Adapter Registry"]
    AWS["AWS Storage Adapter"]
    Azure["Azure Storage Adapter"]
    GCP["GCP Adapter\nComing Soon"]
    FlociAWS["Floci AWS Core\nlocalhost:4566"]
    FlociAZ["Floci-AZ\nlocalhost:4577"]
    Browser --> UI
    UI --> Proxy
    Proxy --> Registry
    Registry --> AWS
    Registry --> Azure
    Registry -. placeholder .-> GCP
    AWS --> FlociAWS
    Azure --> FlociAZ
```

The unified UI talks only to the Cloud Proxy API. The proxy resolves the selected cloud and service through the adapter
registry, then returns normalized resources and metadata schemas back to the web app.

## Architecture

![Floci Unified UI Multi-Cloud Architecture](docs/images/floci-unified-ui-architecture.png)

Short implementation notes are available in [docs/implementation-notes.md](docs/implementation-notes.md).

## Unified Storage Scope

The first metadata-driven service is `storage`.

| Cloud | Runtime | Adapter | Resource mapping | Status |
|---|---|---|---|---|
| AWS | Floci AWS Core | AWS Storage Adapter | S3 bucket -> storage resource | Implemented |
| Azure | Floci-AZ | Azure Storage Adapter | Blob container -> storage resource | Implemented |
| GCP | Future Floci-GP | GCP Adapter | Cloud Storage bucket -> storage resource | Coming soon |

Normalized resource shape:

```json
{
  "id": "string",
  "name": "string",
  "cloud": "aws | azure",
  "service": "storage",
  "type": "bucket | container",
  "region": "string | null",
  "createdAt": "string | null",
  "metadata": {}
}
```

## Unified Compute Scope

`compute` is available in the Cloud Explorer for AWS only.

| Cloud | Runtime | Adapter | Resource mapping | Status |
|---|---|---|---|---|
| AWS | Floci AWS Core | AWS Compute Adapter | EC2 instance / AMI -> compute resource | Partial |
| Azure | Future Floci-AZ compute adapter | Azure Compute Adapter | VM -> compute resource | Coming soon |
| GCP | Future Floci-GP compute adapter | GCP Compute Adapter | VM instance -> compute resource | Coming soon |

Current AWS Compute support in the unified Cloud Explorer:

- List EC2 instances as normalized compute resources.
- List AMIs as normalized compute resources.
- Inspect normalized instance and AMI metadata.
- Launch instances through an AWS-specific Compute panel.
- Start, stop, reboot, and terminate instances.
- View console output.
- Create AMIs from instances.
- Edit instance tags.
- Deregister AMIs.

Current limitations:

- Instance launch uses the Compute panel instead of the generic Cloud Explorer form because it needs dependent selectors
  such as VPC -> Subnet -> Security Group.
- There is no standalone legacy `/ec2` frontend page in the current UI.

## Unified Networking Scope

`networking` is available in the Cloud Explorer for AWS only.

| Cloud | Runtime | Adapter | Resource mapping | Status |
|---|---|---|---|---|
| AWS | Floci AWS Core | AWS Networking Adapter | VPC -> networking resource | Partial |
| Azure | Future Floci-AZ networking adapter | Azure Networking Adapter | VNet -> networking resource | Coming soon |
| GCP | Future Floci-GP networking adapter | GCP Networking Adapter | VPC network -> networking resource | Coming soon |

Current AWS Networking support in the unified Cloud Explorer:

- List VPCs as normalized networking resources.
- Inspect selected VPC metadata.
- Use the Networking panel for VPC, subnet, security group, gateway, route table, NAT gateway, and Elastic IP workflows.
- Create VPCs directly or through the VPC wizard.
- Allocate, associate, disassociate, and release Elastic IPs.

Current limitations:

- AWS Networking uses an AWS-specific panel because the workflows need resource-specific forms and nested operations.
- Azure VNet and GCP VPC adapters are not implemented yet.

## Current Cloud Service Status

These percentages describe UI coverage in the current frontend, grouped by the `Cloud Services` navigation model. They
do not describe backend completeness. Most dedicated AWS pages have been removed in favor of the Cloud Explorer and
its proxy/adapters.

| Category | AWS | Azure | GCP | Current UI status |
|---|---:|---:|---:|---|
| Storage | 95% | 80% | Coming soon | Unified Cloud Explorer support for AWS S3 and Azure Blob Storage. Buckets/containers, object browsing, upload, download, delete, folder prefixes, metadata, and inspector are wired. |
| Compute | 70% | Coming soon | Coming soon | AWS Compute is available under `/cloud-explorer/aws/compute`. It lists EC2 instances and AMIs, exposes launch/lifecycle actions through the Compute panel, supports console output, tags, AMI creation, and terminate/start/stop/reboot flows. Azure and GCP compute adapters are placeholders. |
| Networking | 75% | Coming soon | Coming soon | AWS Networking is available under `/cloud-explorer/aws/networking`. The panel exposes VPCs, subnets, security groups, internet gateways, NAT gateways, route tables, elastic IPs, and a VPC wizard through EC2-backed APIs. Azure VNet and GCP VPC support are placeholders. |
| k8s Engine | 35% | Coming soon | Coming soon | AWS EKS can be listed and inspected through the Cloud Explorer adapter and transitional EKS details. Cluster creation and node group management are not yet surfaced. |
| Database | 60% | 65% | Coming soon | AWS RDS list/inspect and Azure Cosmos DB NoSQL are wired through Cloud Explorer paths. Cosmos supports databases, containers, documents, and SQL query workflows when the runtime supports them. |
| Queue | Coming soon | Coming soon | Coming soon | No unified queue adapter is currently exposed in the UI. AWS SQS legacy UI was removed and should be rebuilt through Cloud Explorer contracts. |
| Function | Coming soon | Coming soon | Coming soon | No unified function adapter is currently exposed in the UI. AWS Lambda legacy UI was removed and should be rebuilt through Cloud Explorer contracts. |
| Events | Coming soon | Coming soon | Coming soon | No unified events adapter is currently exposed in the UI. AWS SNS legacy UI was removed and should be rebuilt through Cloud Explorer contracts. |
| Observability | Coming soon | Coming soon | Coming soon | No unified observability adapter is currently exposed in the UI. AWS CloudWatch legacy UI and request ingestion were removed from the frontend/backend legacy surface. |
| Security / Identity | 80% (Secrets Manager) | Coming soon | Coming soon | AWS Secrets Manager has a dedicated page for listing secrets, inspecting metadata, revealing/editing values, creating, and deleting. IAM, KMS, Cognito, and Systems Manager remain placeholders in the UI. |

Connected Cloud Explorer categories today:

- Storage: AWS S3, Azure Blob Storage.
- Compute: AWS EC2.
- Networking: AWS VPC/networking resources.
- k8s Engine: AWS EKS.
- Database: AWS RDS and Azure Cosmos DB NoSQL.

Dedicated AWS-specific pages today:

- Secrets Manager

Placeholder or not-yet-normalized categories today:

- Azure Compute, Networking, k8s, Database, Queue, Function, Events, Observability.
- GCP all categories.
- IAM, KMS, Cognito, Systems Manager, ElastiCache.

## Category Detail

<details>
<summary><strong>Storage</strong></summary>

### Storage

Cloud Explorer support:

- AWS S3 bucket -> normalized storage resource.
- Azure Blob container -> normalized storage resource.
- GCP Cloud Storage is a placeholder.
- Shared resource table, resource inspector, runtime status, adapter status, and action capabilities.
- Object/blob browser with prefix navigation.
- Upload, download, delete, refresh, and folder-prefix creation.
- Azure folder markers are hidden and rendered as navigable folders.
- Size and last-modified metadata are normalized for AWS objects and Azure blobs when the runtime returns them.

Remaining gaps:

| Gap | Notes |
|---|---|
| GCP Storage | Coming soon |
| Azure bucket/container advanced settings | Tags, access policy, and metadata editing are not yet exposed |
| Unified bulk actions | Multi-select and bulk delete are not yet exposed in the Cloud Explorer storage view |
| Version browser | Object version browsing is not wired |

</details>

<details>
<summary><strong>Compute</strong></summary>

### Compute

AWS support:

- Entry point: `/cloud-explorer/aws/compute`.
- AWS Compute adapter registered through the Cloud Adapter Registry.
- Normalized EC2 instances and AMIs in the generic resource table.
- Compute panel for AWS-specific operations.
- Instance launch form with AMI, instance type, key pair, VPC/subnet/security group, IAM profile, and user data.
- Instance lifecycle actions: start, stop, reboot, terminate.
- Console output.
- Create AMI from instance.
- Inline instance tag editing.
- AMI deregistration.

Provider status:

| Provider | Status |
|---|---|
| AWS | Partial but usable |
| Azure | Coming soon |
| GCP | Coming soon |

Remaining gaps:

| Gap | Notes |
|---|---|
| Multi-cloud compute contract | AWS EC2 is wired; Azure VM and GCP Compute Engine adapters are not implemented |
| Generic create schema | EC2 launch needs dependent selectors, so it lives in the Compute panel rather than a flat generic form |
| Full parity with AWS console | Some lower-level EC2 actions remain pending |

</details>

<details>
<summary><strong>Networking</strong></summary>

### Networking

AWS support:

- Entry point: `/cloud-explorer/aws/networking`.
- AWS Networking adapter exposes VPCs as top-level normalized resources.
- Networking panel for VPC and EC2-networking-specific operations.
- VPC list, detail, create, delete, and VPC wizard.
- Subnets list, create, delete, and detail.
- Security groups list, create, delete, inbound rule editing, and outbound display.
- Internet gateways list, create, attach, detach, delete.
- NAT gateways list, create, delete.
- Route tables list, create, edit routes, subnet associations, delete.
- Elastic IPs list, allocate, associate, disassociate, release.

Provider status:

| Provider | Status |
|---|---|
| AWS | Partial but usable |
| Azure | Coming soon |
| GCP | Coming soon |

Remaining gaps:

| Gap | Notes |
|---|---|
| Multi-cloud networking contract | AWS VPC is wired; Azure VNet and GCP VPC are not implemented |
| Generic action schema | Many networking actions require resource-specific forms and are handled by the Networking panel |
| Advanced network features | Peering, endpoints, ACLs, and deeper routing workflows are not yet complete |

</details>

<details>
<summary><strong>k8s Engine</strong></summary>

### k8s Engine

AWS support:

- AWS EKS adapter exists for normalized Cloud Explorer list/inspect.
- Dedicated EKS page exists for AWS-focused cluster inspection.
- Cluster status, version, endpoint, VPC config, and node group information can be inspected when available.

Provider status:

| Provider | Status |
|---|---|
| AWS | List/inspect oriented |
| Azure | Coming soon |
| GCP | Coming soon |

Remaining gaps:

| Gap | Notes |
|---|---|
| Cluster creation | Not surfaced |
| Node group lifecycle | Not fully surfaced |
| Azure AKS / GCP GKE | Not implemented |

</details>

<details>
<summary><strong>Database</strong></summary>

### Database

AWS support:

- AWS Database adapter exists for normalized Cloud Explorer list/inspect.
- RDS list/inspect is available through transitional Cloud Explorer database details.

Azure support:

- Azure Cosmos DB NoSQL adapter exists for Cloud Explorer database workflows.
- Database list/create/delete.
- Container list/create/delete after a database is selected.
- Document create/edit/delete after a container is selected.
- SQL query editor for documents/items.

Provider status:

| Provider | Status |
|---|---|
| AWS | RDS list/inspect |
| Azure | Cosmos DB NoSQL workflows |
| GCP | Coming soon |

Remaining gaps:

| Gap | Notes |
|---|---|
| Unified database resource model | RDS and Cosmos DB have different shapes and are not fully normalized into one category yet |
| AWS document/table databases | DynamoDB legacy UI was removed and should be rebuilt through Cloud Explorer contracts |
| GCP database services | Not implemented |

</details>

<details>
<summary><strong>Queue, Function, Events, and Observability</strong></summary>

### Queue

Queue is currently a Cloud Explorer placeholder. AWS SQS legacy UI has been removed. The next implementation should add
a normalized queue adapter, schema, resource table, message inspector, and lifecycle actions through `/api/clouds/*`.

### Function

Function is currently a Cloud Explorer placeholder. AWS Lambda legacy UI has been removed. The next implementation
should add a normalized function adapter, schema, list/inspect/invoke actions, and runtime logs through the proxy.

### Events

Events are currently not exposed as a unified Cloud Explorer category. AWS SNS legacy UI has been removed. The next
implementation should define event/topic contracts before adding provider-specific adapters.

### Observability

Observability is currently not exposed as a unified Cloud Explorer category. AWS CloudWatch legacy routes and frontend
pages have been removed. The next implementation should define provider-neutral logs, metrics, and request inspection
contracts.

</details>

<details>
<summary><strong>Security and Identity</strong></summary>

### Security and Identity

Current status:

- IAM is a placeholder.
- KMS is a placeholder.
- Secrets Manager has a dedicated AWS-specific page.
- Cognito is a placeholder.
- Systems Manager is a placeholder.

AWS Secrets Manager support:

- Entry point: `/secretsmanager`.
- List secrets with name, description, last-changed time, and tag count.
- Inspect secret metadata: ARN, description, KMS key, rotation state, version ids, timestamps, and tags.
- Reveal the current secret value on demand, with copy to clipboard. Values stay hidden until explicitly requested.
- Create a secret with a plaintext or JSON value.
- Update the value, which stores a new version.
- Delete a secret, with an optional force delete that skips the 7-day recovery window.

Verification: the operations above were exercised end-to-end through the UI against the bundled Floci runtime
(`floci/floci:latest-compat` on `:4566`, started via `docker compose -f docker-compose.dev.yml up`): create, list,
describe, reveal, update (new version id issued), and force delete all succeeded with `200` responses. `GET
/secret/value` returns `Cache-Control: no-store`, and requests with a missing id or a malformed JSON body return `400`.
Route behaviour is additionally covered by unit tests in `packages/api/src/routes/secretsmanager.test.ts` (AWS client
stubbed).

Remaining placeholders are intentionally visible so users can see the intended console shape, but they do not show fake
resources or demo data.

</details>

## Setup

### Run with Docker Compose (recommended)

The fastest way to start the full stack — frontend, API, and the Floci emulators — is the
single `docker-compose.yml`. Multi-cloud emulators are gated behind the `multicloud` profile,
so the default run is AWS-only.

Start the stack:

```bash
# AWS-only: floci-ui, floci-api, floci (Floci core)
docker compose up        # or: make up

# Full stack: adds floci-az (Azure), floci-gcp (GCP), and floci-seed
docker compose --profile multicloud up   # or: make up-multicloud
```

Once running, open the UI at http://127.0.0.1:4500/. Tear everything down with `make down`
(which also stops the multicloud services).

For local development without containers, follow the manual steps below.

### Prerequisites

- Node.js 20 or newer.
- pnpm 9 or newer.
- Bun, required by `packages/api`.
- Docker, if you want to run Floci with the published container image.

### 1. Start Floci core

Floci UI needs a running Floci core server before the API and frontend can load resources.

Terminal 1, using Docker:

```bash
docker run -d --name floci \
  -p 4566:4566 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e FLOCI_DEFAULT_REGION=us-east-1 \
  -u root \
  floci/floci:latest
```

Terminal 1, or using a local clone of `floci-io/floci`:

```bash
git clone https://github.com/floci-io/floci.git ../floci
cd ../floci
./mvnw clean quarkus:dev
```

In both cases, verify Floci core is reachable:

```bash
curl http://localhost:4566/_floci/health
```

For Azure Blob Storage exploration, also run Floci-AZ and expose it at `FLOCI_AZURE_ENDPOINT`
(`http://localhost:4577` by default). Floci-AZ routes Blob Storage requests under an Azure account path;
the local default is `FLOCI_AZURE_ACCOUNT_NAME=devstoreaccount1`.

For local development, the UI needs all three of these components running:

1. Floci core on `http://localhost:4566`.
2. The Floci UI API backend on `http://localhost:4501`.
3. The frontend dev server on `http://localhost:4500`.

The default root dev command now starts the API and frontend together.

### 2. Install Floci UI dependencies

```bash
pnpm install
```

### 3. Configure local environment

```bash
cp .env.example .env
```

Default `.env` values:

```bash
FLOCI_ENDPOINT=http://localhost:4566
FLOCI_AZURE_ENDPOINT=http://localhost:4577
FLOCI_AZURE_ACCOUNT_NAME=devstoreaccount1
VITE_MOCK_MODE=false
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
PORT=4501
```

`.env.example` already includes `VITE_MOCK_MODE=false` for real Floci usage.

### 4. Start local development

Terminal 2:

```bash
pnpm dev
```

This starts:

- `packages/api` on `http://localhost:4501`
- `packages/frontend` on `http://localhost:4500`

If you only want the frontend:

```bash
pnpm dev:web
```

If you only want the API:

```bash
pnpm dev:api
```

### 5. Open the UI

```text
http://127.0.0.1:4500/
```

## Environment

```bash
FLOCI_ENDPOINT=http://localhost:4566
FLOCI_AZURE_ENDPOINT=http://localhost:4577
FLOCI_AZURE_ACCOUNT_NAME=devstoreaccount1
VITE_MOCK_MODE=false
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
PORT=4501
```

Floci credentials can be any non-empty value for local development. They are required because the AWS SDK expects
credentials, but Floci does not require real AWS credentials.

## Verification

```bash
pnpm lint
pnpm type-check
pnpm build
```

## Troubleshooting

### "Runtime unavailable" error

If the UI shows "Runtime unavailable" or "The AWS Access Key Id you provided does not exist in our records", check the following:

#### 1. AWS credentials mismatch

The AWS credentials in `packages/api/.env` must match the credentials configured in your Floci container. By default, Floci uses `test`/`test`:

```bash
# Check Floci container credentials
docker inspect floci --format '{{range .Config.Env}}{{println .}}{{end}}' | grep AWS

# Ensure packages/api/.env has matching credentials
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

#### 2. Missing .env file in packages/api

The API server runs from `packages/api/` and uses `dotenv/config` to load environment variables. If `.env` only exists in the project root, the API will not find it.

Copy `.env` to the API package directory:

```bash
cp .env packages/api/.env
```

Then restart the API server:

```bash
pnpm dev
```

#### 3. Verify connectivity

Check that all services are reachable:

```bash
# Floci core
curl http://localhost:4566/_floci/health

# API server
curl http://localhost:4501/api/clouds/aws/status
```

The API response should show `"runtime": "reachable"` and `"error": null`.

## Design Direction

The target experience is a practical AWS-console-style interface:

- Dense, service-oriented navigation.
- Clear connection state in the top bar.
- Real resource counts.
- Dedicated pages for high-usage services.
- Empty states when no resources exist.
- Placeholders when a service is not wired yet.
- No decorative data or fake operational metrics.

## Contributing

When adding service UI, follow these rules:

- Use existing Floci AWS-compatible endpoints.
- Do not add custom backend endpoints just for the UI unless the core project explicitly accepts that contract.
- Prefer real empty states over sample data.
- Keep service status percentages updated in this README.
- Add verification notes for any newly wired operations.

## License

[MIT](LICENSE) — part of the [Floci](https://floci.io) ecosystem.
