# modular-backend-lab

A modular TypeScript backend reference architecture for backends where policies, edge cases, and
external integrations accumulate across business domains. Business flows are modeled as independent
modules, and stateful areas record changes through an event ledger and projections.

[한국어 문서](./README.ko.md)

## Architecture Summary

The organizing rule is explicit: business state and rules stay in the domain/application core, while HTTP, database, queue, scheduler, and telemetry concerns stay in outer adapters.

```txt
HTTP / Workers / Scheduler
        |
Application usecases
        |
Domain logic + ports
        |
Infrastructure adapters
```

- Hono = HTTP delivery adapter
- Auth = credential/session module attached to customerId
- Authorization = actor role grant and permission decision module
- Audit-log = immutable actor/action/resource/result audit record module
- Address-book = reusable address module attached to customerId
- Support-ticket = customer inquiry intake, assignment, resolution, and closure workflow module
- Kysely = persistence adapter
- Scheduler/Worker = delivery/runtime adapter
- BullMQ/SQS = queue adapter
- Valkey = local Redis-compatible infrastructure
- OpenTelemetry = telemetry instrumentation boundary
- Grafana stack = local observability runtime
- Domain/Application = portable core
- Domain events = append-only business ledger
- Current state tables = read model projections
- Outbox events = integration publishing queue
- TypeScript compiler = first-line architecture guard

## Design Principles

This repository focuses less on framework mechanics and more on making change locations explicit as
requirements grow. Domain rules, usecase orchestration (workflow coordination), persistence
(database adapters), delivery (HTTP/job/worker entry points), and external integrations
(PG/ERP/WMS-style adapters) are separated. Event ledger (append-only history), projections
(read/current-state models), outbox (integration publishing queue), and quality gates (repeatable
checks) are treated as operating units.

### Boundaries And Types

