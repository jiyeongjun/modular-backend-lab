# Testing Strategy

This repository uses **risk-based, behavior-first testing**.

## Core Rules

1. Do not create tests just because a function exists.
2. Do not mechanically test every pure function.
3. Simple pure functions with obvious behavior and strong type coverage do not require dedicated tests.
4. Tests should focus on business risk and operational risk.
5. Prefer observable behavior over implementation details.
6. Avoid mock-heavy tests that only verify internal call order.
7. Use fakes only when they make application behavior easier to verify without coupling tests to implementation details.
8. Prefer real infrastructure integration tests for persistence and queue boundaries when practical.
9. Tests should survive refactoring.
10. Tests should fail when business behavior changes incorrectly.

## High-Risk Areas

- complex business rules
- state transitions
- monetary logic
- inventory logic
- accounting logic
- authorization decisions
- usecase orchestration
- transaction boundaries
- idempotency
- concurrency-sensitive behavior
- outbox/event behavior
- batch restartability
- repository/database behavior
- HTTP contract behavior
- queue/worker behavior
- observability wiring smoke tests where practical

## Low-Value Tests To Avoid

- trivial getters
- one-line predicates with obvious behavior
- tests that duplicate implementation line-by-line
- mocks that only verify `save` was called exactly once
- call-order tests with no externally visible behavior
- tests for TypeScript type system behavior

## Layer Guidance

Domain tests cover non-trivial business behavior and state transitions. Do not test every helper.

Application tests use fakes sparingly and verify outcomes: persisted state, emitted events, returned
`Result`, failure path behavior, and no writes on failure where relevant. Avoid verifying internal
call order unless order itself is business-critical.

Infra tests should use real integration tests when practical: PostgreSQL/Testcontainers, Valkey for
queue behavior when important, and external systems via sandbox or contract tests.

HTTP tests should verify route contracts: request validation, response status, response body shape,
and error mapping.

When route tests exercise the composed Hono app, use `test/http/create-test-app.ts` so the test
provides only the usecases it cares about. The factory's default usecases throw if an unrelated route
is accidentally hit.

Batch/job tests should exercise processors without a real scheduler. Test `AsyncIterable`
processing, idempotency, retry/failure behavior, and bounded processing.

Observability tests should be lightweight smoke tests only when valuable. Do not over-test telemetry
SDK internals.
