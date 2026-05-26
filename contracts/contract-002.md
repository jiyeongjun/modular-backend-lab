# Generic Settlement Module

Status: Completed

## Goal

Add a generic `settlement` module that derives order-level settlement readiness from existing
payment, refund, and fulfillment domain events without implementing ERP or accounting rules.

## Scope

- Add a `settlements` projection table and migration.
- Model settlement domain state, events, and business errors in pure TypeScript.
- Add application usecases to sync one order and scan a bounded batch of candidate orders.
- Read source facts from `domain_events` through a settlement source reader port.
- Persist settlement domain events, projection updates, and outbox rows in one UnitOfWork
  transaction.
- Expose HTTP routes for manual sync and lookup.
- Add a scheduler-independent settlement sync job and worker entrypoint.
- Update README Korean and English docs to include settlement.

## Non-Goals

- Do not add ERP/accounting, journal entries, tax, fee, payout, merchant, or provider-specific
  settlement rules.
- Do not import another module's `infra` or `http` layer.
- Do not couple application/domain code to Kysely, Hono, Zod, queue SDKs, or telemetry SDKs.
- Do not introduce a new framework, ORM, effect system, or dependency.

## Completion Criteria

- Settlement sync is idempotent for repeated source facts.
- Settlement becomes ready only after an authorized payment and delivered fulfillment exist.
- Refunded amount and net amount are derived from completed payment refund events.
- Candidate order scanning uses `AsyncIterable` and a bounded batch size.
- Repository integration coverage verifies projection and `domain_events` writes.
- Route and usecase tests cover success, missing source facts, readiness, and lookup.
- `pnpm quality` passes.

## Verification Result

- `pnpm typecheck`: passed.
- `pnpm check`: passed.
- `pnpm test`: 32 files passed, 102 tests passed, 6 Docker prerequisite tests skipped.
- `pnpm test:integration`: 6 files passed, 14 tests passed, 6 Docker prerequisite tests skipped.
- `pnpm arch:check`: passed with no dependency violations.
- `pnpm conventions:scan`: passed.
- `pnpm build`: passed.
- `pnpm quality`: passed.