- TypeScript strict mode, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` provide early
  compile-time feedback.
- Zod is limited to boundary validation for HTTP, env, and external payloads.
- Expected business failures return `Result` instead of exceptions.
- dependency-cruiser and `scripts/convention-scan.ts` check framework/infra leakage, unsafe casts,
  and weakened strictness.

### Functional Style In TypeScript

The domain layer favors pure functions, immutable state transitions, discriminated unions,
exhaustive checks, and `Result` returns over inheritance-heavy object models. Large batch or status
sync flows use `AsyncIterable` where the input can grow. Rather than introducing a separate
functional library, boundaries and state are modeled with standard TypeScript.

### State Changes And Ledgers

- Domain functions receive input and return new state plus domain events without doing IO.
- State changes append `domain_events`, update current projections, and write outbox rows inside
  explicit UnitOfWork transactions.
- Current tables are projections for reads and idempotency, while `outbox_events` is the integration
  publishing queue.
- Customer, auth, authorization, audit-log, address-book, order, payment, inventory, fulfillment,
  refund, settlement, promotion, returns, notification, and support-ticket keep append-only domain
  event streams as the basis for state changes.

### Performance-Conscious Design

- Hono stays as a thin HTTP adapter to keep request handling and coupling small.
- Kysely keeps SQL explicit without a heavy ORM abstraction.
- Large batch workloads use `AsyncIterable` streaming with explicit bounded concurrency.
- The outbox publisher avoids doing external publishing inside long DB transactions.
- Prometheus/OpenTelemetry wiring makes latency, request count, and runtime signals observable.

### Debuggability

- Request validation, usecase orchestration, domain state transitions, and persistence adapters are
  separated, which helps narrow a failure to HTTP input, business rules, storage, or external
  integration.
- Expected failures return `Result` values and discriminated unions, so route response mapping and
  tests can check failure cases explicitly.
- `domain_events`, projections, and `outbox_events` are separate, making it possible to inspect what
  changed, what the current read state is, and how far integration publishing progressed.
- Request ids, structured logging, metrics, and traces live at adapter/runtime boundaries, leaving
  operational signals without putting instrumentation inside domain logic.

### Sustainability

- Domain, application, ports, infra, HTTP, jobs, and workers are separated to keep change scope local
  as modules grow.
- Modules center on domain/application/ports so the core can remain reusable when HTTP, DB, or queue
  adapters differ.
- `AGENTS.md`, `docs/`, and `ai/skills/` document future AI/human maintenance rules.
- Biome, dependency-cruiser, convention scanner, and CI quality gates provide repeatable verification.
- Dependencies use exact versions and a lockfile, with Node Active LTS documented as policy.
- Tests are added by risk and observable behavior, not file count.

## Boundary Roles

Hono stays as a delivery adapter. Hono Context never enters application or domain code.

Kysely provides typed SQL but remains a persistence adapter. DB rows are explicitly mapped to domain
models.

Queue backends are isolated behind ports. Core processors do not know BullMQ, SQS, Redis, or Valkey.

OpenTelemetry and Grafana are runtime instrumentation boundaries. Pure domain logic does not log,
emit metrics, or start traces directly.

## Event Sourcing And Projections

Flows tied to customer lifecycle, auth sessions, role grants, audit records, address books, money,
stock, settlement readiness, coupon policy, returns, support operations, or delivery state use
append-only `domain_events` as the business ledger. Current tables such as `customers`,
`auth_email_credentials`, `auth_sessions`, `authorization_role_grants`, `audit_log_records`,
`address_book_addresses`, `orders`, `payments`, `inventory_items`, `fulfillments`, `refunds`,
`settlements`, `coupons`, `coupon_redemptions`, `return_requests`, and `support_tickets` are
projections for API responses, idempotency lookups, and batch scans.

`outbox_events` is not the event store. `domain_events` records aggregate state and audit/accounting
evidence; `outbox_events` handles integration publishing, retry, and delivery failure isolation.
State-changing usecases keep domain event append, projection update, and outbox writes in the same
short transaction.

This repository does not embed ERP or accounting features in the core. `settlement` is a generic
module that combines payment, refund, and delivery events into order-level settlement readiness.
Company-specific rules such as journal generation, tax, fees, payouts, or ERP sync should live in a
separate adapter or downstream system that reads these events and projections.

## How Requirements Grow

Business backends usually become complex through many small policies, edge cases, and integrations
rather than one large feature. This structure is meant to give those changes a clear home without
spreading the change across unrelated flows.

- Policy changes extend domain events and state transitions. For example, return requests, RMA
  authorization, receipt, and inspection are owned by `returns`, while follow-up partial refund or
  restock workflows can consume those events.
- Discount policies stay in `promotion` as coupon policy and redemption lifecycle. Minimum order
  amount, SKU eligibility, usage limits, and release after checkout failure do not leak into
  order/payment internals.
- Process changes add orchestration. Manual approval before refunds, automatic settlement after
  delivery, or compensation for inventory shortages can be connected through usecases, jobs, and
  outbox events without coupling modules directly.
- Customer identity belongs in `customer`, which owns a stable `customerId` and lifecycle.
- Email/password login belongs in `auth`, which owns credential, password hash, and session token
  lifecycle. Password hashing and token generation stay behind ports, and raw passwords or raw
  tokens are not stored.
- Roles and permission decisions belong in `authorization`, which owns actor role grants and answers
  whether an actor may perform an action. `auth` owns sessions and credentials; `authorization` owns
  permission decisions.
- Audit records belong in `audit-log`, which stores actor, action, resource, result, reason, and
  metadata as immutable records. Authorization remains responsible for allow/deny decisions;
  audit-log records the decision and execution outcome.
- Reusable customer addresses belong in `address-book`, which owns address source data and default
  address selection. `fulfillment` keeps shipment-time address snapshots instead of owning reusable
  customer addresses.
- External systems attach through ports and adapters. PGs, ERPs, WMSs, carriers, and notification
  systems stay outside the core, with adapters translating internal events and commands to their
  APIs.
- Notifications use `notification` request, send, failure, and retry state. Real email/SMS/Slack
  providers stay behind a sender port, while send results are recorded as projections and events.
- Support operations use `support-ticket` for intake, assignment, waiting-for-customer, resolution,
  and closure. Orders, returns, and refunds are linked by reference IDs rather than by importing
  their module internals.
- Operations screens and reports use projections/read models. Query requirements should not bend the
  domain model; they can be built from `domain_events` or current tables.
- New domains attach as independent modules. Loyalty, coupon, and settlement modules can follow the
  same layer shape and integrate through domain events, application ports, outbox jobs, or explicit
  orchestration.

## Folder Structure

```txt
src/shared      small reusable primitives
src/infra       config, DB, logging, telemetry, queue adapters
src/http        Hono app, middleware, delivery routes
src/modules     business modules
src/jobs        batch and outbox processors
src/workers     runtime entrypoints and scheduler adapters
docs            architecture and maintenance policy
ai/skills       operational playbooks for future AI agents
```

Current business modules:

```txt
src/modules/order/       order lifecycle event stream and payment-state projection
src/modules/customer/    customer registration, suspension, reactivation, and closure event stream
src/modules/auth/        email credential, login, session issue/verification/revocation event stream
src/modules/authorization/ actor role grant, revoke, and permission decision event stream
src/modules/audit-log/   actor action/resource/result immutable audit record event stream
src/modules/address-book/ customer address add, update, default selection, and disable event stream
src/modules/inventory/   SKU movement ledger with reservation, release, commit, expiration projections
src/modules/payment/     payment lifecycle event stream behind a Toss Payments adapter
src/modules/checkout/    order validation, inventory, payment, and compensation orchestration reference
src/modules/fulfillment/ fulfillment, label, and shipment status event stream with projection
src/modules/refund/      refund request, approval, PG refund, restock, and completion event stream
src/modules/settlement/  order-level settlement readiness from payment, refund, and delivery events
src/modules/promotion/   coupon discount policy, quote, reservation, commit, and release event stream
src/modules/returns/     return request, RMA authorization, receipt, and inspection event stream
src/modules/notification/ notification request, send success/failure, and retry tracking event stream
src/modules/support-ticket/ customer support intake, assignment, resolution, and closure event stream
```

Each module follows the same layer shape:

```txt
  domain/
  application/
  ports/
  infra/
  http/
  tests/
