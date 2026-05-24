# modular-backend-lab

오래 유지되는 비즈니스 백엔드를 위한 production-grade modular TypeScript reference architecture입니다.

Production-grade modular TypeScript backend reference architecture for long-lived business systems.

## 아키텍처 요약 / Architecture Summary

핵심 규칙은 단순합니다. 어댑터는 바깥 경계에 두고, 비즈니스 동작은 portable core에 둡니다.

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

## 기술 스택 / Tech Stack

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

## 왜 이런 경계를 두는가 / Why These Boundaries

Hono는 HTTP 요청/응답만 다루는 얇은 delivery adapter입니다. Hono Context는 application/domain
코드로 들어가지 않습니다.

Hono stays as a thin delivery adapter. Hono Context never enters application or domain code.

Kysely는 typed SQL을 제공하지만 persistence adapter에만 머뭅니다. DB row는 domain model로 직접
쓰지 않고 mapper를 통해 명시적으로 변환합니다.

Kysely provides typed SQL but remains a persistence adapter. DB rows are explicitly mapped to domain
models.

Queue backend는 포트 뒤에 격리됩니다. Core processor는 BullMQ, SQS, Redis, Valkey를 직접 알지
않습니다.

Queue backends are isolated behind ports. Core processors do not know BullMQ, SQS, Redis, or Valkey.

OpenTelemetry와 Grafana stack은 runtime instrumentation 경계입니다. 순수 domain logic은 logging,
metrics, traces를 직접 수행하지 않습니다.

OpenTelemetry and Grafana are runtime instrumentation boundaries. Pure domain logic does not log,
emit metrics, or start traces directly.

## 폴더 구조 / Folder Structure

```txt
src/shared      작은 공용 primitive / small reusable primitives
src/infra       config, DB, logging, telemetry, queue adapters
src/http        Hono app, middleware, delivery routes
src/modules     business modules
src/jobs        batch and outbox processors
src/workers     runtime entrypoints and scheduler adapters
docs            architecture and maintenance policy
ai/skills       operational playbooks for future AI agents
```

현재 비즈니스 모듈은 `order` 하나입니다.

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

## 로컬 실행 / Local Setup

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm dev
```

예시 요청 / Example request:

```bash
curl -X POST http://localhost:3000/orders/order-1/pay
```

Outbox job 실행 / Run the outbox job:

```bash
pnpm worker:outbox
```

## 관측성 / Observability

```bash
pnpm observability:up
```

- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200
- Loki: http://localhost:3100

서비스는 `/metrics`에서 Prometheus metrics를 노출하고, OTLP traces/metrics를
`OTEL_EXPORTER_OTLP_ENDPOINT`로 export할 수 있습니다.

The service exposes Prometheus metrics at `/metrics` and can export OTLP traces/metrics to
`OTEL_EXPORTER_OTLP_ENDPOINT`.

## 환경 변수 / Environment

모든 변수는 `.env.example`을 참고하세요. 환경 변수 직접 접근은 `src/infra/config/env.ts`에서만
허용됩니다.

See `.env.example` for all variables. Only `src/infra/config/env.ts` may read environment variables.

## 명령어 / Commands

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
pnpm quality
```

개발 서버 / Development server:

```bash
pnpm dev
pnpm dev:worker
```

DB migration:

```bash
pnpm db:migrate
pnpm db:rollback
```

## 테스트 전략 / Testing Strategy

테스트는 risk-based, behavior-first입니다. 함수가 있다는 이유만으로 테스트하지 않습니다.

Tests are risk-based and behavior-first. A function existing is not enough reason to test it.

이 레포는 domain behavior tests, usecase orchestration tests, Hono route contract tests, outbox job
tests, Docker-backed PostgreSQL integration tests를 포함합니다.

This repository includes domain behavior tests, usecase orchestration tests, Hono route contract
tests, outbox job tests, and Docker-backed PostgreSQL integration tests.

Docker가 없으면 integration test는 실행 가능한 상태로 남기고 명시적으로 gate됩니다.

If Docker is unavailable, integration tests remain runnable and are explicitly gated.

## 확장 정책 / Expansion Policy

새 모듈은 기존 layer shape를 따라 추가합니다. 다른 모듈의 `infra` 또는 `http` layer를 직접
공유하지 않습니다.

Add new modules by following the existing layer shape. Do not directly share another module's `infra`
or `http` layer.

Core logic은 usecase, port, domain event를 통해 협력합니다.

Core logic communicates through usecases, ports, and domain events.

큰 batch workload는 `AsyncIterable`을 사용합니다. 일반적인 bounded HTTP read는 `Promise<T>` 또는
`Promise<T[]>`를 사용합니다.

Large batch workloads use `AsyncIterable`. Normal bounded HTTP reads use `Promise<T>` or
`Promise<T[]>`.

## AI 유지보수 정책 / AI Maintenance Policy

`AGENTS.md`가 source of truth입니다. 미래의 agent는 먼저 `AGENTS.md`를 읽고, 관련 `docs/` 문서와
`ai/skills/*.md` playbook을 확인해야 합니다.

`AGENTS.md` is the source of truth. Future agents should read it first, then the relevant `docs/`
page and `ai/skills/*.md` playbook.

현재 제공되는 skill:

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

Biome는 style을 잡고, dependency-cruiser는 import direction을 잡고, `convention-scan`은 이
레포만의 architecture/type-safety drift를 잡습니다.

Biome catches style, dependency-cruiser catches import direction, and `convention-scan` catches
repository-specific architecture/type-safety drift.

## Definition of Done

의미 있는 변경은 다음이 만족되어야 완료입니다.

A meaningful change is done when these pass:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
```

그리고 TypeScript strictness, architecture boundaries, risk-based tests, documentation updates가
유지되어야 합니다.

TypeScript strictness, architecture boundaries, risk-based tests, and documentation updates must be
preserved.
