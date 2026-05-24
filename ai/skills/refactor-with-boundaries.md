# Refactor With Boundaries

## Purpose

Improve structure while preserving architecture rules and observable behavior.

## When To Use

Use for multi-file refactors, moving code between layers, or simplifying abstractions.

## Required Reading

- `AGENTS.md`
- `docs/02-dependency-rules.md`
- `docs/11-review-checklist.md`
- `docs/18-type-safety-policy.md`

## Steps

1. Identify the behavior that must not change.
2. Move code in the smallest coherent increments.
3. Run focused tests after each meaningful move.
4. Run architecture and convention checks.
5. Update docs only for policy changes.
6. Treat type errors as model feedback, not compiler noise.

## Files Usually Touched

- Source files in the affected module or adapter.
- Tests that verify unchanged behavior.

## Tests/Checks To Run

- `pnpm test`
- `pnpm typecheck`
- `pnpm arch:check`
- `pnpm conventions:scan`

## Forbidden Patterns

- Boundary weakening to make imports convenient.
- Hidden global service locators.
- Unrelated cleanup mixed into behavior changes.
- `any`, `as any`, broad casts, or weaker compiler settings to make the refactor pass.

## Definition Of Done

Behavior remains covered, boundaries are no weaker, type safety is preserved or improved, and quality
gates pass.