```

Each layer has a narrow role:

- `domain/`: pure TypeScript types and state transition functions. It favors receiving input and
  returning new state plus domain events without IO, frameworks, DB access, or logging.
- `application/`: usecase orchestration. It composes repositories, external providers, and
  transaction ports, and returns expected failures as `Result`.
- `ports/`: repository, UnitOfWork, and external gateway interfaces required by application code.
- `infra/`: concrete port implementations such as Kysely repositories, mappers, and external API
  adapters.
- `http/`: Hono/Zod delivery adapter code. It validates requests, builds command objects, calls
  usecases, and maps responses.
- `tests/`: risk-based coverage for domain behavior, usecase orchestration, route contracts, and
  repository behavior.

Transaction boundaries are explicit in application usecases. Domain code does not know about
transactions, and Kysely transactions do not leak past infrastructure adapters. Domain event append,
current projection update, and outbox writes happen together inside short UnitOfWork transactions,
while external calls such as payment or carrier API requests happen outside DB transactions.

## Tech Stack And Rationale

- Node.js 24 Active LTS: the target workload is IO-bound APIs and workers waiting on PostgreSQL, payment providers, carriers, queues, and observability exporters. Node's event-loop based nonblocking IO is a good fit for handling many concurrent waits without tying up one OS thread per request. CPU-bound work should move to queues/workers, and multicore usage is handled through horizontally scaled stateless processes.
- TypeScript ESM, strict mode: domain states, commands, events, and errors can be modeled with discriminated unions and exhaustive checks so boundary drift is caught early by the compiler.
- pnpm, exact dependency saves: lockfiles and exact versions keep installs reproducible.
- Hono, `@hono/node-server`: a small HTTP API surface keeps the framework as a thin delivery adapter.
- PostgreSQL, Kysely, `pg`: business state needs transactions, constraints, and relational queries; Kysely keeps SQL explicit while DB rows stay separate from domain models.
- Zod: validation and narrowing are limited to untrusted boundaries such as HTTP, env, and external webhook payloads.
- Toss Payments adapter: PG integration sits behind a payment gateway port so core usecases do not know provider SDK or HTTP details.
- Pino JSON logging: operational logs are emitted as structured JSON signals.
- OpenTelemetry, Prometheus, Grafana stack: request and runtime signals are observed outside application/domain logic through standard instrumentation boundaries.
- BullMQ + Valkey, SQS documentation: local development uses a Redis-compatible queue, while AWS-style deployments can replace the queue adapter with SQS without changing core processors.
- Vitest, Testcontainers: pure domain/usecase behavior stays in fast unit tests, while repositories and migrations are verified against real PostgreSQL.
- Biome, dependency-cruiser, custom convention scanner: formatting/lint, import direction, and repository-specific architecture rules are enforced as repeatable quality gates.

## Local Setup

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm dev
```

