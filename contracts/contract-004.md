---
task: "Add payment module with Toss Payments adapter"
status: "done"
knowns:
  - "Toss Payments is the first real PG adapter for this module."
  - "The payment core must not depend on Toss-specific request or response types."
  - "Existing inventory changes are uncommitted and must be preserved."
unknowns:
  - "Live Toss sandbox credentials are not available in the repository."
next_step: "Hand off final results."
updated_at: "2026-05-26T04:20:00.000Z"
---

## Inputs

- User request to replace the Korean README introduction sentence.
- User request to start the payment module after reviewing external PG/test API options.
- Toss Payments official docs for confirm/cancel endpoints, Basic auth, idempotency headers, and webhooks.
- Existing `order` and `inventory` module patterns.

## Completion Criteria

- Korean README introduction uses the requested sentence.
- `src/modules/payment` exists with domain, application, ports, infra, HTTP, and risk-based tests.
- Payment domain models state transitions with discriminated unions and pure functions.
- Application usecases confirm and cancel payments through explicit ports and UnitOfWork transaction boundaries.
- Toss Payments API integration is isolated behind a `PaymentGateway` infra adapter.
- Kysely migration/types/repositories map DB rows explicitly and preserve optimistic concurrency.
- HTTP routes validate transport input, build plain commands, and map expected failures to responses.
- README module list and configuration notes reflect the payment module.
- `pnpm quality` passes.

## Mutation Plan

- Update README introduction.
- Add payment database migration and database types.
- Add domain types, events, errors, and pure transition logic.
- Add application usecases and ports for payment persistence, outbox, unit of work, gateway, and idempotency.
- Add Kysely mappers, repositories, and unit of work.
- Add Toss Payments gateway using `fetch`, env config, Basic auth, and `Idempotency-Key`.
- Wire HTTP routes and app/main composition.
- Add behavior/usecase/route/repository tests with fake gateway coverage.
- Run quality gates and repair issues.

## Verification

- `pnpm typecheck`
- `pnpm check`
- `pnpm test`
- `pnpm arch:check`
- `pnpm conventions:scan`
- `pnpm build`

## Work Log

- Contract aligned.
- Updated Korean README introduction sentence.
- Implemented payment domain, usecases, ports, Kysely persistence, Toss Payments gateway, HTTP routes, tests, migration, config, and docs.
- Ran `pnpm quality` successfully.

## Result

- Done. Payment module is implemented and quality gates pass.
