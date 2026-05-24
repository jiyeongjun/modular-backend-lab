# Run Quality Gates

## Purpose

Verify the repository before handoff.

## When To Use

Use before claiming a feature, refactor, or bootstrap is complete.

## Required Reading

- `docs/17-definition-of-done.md`
- `docs/18-type-safety-policy.md`

## Steps

1. Run `pnpm typecheck`.
2. Run `pnpm check`.
3. Run `pnpm test`.
4. Run `pnpm arch:check`.
5. Run `pnpm conventions:scan`.
6. Run `pnpm build`.
7. Confirm strict TypeScript settings were not weakened.
8. Report exact failures or unavailable dependencies.

## Files Usually Touched

- None unless repairs are needed.

## Tests/Checks To Run

- `pnpm quality`

## Forbidden Patterns

- Claiming checks passed without running them.
- Hiding skipped integration tests.
- Treating formatting changes as behavior verification.
- Claiming type safety when `any` or unsafe casts were introduced without justification.

## Definition Of Done

The executed commands and exact results are known and reported.
