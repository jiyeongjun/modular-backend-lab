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

The current business module is `order`.

```txt
src/modules/order/
  domain/
  application/
  ports/
  infra/
  http/
  tests/
```

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
```

Run the outbox job:

```bash
pnpm worker:outbox
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
