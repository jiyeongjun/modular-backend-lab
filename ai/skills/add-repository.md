# Add Repository

## Purpose

Implement persistence behind a port with explicit row/domain mapping.

## When To Use

Use when adding a new table-backed persistence adapter.

## Required Reading

- `docs/05-transaction-policy.md`
- `docs/06-testing-strategy.md`
- `docs/18-type-safety-policy.md`

## Steps

1. Define or extend the port first.
2. Add Kysely database types and migration changes.
3. Write row-to-domain and domain-to-row mappers.
4. Implement the repository in `infra`.
5. Use `src/infra/outbox/outbox-event.mapper.ts` for ordinary `outbox_events` insert conversion
   when the event shape matches the shared contract.
6. Add integration tests when behavior is meaningful.
7. Keep DB row, insert/update, and domain types separate.

## Files Usually Touched

- `src/infra/db/database.ts`
- `src/infra/db/migrations/*`
- `src/modules/<module>/ports/*`
- `src/modules/<module>/infra/*`
- `src/modules/<module>/tests/*.integration.test.ts`

## Tests/Checks To Run

- `pnpm test:integration`
- `pnpm typecheck`
- `pnpm arch:check`

## Forbidden Patterns

- Returning DB rows as domain models.
- Kysely imports in application/domain.
- Long transactions around external calls.
- Reusing row types as domain models.
- Moving domain event definitions into infra-only helpers.

## Definition Of Done

The repository is behind a port, maps rows explicitly, keeps persistence/domain types separate, and
has integration coverage for risk-bearing behavior.