### Local Kubernetes(kind)

The local Kubernetes baseline runs the API and background runtimes together in kind: API, outbox
worker, scheduler, migration job, Postgres, Valkey, Prometheus, Grafana, Tempo, Loki, Alloy, and
kube-state-metrics.

Prerequisites:

- Docker
- kind
- kubectl

Statically validate local manifest rendering and baseline defaults without a cluster:

```bash
pnpm k8s:validate
```

Start the baseline:

```bash
scripts/k8s-local-up.sh
```

Open local ports:

```bash
scripts/k8s-local-port-forward.sh
```

Then use:

- API health: http://localhost:3000/healthz
- API readiness: http://localhost:3000/readyz
- Grafana: http://localhost:3001 (`admin` / `admin`)
- Prometheus: http://localhost:9090

Stop and remove the kind cluster:

```bash
scripts/k8s-local-down.sh
```

Reusable app/runtime manifests live in `deploy/k8s/base/`: API, worker, scheduler, migration job, and
the shared configmap.

The kind-only overlay lives in `deploy/k8s/local/`. The local kustomization references `../base` and
keeps `secrets.example.yaml`, namespace, Postgres, Valkey, the observability stack, and kind cluster
config local. `secrets.example.yaml` contains non-sensitive defaults for kind and is applied by the
local kustomization. Postgres and Valkey use disposable `emptyDir` volumes so the cluster can be
recreated cheaply. `kubectl kustomize deploy/k8s/local` renders the full local baseline.

The local baseline includes the minimum runtime defaults to check before moving toward an operational
deployment:

- The API uses `/readyz` for readiness and `/healthz` for liveness, with a 30 second termination
  grace aligned to the existing SIGTERM graceful shutdown path.
- API, worker, scheduler, and migration pods declare resource requests/limits, non-root app
  container security context, `RuntimeDefault` seccomp, dropped capabilities, and blocked privilege
  escalation.
- The migration job has a 900 second active deadline, and `scripts/k8s-local-up.sh` waits up to the
  same default. Use `K8S_MIGRATION_WAIT_TIMEOUT` when a longer local verification run is needed.
- Worker and scheduler are process runtimes without HTTP endpoints. The baseline does not invent
  HTTP probes; health is observed through process exit, Kubernetes restart, JSON logs, bounded
  resources, and deployment availability.
- Scheduler and worker rollouts use `Recreate` in the local singleton baseline to avoid duplicate
  process execution. The API keeps a rolling update. The single-replica kind baseline does not define
  a PodDisruptionBudget.
- HPA is documented only because it needs metrics-server and load targets. NetworkPolicy is also
  documented only because kind's default CNI may not enforce it.

Example request:

