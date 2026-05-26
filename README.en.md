# modular-backend-lab

A modular TypeScript backend reference architecture for business domains that grow over time.

[한국어 문서](./README.ko.md)

## Architecture Summary

The core rule is simple: adapters stay at the edge and business behavior stays in the portable core.

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
- TypeScript compiler = first-line architecture guard

## Design Philosophy

This repository is organized around explicit boundaries: portable domain/application code,
adapter-based infrastructure, explicit transactions, typed boundary validation, and repeatable
quality gates.

### Safety

- TypeScript strict mode, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` provide early
  compile-time feedback.
- Zod is limited to boundary validation for HTTP, env, and external payloads.
- Expected business failures return `Result` instead of exceptions.
- State changes and outbox writes happen inside explicit UnitOfWork transactions.
- dependency-cruiser and `scripts/convention-scan.ts` check framework/infra leakage, unsafe casts,
  and weakened strictness.

### Performance-Conscious Design

- Hono stays as a thin HTTP adapter to keep request handling and coupling small.
- Kysely keeps SQL explicit without a heavy ORM abstraction.
- Large batch workloads use `AsyncIterable` streaming with explicit bounded concurrency.
- The outbox publisher avoids doing external publishing inside long DB transactions.
- Prometheus/OpenTelemetry wiring makes latency, request count, and runtime signals observable.

### Sustainability

- Domain, application, ports, infra, HTTP, jobs, and workers are separated to keep change scope local
  as modules grow.
- `AGENTS.md`, `docs/`, and `ai/skills/` document future AI/human maintenance rules.
- Biome, dependency-cruiser, convention scanner, and CI quality gates provide repeatable verification.
- Dependencies use exact versions and a lockfile, with Node Active LTS documented as policy.
- Tests are added by risk and observable behavior, not file count.

## Tech Stack

- Node.js 24 Active LTS
- TypeScript ESM, strict mode
- pnpm, exact dependency saves
- Hono, `@hono/node-server`
- PostgreSQL, Kysely, `pg`
- Zod boundary validation
- Toss Payments adapter behind a payment gateway port
- Pino JSON logging
- OpenTelemetry, Prometheus metrics, Grafana stack
- BullMQ + Valkey locally
- SQS documented as the AWS managed queue alternative
- Vitest, Testcontainers
- Biome, dependency-cruiser
- Custom convention scanner

## Why These Boundaries

Hono stays as a thin delivery adapter. Hono Context never enters application or domain code.

Kysely provides typed SQL but remains a persistence adapter. DB rows are explicitly mapped to domain
models.

Queue backends are isolated behind ports. Core processors do not know BullMQ, SQS, Redis, or Valkey.

OpenTelemetry and Grafana are runtime instrumentation boundaries. Pure domain logic does not log,
emit metrics, or start traces directly.

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
src/modules/order/       payment transition and outbox reference
src/modules/inventory/   stock reservation, release, commit, and expiration reference
src/modules/payment/     Toss Payments confirm/cancel adapter and payment state reference
src/modules/checkout/    order validation, inventory, payment, and compensation orchestration reference
src/modules/fulfillment/ post-payment fulfillment, labels, and shipment status sync reference
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

The structure borrows a practical subset of functional programming style without depending on a
specific FP framework. In the domain layer, the code favors pure functions, immutable state
transitions, discriminated unions, exhaustive checks, and `Result` returns over class hierarchies.
It does not introduce an effect system such as `Effect` or `fp-ts`; the goal is explicit boundaries
and state modeling with standard TypeScript.

Transaction boundaries are explicit in application usecases. Domain code does not know about
transactions, and Kysely transactions do not leak past infrastructure adapters. State changes and
outbox writes happen together inside short UnitOfWork transactions, while external calls such as
payment or carrier API requests happen outside DB transactions.

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

## Testing Strategy

Tests are risk-based and behavior-first. A function existing is not enough reason to test it.

This repository includes domain behavior tests, usecase orchestration tests, Hono route contract
tests, outbox job tests, and Docker-backed PostgreSQL integration tests.

If Docker is unavailable, integration tests remain runnable and are explicitly gated.

## Expansion Policy

Add new modules by following the existing layer shape. Do not directly share another module's `infra`
or `http` layer.

Core logic communicates through usecases, ports, and domain events.

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
