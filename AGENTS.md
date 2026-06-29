# Agent Instructions

This file is the source of truth for AI-assisted maintenance in `modular-backend-lab`.

## Purpose

This repository is a production-grade modular TypeScript backend reference architecture. Future work
should make it easier to add domains, usecases, repositories, routes, jobs, schedulers, queue
adapters, and observability signals without breaking long-term boundaries.

## Conceptual Model

```txt
Hono = delivery adapter
Kysely = persistence adapter
Scheduler/Worker = delivery/runtime adapter
BullMQ/SQS/MSK = queue/event backend adapter candidates
Valkey = local Redis-compatible infrastructure
OpenTelemetry = telemetry instrumentation boundary
Grafana stack = local observability runtime
Domain/Application = portable core
TypeScript compiler = first-line architecture guard
```

## Non-Negotiable Rules

1. Hono is a delivery adapter only.
2. Kysely is a persistence adapter only.
3. Scheduler and worker runtime are delivery/runtime adapters only.
4. BullMQ, SQS, and MSK are queue/event backend adapters only.
5. Valkey is local Redis-compatible infrastructure, not domain logic.
6. OpenTelemetry is instrumentation boundary, not business logic.
7. Grafana, Prometheus, Tempo, Loki, and Alloy are local observability runtime.
8. Domain logic must be pure.
9. Domain code must not import Hono, Kysely, Zod, Pino, OpenTelemetry SDKs, BullMQ, SQS SDKs, Kafka/MSK clients, Redis/Valkey clients, Node HTTP types, or infra code.
10. Application code must not import Hono, Hono Context, Kysely, queue backend implementations, or OpenTelemetry SDKs.
11. Application code should depend on ports/interfaces, not concrete infra implementations.
12. Kysely must be used only in infra persistence code.
13. Hono Context must never be passed into application or domain code.
14. Zod schemas are boundary validators only.
15. DB rows must be mapped to domain models explicitly.
16. Usecases must receive plain command objects.
17. Expected business failures must return `Result`.
18. Unexpected system/programmer failures may throw.
19. Transactions must be explicit.
20. Cross-module communication must not import another module's `infra` or `http` layer.
21. Domain events or application orchestration should be used for cross-module workflows.
22. New modules must follow the established module structure unless a documented reason exists.
23. Batch jobs must not load unbounded datasets into arrays.
24. Large or unbounded data processing should use `AsyncIterable`.
25. Concurrency must be explicit and bounded.
26. Tests must be risk-based and behavior-first.
27. Do not test trivial pure functions just because they exist.
28. Avoid mock-heavy tests that verify implementation details.
29. Documentation must be updated when architecture, conventions, or module behavior changes.
30. Do not introduce heavy abstractions without a documented reason.
31. Do not add libraries when native TypeScript is enough.
32. Do not use unstable dependency versions.
33. TypeScript strict mode must remain enabled.
34. Prefer compile-time guarantees over runtime conventions whenever TypeScript can model the constraint clearly.
35. Do not weaken `tsconfig.json`.
36. Do not introduce `any` unless there is a documented boundary-specific reason.
37. Prefer `unknown` at untrusted boundaries, then validate and narrow.
38. Avoid unsafe type assertions and non-null assertions.
39. Prefer discriminated unions for domain states, errors, events, and command results.
40. Use exhaustive checks for discriminated unions.
41. Do not silence the compiler to make code pass.
42. Run quality gates before declaring completion.

## Module Structure

```txt
src/modules/{module-name}/
  domain/
    {entity}.ts
    {entity}.logic.ts
    {entity}.errors.ts
    {entity}.events.ts
    index.ts
  application/
    {usecase}.usecase.ts
    index.ts
  ports/
    {entity}.repository.ts
    {module}-unit-of-work.ts
    index.ts
  infra/
    {entity}.mapper.ts
    {entity}.repository.kysely.ts
    {module}-unit-of-work.kysely.ts
    index.ts
  http/
    {module}.routes.ts
    {module}.schemas.ts
    {module}.response.ts
    index.ts
  tests/
    {entity}.behavior.test.ts
    {usecase}.usecase.test.ts
    {module}.routes.test.ts
    {entity}.repository.integration.test.ts
```

Small modules may omit genuinely unnecessary files, but they must not violate dependency direction.

## Dependency Direction

Allowed:

```txt
domain      -> shared
application -> domain, ports, shared
ports       -> domain, shared
infra       -> domain, ports, shared, infra/db, infra/logger, infra/queue, infra/telemetry
http        -> application, shared, http middleware
jobs        -> application, ports, shared
workers     -> jobs, infra adapters, composition root
main        -> http, infra, application composition
```

Forbidden:

```txt
domain      -> application, ports, infra, http, jobs, workers
application -> infra, http, jobs, workers
ports       -> infra, http, jobs, workers
infra       -> http
shared      -> modules
jobs        -> http
workers     -> domain business logic
module A    -> module B infra/http
```

If dependency-cruiser cannot enforce a rule perfectly, it remains a manual review rule.

## Layer Guidance

Domain code uses plain TypeScript types and pure functions. It receives time, randomness, and IDs from
outside; returns new immutable state; returns `Result` for expected business errors; may return
serializable domain events; and performs no IO, logging, telemetry, environment access, DB access,
HTTP work, queue work, or scheduler work.