```bash
curl -X POST http://localhost:3000/orders/order-1/pay

curl -X POST http://localhost:3000/customers \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"customer-register-1","email":"customer@example.com","displayName":"Kim"}'

curl -X POST http://localhost:3000/customers/customer-1/suspend \
  -H 'content-type: application/json' \
  -d '{"reason":"payment risk"}'

curl -X POST http://localhost:3000/customers/customer-1/reactivate

curl -X POST http://localhost:3000/customers/customer-1/close \
  -H 'content-type: application/json' \
  -d '{"reason":"customer requested closure"}'

curl -X POST http://localhost:3000/auth/email/register \
  -H 'content-type: application/json' \
  -d '{"customerId":"customer-1","idempotencyKey":"auth-register-1","email":"customer@example.com","password":"password-1"}'

curl -X POST http://localhost:3000/auth/email/login \
  -H 'content-type: application/json' \
  -d '{"email":"customer@example.com","password":"password-1"}'

curl -X POST http://localhost:3000/auth/sessions/verify \
  -H 'content-type: application/json' \
  -d '{"token":"session-token"}'

curl -X POST http://localhost:3000/auth/sessions/revoke \
  -H 'content-type: application/json' \
  -d '{"token":"session-token"}'

curl -X POST http://localhost:3000/authorization/role-grants \
  -H 'content-type: application/json' \
  -d '{"actorId":"agent-1","role":"SUPPORT_AGENT","idempotencyKey":"grant-role-1","grantedByActorId":"admin-1","grantReason":"support team member"}'

curl -X POST http://localhost:3000/authorization/check \
  -H 'content-type: application/json' \
  -d '{"actorId":"agent-1","permission":"support-ticket:assign","resource":{"type":"SUPPORT_TICKET","id":"ticket-1"}}'

curl -X POST http://localhost:3000/authorization/role-grants/grant-1/revoke \
  -H 'content-type: application/json' \
  -d '{"revokedByActorId":"admin-1","revokeReason":"team changed"}'

curl -X POST http://localhost:3000/audit-log/records \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"audit-1","actorId":"agent-1","action":"support-ticket.assign","resourceType":"SUPPORT_TICKET","resourceId":"ticket-1","result":"SUCCESS","reason":"assigned to support queue","requestId":"request-1","metadata":{"ticketId":"ticket-1","assigneeId":"agent-1"},"occurredAt":"2026-01-01T00:00:00.000Z"}'

curl -X POST http://localhost:3000/address-book/addresses \
  -H 'content-type: application/json' \
  -d '{"customerId":"customer-1","idempotencyKey":"address-add-1","purpose":"SHIPPING","makeDefault":true,"label":"Home","recipientName":"Kim","phone":"010-0000-0000","line1":"Seoul road 1","line2":null,"city":"Seoul","region":null,"postalCode":"12345","country":"KR"}'

curl -X POST http://localhost:3000/address-book/addresses/address-1/default

curl -X POST http://localhost:3000/address-book/addresses/address-1/disable \
  -H 'content-type: application/json' \
  -d '{"reason":"customer requested removal"}'

curl -X POST http://localhost:3000/payments/confirm \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","paymentKey":"test-payment-key","amount":10000,"currency":"KRW","idempotencyKey":"confirm-1"}'

curl -X POST http://localhost:3000/checkout/submit \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","sku":"sku-1","quantity":2,"paymentKey":"test-payment-key","amount":10000,"currency":"KRW","idempotencyKey":"checkout-1"}'

curl -X POST http://localhost:3000/fulfillments \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","idempotencyKey":"fulfillment-1","recipient":{"name":"Kim","phone":"010-0000-0000","line1":"Seoul","line2":null,"postalCode":"12345","country":"KR"},"package":{"weightGrams":500,"description":"T-shirt"}}'

curl -X POST http://localhost:3000/fulfillments/fulfillment-1/pack

curl -X POST http://localhost:3000/fulfillments/fulfillment-1/label \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"label-1"}'

curl -X POST http://localhost:3000/refunds \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","paymentId":"payment-1","amount":10000,"currency":"KRW","reason":"customer request","returnRequired":true,"restock":{"sku":"sku-1","quantity":2},"idempotencyKey":"refund-1"}'

curl -X POST http://localhost:3000/refunds/refund-1/process

curl -X POST http://localhost:3000/returns \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1","fulfillmentId":"fulfillment-1","idempotencyKey":"return-1","reason":"wrong size","items":[{"sku":"sku-1","quantity":1}]}'

curl -X POST http://localhost:3000/returns/return-1/authorize

curl -X POST http://localhost:3000/returns/return-1/receive

curl -X POST http://localhost:3000/returns/return-1/inspect \
  -H 'content-type: application/json' \
  -d '{"accepted":true,"restockableItems":[{"sku":"sku-1","quantity":1}],"note":"restockable"}'

curl -X POST http://localhost:3000/notifications \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"notify-1","channel":"EMAIL","recipient":"customer@example.com","templateKey":"return.authorized","payload":{"orderId":"order-1","rmaNumber":"RMA-1"}}'

curl -X POST http://localhost:3000/notifications/notification-1/send

curl -X POST http://localhost:3000/support/tickets \
  -H 'content-type: application/json' \
  -d '{"customerId":"customer-1","idempotencyKey":"ticket-1","category":"ORDER","priority":"NORMAL","subject":"Order address change","description":"Customer wants to change the shipping address","orderId":"order-1"}'

curl -X POST http://localhost:3000/support/tickets/ticket-1/assign \
  -H 'content-type: application/json' \
  -d '{"assigneeId":"agent-1"}'

curl -X POST http://localhost:3000/support/tickets/ticket-1/waiting-customer

curl -X POST http://localhost:3000/support/tickets/ticket-1/resolve \
  -H 'content-type: application/json' \
  -d '{"resolution":"Customer confirmed the new address"}'

curl -X POST http://localhost:3000/support/tickets/ticket-1/close

curl -X POST http://localhost:3000/promotions/coupons \
  -H 'content-type: application/json' \
  -d '{"code":"save-3000","discount":{"type":"FIXED_AMOUNT","amount":{"amount":3000,"currency":"KRW"}},"minOrderAmount":{"amount":5000,"currency":"KRW"},"eligibleSkus":["sku-1"],"maxRedemptions":100,"startsAt":"2026-01-01T00:00:00.000Z","expiresAt":"2026-12-31T00:00:00.000Z"}'

curl -X POST http://localhost:3000/promotions/coupons/quote \
  -H 'content-type: application/json' \
  -d '{"code":"save-3000","orderId":"order-1","orderAmount":{"amount":10000,"currency":"KRW"},"skus":["sku-1"]}'

curl -X POST http://localhost:3000/promotions/coupons/reserve \
  -H 'content-type: application/json' \
  -d '{"code":"save-3000","orderId":"order-1","orderAmount":{"amount":10000,"currency":"KRW"},"skus":["sku-1"],"idempotencyKey":"coupon-reserve-1"}'

curl -X POST http://localhost:3000/settlements/sync \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-1"}'

curl http://localhost:3000/settlements/order-1
```

