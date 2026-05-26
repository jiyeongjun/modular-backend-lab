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
- Order, payment, inventory, fulfillment, refund, settlement, and promotion keep append-only domain
  event streams as the basis for state changes.

### Performance-Conscious Design

- Hono stays as a thin HTTP adapter to keep request handling and coupling small.
- Kysely keeps SQL explicit without a heavy ORM abstraction.
- Large batch workloads use `AsyncIterable` streaming with explicit bounded concurrency.
- The outbox publisher avoids doing external publishing inside long DB transactions.
- Prometheus/OpenTelemetry wiring makes latency, request count, and runtime signals observable.

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

Flows tied to money, stock, settlement readiness, coupon policy, or delivery state use append-only
`domain_events` as the business ledger. Current tables such as `orders`, `payments`,
`inventory_items`, `fulfillments`, `refunds`, `settlements`, `coupons`, and
`coupon_redemptions` are projections for API responses, idempotency lookups, and batch scans.

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

- Policy changes extend domain events and state transitions. For example, partial refunds,
  exchanges, and return inspection can be modeled in `refund`, while application usecases coordinate
  the workflow.
- Discount policies stay in `promotion` as coupon policy and redemption lifecycle. Minimum order
  amount, SKU eligibility, usage limits, and release after checkout failure do not leak into
  order/payment internals.
- Process changes add orchestration. Manual approval before refunds, automatic settlement after
  delivery, or compensation for inventory shortages can be connected through usecases, jobs, and
  outbox events without coupling modules directly.
- External systems attach through ports and adapters. PGs, ERPs, WMSs, carriers, and notification
  systems stay outside the core, with adapters translating internal events and commands to their
  APIs.
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
src/modules/inventory/   SKU movement ledger with reservation, release, commit, expiration projections
src/modules/payment/     payment lifecycle event stream behind a Toss Payments adapter
src/modules/checkout/    order validation, inventory, payment, and compensation orchestration reference
src/modules/fulfillment/ fulfillment, label, and shipment status event stream with projection
src/modules/refund/      refund request, approval, PG refund, restock, and completion event stream
src/modules/settlement/  order-level settlement readiness from payment, refund, and delivery events
src/modules/promotion/   coupon discount policy, quote, reservation, commit, and release event stream
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

Example request:

```bash
curl -X POST http://localhost:3000/orders/order-1/pay

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