Application usecases orchestrate domain functions, call repositories and external systems through
ports, manage transactions through UnitOfWork/transaction ports, accept plain command objects, and
return `Result` for expected failures. They do not parse HTTP requests and do not know about route
params, headers, or cookies directly.

Infrastructure implements ports, Kysely repositories, row/domain mappers, transaction-scoped
repositories, queue adapters, logging, telemetry, and config. It must not contain domain business
rules or return raw DB rows as domain models.

HTTP code uses Hono and Zod to validate transport input, convert it to command objects, call
application usecases, and map `Result` to HTTP responses. It never passes Hono Context inward.

Jobs process large or scheduled work. Workers and schedulers only trigger jobs or application
commands.

## Validation

Zod is used at boundaries: HTTP params, query, body, environment config, and external webhook
payloads. Zod schemas must not become domain models. Validated input is converted to application
commands or explicit DTOs before entering core logic.

## Errors And Transactions

Domain/business errors and expected application failures return `Result`. Infrastructure and
programmer errors may throw. HTTP mapping happens only in HTTP code.

Transactions are started by application orchestration through UnitOfWork/transaction ports. Kysely
transactions never leak into domain/application. Outbox writes must happen in the same DB transaction
as aggregate state changes. External API calls inside transactions require explicit justification.

## Outbox, Queue, And Scheduler

Domain functions may return serializable domain events. Application usecases decide whether to
persist them. Background publishing happens outside the core domain model and must be idempotent or
safely retryable.

BullMQ runs on Valkey locally and remains the default developer/runtime verification path. SQS
replaces the queue layer for simple AWS-style async work. MSK is a future managed event-stream
backbone candidate for mature event-driven MSA deployments, not the default local path. Core
processors must not import queue SDKs, Kafka/MSK clients, or Redis-compatible clients. Worker
handlers parse message to command to application/job processor.

Schedulers are delivery adapters. Production options include cron, Kubernetes CronJob, Cloud
Scheduler, EventBridge Scheduler, Temporal, BullMQ repeatable jobs, and queue-triggered workers.

## Batch And AsyncIterable

```txt
Bounded request/response API data -> Promise<T> or Promise<T[]>
Large/unbounded data processing -> AsyncIterable<T>
```

Use native async generators and the shared iterable utilities for full scans, imports/exports, outbox
publishing, event replay, settlement, notification batches, cleanup jobs, and external paginated API
ingestion. Do not use `AsyncIterable` everywhere.

## Testing

Tests are risk-based and behavior-first. Add tests for complex rules, state transitions, monetary or
inventory logic, authorization decisions, usecase orchestration, transaction boundaries, idempotency,
concurrency-sensitive behavior, outbox/event behavior, batch restartability, repository/database
behavior, HTTP contracts, queue/worker behavior, and useful observability smoke tests.

Avoid trivial getter tests, one-line predicate tests with obvious behavior, implementation-detail mock
tests, and tests that duplicate implementation line-by-line.

## Type Safety

TypeScript is the first-line architecture guard. Preserve strict compiler settings, prefer precise
domain types, separate DB rows from domain models, separate HTTP DTOs from application commands, use
discriminated unions and exhaustive checks, and treat untrusted input as `unknown` until validated.

When a type error appears, fix the model or boundary conversion. Do not paper over it with `as any`,
broad casts, non-null assertions, or weaker compiler settings.

## Dependency And Tooling Policy

Use stable exact dependency versions through pnpm. Prefer native TypeScript and Node APIs before
adding dependencies. Do not add Prettier. Do not add ESLint unless Biome cannot enforce a required
rule and the reason is documented. Architecture boundaries belong to dependency-cruiser; repository
specific conventions belong to `scripts/convention-scan.ts`.

## AI Workflow

Before editing:

1. Inspect existing module patterns.
2. Read the relevant `ai/skills/*.md` playbook.
3. Use `ai/skills/use-codegraph.md` before broad code exploration, flow tracing, or refactor planning.
4. Identify the target layer.
5. Preserve dependency direction.
6. Make the smallest coherent change.
7. Preserve strict TypeScript settings.
8. Prefer compile-time guarantees over runtime conventions when practical.
9. Prefer native TypeScript before new dependencies.
10. Add tests based on risk, not file count.
11. Avoid mock-heavy implementation-detail tests.
12. Update docs when conventions change.
13. Run typecheck, Biome check, tests, architecture check, convention scan, and build.
14. Report what changed and what could not be verified.

## Forbidden Defaults

Do not add NestJS, Express, Fastify, Prisma, TypeORM, MikroORM, Sequelize, Drizzle, Effect, fp-ts,
RxJS, IxJS, FxTS, Remeda, Lodash, DI containers, decorators, global service locators, class-heavy
enterprise base frameworks, unbounded arrays for batch jobs, queue-specific code in core logic,
telemetry SDKs in domain/application, or tests only to satisfy a coverage number.

Do not replace discriminated unions with stringly typed error/status objects. Do not claim checks
passed without running them.

## Quality Gates

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
```

Run `pnpm quality` before claiming the repository is healthy. For persistence changes, run
`pnpm test:integration` when Docker is available. If any verification cannot run, report the exact
reason.