Run the outbox job:

```bash
pnpm worker:outbox
```

Run the inventory reservation expiration job:

```bash
pnpm worker:inventory-expire
```

Run the fulfillment status sync job:

```bash
pnpm worker:fulfillment-sync
```

Run the settlement sync job:

```bash
pnpm worker:settlement-sync
```

Run long-lived local runtime adapters:

```bash
pnpm dev:outbox-worker
pnpm dev:scheduler
```

## Observability

```bash
pnpm observability:up
```

- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200
- Loki: http://localhost:3100

The service exposes Prometheus metrics at `/metrics` and can export OTLP traces/metrics to
`OTEL_EXPORTER_OTLP_ENDPOINT`.

In local Kubernetes, Prometheus scrapes the API service at `/metrics`, Tempo receives OTLP HTTP
traces from runtime pods, and kube-state-metrics provides pod/deployment state for the API, worker,
scheduler, and observability pods. Loki is deployed and provisioned as a Grafana datasource, but
application log shipping is not added here; Pino logs remain JSON-shaped for a future log collector.

## EKS Considerations

This repository currently provides a reusable app/runtime Kubernetes base and a kind-only local
overlay. EKS overlays, Terraform, Helm, EKS cluster resources, VPC resources, ALB Ingress manifests,
RDS, SQS, IRSA manifests, and Secrets Manager/SSM resource provisioning are out of scope.

`deploy/k8s/base/` is the runtime shape for the API, worker, scheduler, migration job, and shared
configmap. `deploy/k8s/local/` is the kind-only overlay that adds a namespace, non-sensitive secret
example, local Postgres, local Valkey, local observability stack, and kind cluster config. An EKS
overlay should separate those local-only pieces and replace them with managed services or explicit
operational boundaries.

