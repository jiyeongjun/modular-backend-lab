# modular-backend-lab

비즈니스 도메인이 점진적으로 늘어나는 백엔드를 가정한 모듈형 TypeScript reference architecture입니다.

[English README](./README.en.md)

## 아키텍처 요약

핵심 규칙은 단순합니다. 어댑터는 바깥 경계에 두고, 비즈니스 동작은 portable core에 둡니다.

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

## 설계 철학

이 레포는 명시적인 경계를 중심으로 구성되어 있습니다. Domain/application core는 portable하게
두고, infrastructure는 adapter로 분리하며, transaction, boundary validation, quality gate를
명확하게 드러내는 구조를 기준으로 합니다.

### 안전성

- TypeScript strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`로 타입 피드백을
  먼저 받습니다.
- Zod는 HTTP/env/external payload 같은 boundary validation에만 사용합니다.
- 예상 가능한 비즈니스 실패는 exception이 아니라 `Result`로 반환합니다.
- 상태 변경과 outbox write는 explicit UnitOfWork transaction 안에서 처리합니다.
- dependency-cruiser와 `scripts/convention-scan.ts`가 framework/infra leakage, unsafe casts,
  strictness 약화를 검사합니다.

### 성능 의식

- Hono를 얇은 HTTP adapter로 두어 request handling과 coupling을 작게 유지합니다.
- Kysely를 사용해 heavy ORM abstraction 없이 명시적인 SQL 경계를 유지합니다.
- 큰 batch workload는 `AsyncIterable`로 streaming 처리하고, concurrency는 명시적으로 제한합니다.
- Outbox publisher는 외부 publish를 긴 DB transaction 안에서 수행하지 않도록 분리되어 있습니다.
- Prometheus/OpenTelemetry wiring을 포함해 latency, request count, runtime signal을 관찰할 수 있게
  했습니다.

### 지속 가능성

- Domain, application, ports, infra, HTTP, jobs, workers를 분리해 모듈이 늘어나도 변경 범위를 좁게
  유지합니다.
- `AGENTS.md`, `docs/`, `ai/skills/`가 future AI/human maintenance rule을 문서화합니다.
- Biome, dependency-cruiser, convention scanner, CI quality gate가 반복 가능한 검증 경로를 제공합니다.
- dependency는 exact version과 lockfile로 고정하고, Node Active LTS 정책을 문서화했습니다.
- 테스트는 파일 수가 아니라 risk와 observable behavior 기준으로 추가합니다.

## 기술 스택

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

## 왜 이런 경계를 두는가

Hono는 HTTP 요청/응답만 다루는 얇은 delivery adapter입니다. Hono Context는 application/domain
코드로 들어가지 않습니다.

Kysely는 typed SQL을 제공하지만 persistence adapter에만 머뭅니다. DB row는 domain model로 직접
쓰지 않고 mapper를 통해 명시적으로 변환합니다.

Queue backend는 포트 뒤에 격리됩니다. Core processor는 BullMQ, SQS, Redis, Valkey를 직접 알지
않습니다.

OpenTelemetry와 Grafana stack은 runtime instrumentation 경계입니다. 순수 domain logic은 logging,
metrics, traces를 직접 수행하지 않습니다.

## 폴더 구조

```txt
src/shared      작은 공용 primitive
src/infra       config, DB, logging, telemetry, queue adapters
src/http        Hono app, middleware, delivery routes
src/modules     business modules
src/jobs        batch and outbox processors
src/workers     runtime entrypoints and scheduler adapters
docs            architecture and maintenance policy
ai/skills       operational playbooks for future AI agents
```

현재 비즈니스 모듈은 `order` 하나입니다.

```txt
src/modules/order/
  domain/
  application/
  ports/
  infra/
  http/
  tests/
```

## 로컬 실행

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm dev
```

예시 요청:

```bash
curl -X POST http://localhost:3000/orders/order-1/pay
```

Outbox job 실행:

```bash
pnpm worker:outbox
```

## 관측성

```bash
pnpm observability:up
```

- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200
- Loki: http://localhost:3100

서비스는 `/metrics`에서 Prometheus metrics를 노출하고, OTLP traces/metrics를
`OTEL_EXPORTER_OTLP_ENDPOINT`로 export할 수 있습니다.

## 환경 변수

모든 변수는 `.env.example`을 참고하세요. 환경 변수 직접 접근은 `src/infra/config/env.ts`에서만
허용됩니다.

## 명령어

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
pnpm quality
```

개발 서버:

```bash
pnpm dev
pnpm dev:worker
```

DB migration:

```bash
pnpm db:migrate
pnpm db:rollback
```

## 테스트 전략

테스트는 risk-based, behavior-first입니다. 함수가 있다는 이유만으로 테스트하지 않습니다.

이 레포는 domain behavior tests, usecase orchestration tests, Hono route contract tests, outbox job
tests, Docker-backed PostgreSQL integration tests를 포함합니다.

Docker가 없으면 integration test는 실행 가능한 상태로 남기고 명시적으로 gate됩니다.

## 확장 정책

새 모듈은 기존 layer shape를 따라 추가합니다. 다른 모듈의 `infra` 또는 `http` layer를 직접
공유하지 않습니다.

Core logic은 usecase, port, domain event를 통해 협력합니다.

큰 batch workload는 `AsyncIterable`을 사용합니다. 일반적인 bounded HTTP read는 `Promise<T>` 또는
`Promise<T[]>`를 사용합니다.

## AI 유지보수 정책

`AGENTS.md`가 source of truth입니다. 미래의 agent는 먼저 `AGENTS.md`를 읽고, 관련 `docs/` 문서와
`ai/skills/*.md` playbook을 확인해야 합니다.

현재 제공되는 skill:

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

## Definition of Done

의미 있는 변경은 다음이 만족되어야 완료입니다.

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
