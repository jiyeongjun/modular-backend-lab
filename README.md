# modular-backend-lab

Production-grade modular TypeScript backend reference architecture for long-lived business systems.

## Architecture Summary

The core rule is simple: adapters stay at the edge and business behavior stays portable.

```txt
HTTP / Workers / Scheduler
        |
Application usecases
        |
Domain logic + ports
        |
Infrastructure adapters
```

- Hono is a delivery adapter.
- Kysely is a persistence adapter.
- BullMQ and SQS are queue adapters.
- Valkey is local Redis-compatible infrastructure.
- OpenTelemetry and Grafana are instrumentation/runtime boundaries.

## Tech Stack

- Node.js 24 Active LTS
- TypeScript ESM with strict mode
- pnpm with exact dependency saves
- Hono and `@hono/node-server`
- PostgreSQL, Kysely, `pg`
- Zod for boundary validation
- Pino JSON logging
- OpenTelemetry, Prometheus metrics, Grafana stack
- BullMQ with Valkey locally; SQS documented as the managed AWS alternative
- Vitest and Testcontainers
- Biome and dependency-cruiser

## Why These Boundaries

Hono keeps HTTP concerns small and testable with `app.request`. Kysely gives typed SQL while keeping
rows separate from domain models. Queue backends are isolated so processors can be tested without
Redis, Valkey, BullMQ, or SQS. OpenTelemetry is initialized in infrastructure and does not leak into
domain/application code.

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

## Testing Strategy

Tests are risk-based. The repository includes domain behavior tests, usecase orchestration tests,
Hono route contract tests, outbox job tests, and Docker-backed PostgreSQL integration tests. If
Docker is unavailable, integration tests are left runnable and explicitly gated.

## Expansion Policy

Add new modules by copying the layer shape, not by sharing adapters across modules. Core logic should
communicate through usecases, ports, and domain events. Batch jobs use `AsyncIterable` for large or
unbounded work; bounded HTTP reads can return ordinary promises or arrays.

## AI Coding Policy

`AGENTS.md` is the source of truth. Future agents should read it first, then the relevant `docs/`
page and `ai/skills/*.md` playbook. Biome catches style, dependency-cruiser catches import direction,
and `scripts/convention-scan.ts` catches repository-specific drift.
