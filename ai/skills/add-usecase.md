# Add Usecase

## Purpose

Add application orchestration around domain behavior.

## When To Use

Use when work needs transactions, persistence, ports, outbox writes, or expected failure mapping.

## Required Reading

- `docs/04-error-handling.md`
- `docs/05-transaction-policy.md`
- `docs/18-type-safety-policy.md`

## Steps

1. Define a plain command object.
2. Inject dependencies explicitly.
3. Use a unit-of-work port when state changes must be atomic.
4. Return `Result` for expected failures.
5. Test observable outcomes with fakes.
6. Keep commands and results explicitly typed.

## Files Usually Touched

- `src/modules/<module>/application/*.usecase.ts`
- `src/modules/<module>/ports/*`
- `src/modules/<module>/tests/*.test.ts`

## Tests/Checks To Run

- `pnpm test:unit`
- `pnpm typecheck`
- `pnpm conventions:scan`

## Forbidden Patterns

- Hono Context parameters.
- Kysely imports.
- Zod schemas as commands.
- Queue or telemetry SDK imports.
- `any`, `as any`, broad casts, or non-null assertions to bypass type errors.

## Definition Of Done

The usecase is framework-independent, transaction-aware where needed, precisely typed, and tested by
behavior.
