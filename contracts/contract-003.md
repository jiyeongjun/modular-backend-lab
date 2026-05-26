---
task: "Add inventory module with reservations, concurrency, HTTP routes, and expiration job"
status: "done"
knowns:
  - "The order module is the current reference module."
  - "The inventory module should demonstrate richer domain modeling with discriminated unions."
  - "Architecture boundaries, strict TypeScript, and quality gates must remain intact."
unknowns:
  - "None."
next_step: "Hand off final results."
updated_at: "2026-05-26T03:46:00.000Z"
---

## Inputs

- User request to add the recommended next module.
- Existing `order` module and repository architecture rules.

## Completion Criteria

- `src/modules/inventory` exists with domain, application, ports, infra, HTTP, and risk-based tests.
- Inventory domain models stock and reservations with precise types and state-specific invariants.
- Usecases support reserve, release, commit, and expire flows through explicit UnitOfWork ports.
- Kysely migration/types/repositories map DB rows explicitly and enforce optimistic concurrency.
- HTTP routes expose reserve/release/commit as thin Hono adapters.
- Expiration job processes expired reservations through `AsyncIterable` without scheduler coupling.
- README module list reflects `inventory`.
- `pnpm quality` passes.

## Mutation Plan

- Add database migration and database types for inventory tables.
- Add domain types, events, errors, and pure transition logic.
- Add application usecases and ports.
- Add Kysely mappers, repositories, and unit of work.
- Wire HTTP routes and app/main composition.
- Add expiration job and tests.
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
- Implemented inventory domain, usecases, ports, Kysely adapters, HTTP routes, expiration job, tests, migration, and README updates.
- Ran `pnpm quality` successfully.

## Result

- Done. Inventory module is implemented and quality gates pass.