For EKS-style deployment, keep the same adapter boundaries. See
[`docs/19-eks-operating-boundaries.md`](./docs/19-eks-operating-boundaries.md) for the fuller
operating checklist.

- Replace in-cluster Postgres with RDS through `DATABASE_URL`.
- Replace local BullMQ/Valkey with an SQS queue adapter behind the existing queue/event publisher
  ports.
- Replace local Kubernetes Secrets with a secret delivery path such as Secrets Manager, SSM, or
  External Secrets.
- Use IRSA/workload identity for pod AWS access instead of static credentials.
- Put ingress behind the ALB Ingress Controller or another Kubernetes ingress controller. Hono and
  application code do not know that choice.
- Add an API PodDisruptionBudget after running at least two API replicas and choosing a
  `minAvailable` or `maxUnavailable` policy.
- Add HPA only after choosing metrics-server or a managed metrics path plus SLO/load targets.
- Add NetworkPolicy only after confirming CNI enforcement and the required namespace, database,
  queue, and observability flows.
- Keep OpenTelemetry, Prometheus, Grafana, Loki, and Tempo as runtime/observability concerns outside
  domain and application code, replacing them with managed observability where appropriate.

## Environment

See `.env.example` for all variables. Only `src/infra/config/env.ts` may read environment variables.
If `TOSS_PAYMENTS_SECRET_KEY` is not configured, the server still starts and the payment gateway
returns an explicit `PAYMENT_GATEWAY_NOT_CONFIGURED` failure.

## Commands

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
pnpm quality
```

Development server:

```bash
pnpm dev
pnpm dev:worker
pnpm dev:outbox-worker
pnpm dev:scheduler
```

DB migration:

```bash
pnpm db:migrate
pnpm db:rollback
```

Module folder scaffold:

```bash
pnpm scaffold:module promotion
```

This command creates only the standard layer folders and empty `index.ts` files. Domain models,
usecases, repositories, and routes still need to be designed from the actual requirement.

## Testing Strategy

Tests are risk-based and behavior-first. A function existing is not enough reason to test it.

This repository includes domain behavior tests, usecase orchestration tests, Hono route contract
tests, outbox job tests, and Docker-backed PostgreSQL integration tests.

If Docker is unavailable, integration tests remain runnable and are explicitly gated.

## Expansion Policy

Add new modules by following the existing layer shape. Do not directly share another module's `infra`
or `http` layer.

Core logic communicates through usecases, ports, and domain events.

Repetition helpers stay outside the core boundaries. `pnpm scaffold:module <name>` creates a
starting folder shape only, route tests use `test/http/create-test-app.ts` to inject only the
usecases under test, and outbox row insert conversion is shared through
`src/infra/outbox/outbox-event.mapper.ts`. Domain event definitions and persistence timing remain in
each module's domain/application/infra flow.

Large batch workloads use `AsyncIterable`. Normal bounded HTTP reads use `Promise<T>` or
`Promise<T[]>`.

## AI Maintenance Policy

`AGENTS.md` is the source of truth. Future agents should read it first, then the relevant `docs/`
page and `ai/skills/*.md` playbook.

Available skills:

- `add-domain-module`
- `add-usecase`
- `add-http-route`
- `add-repository`
- `add-batch-job`
- `add-queue-adapter`
- `add-observability-signal`
- `refactor-with-boundaries`
- `run-quality-gates`
- `enforce-type-safety`

## Convention Harness

```txt
AGENTS.md                  intent and non-negotiable rules
ai/skills/*.md             repeatable AI workflows
Biome                      formatting and linting
dependency-cruiser         import boundaries
scripts/convention-scan.ts repository-specific drift checks
docs/17-definition-of-done completion standard
docs/19-eks-operating-boundaries EKS adapter/runtime boundary guide
CI                         quality gates
```

Biome catches style, dependency-cruiser catches import direction, and `convention-scan` catches
repository-specific architecture/type-safety drift.

## Definition of Done

A meaningful change is done when these pass:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
```

TypeScript strictness, architecture boundaries, risk-based tests, and documentation updates must be
preserved.
