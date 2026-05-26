# Add Domain Module

## Purpose

Add a new business module without coupling it to adapters.

## When To Use

Use when introducing a new bounded business area such as catalog, cart, payment, shipping, warehouse,
or accounting.

## Required Reading

- `AGENTS.md`
- `docs/03-domain-module-guide.md`
- `docs/02-dependency-rules.md`
- `docs/18-type-safety-policy.md`

## Steps

1. Optionally run `pnpm scaffold:module <module-name>` to create the standard folders and empty
   boundary indexes.
2. Model pure domain types and behavior first.
3. Add usecases and ports before adapters.
4. Add adapter code behind ports.
5. Add risk-based tests.
6. Model states, errors, and events with precise TypeScript unions where useful.
7. Treat the scaffold as a starting point only; do not generate domain rules from folder names.

## Files Usually Touched

- `src/modules/<module>/domain/*`
- `src/modules/<module>/application/*`
- `src/modules/<module>/ports/*`
- `src/modules/<module>/tests/*`

## Tests/Checks To Run

- `pnpm typecheck`
- `pnpm test`
- `pnpm arch:check`
- `pnpm conventions:scan`

## Forbidden Patterns

- Framework imports in domain/application.
- Another module's `infra` or `http` imports.
- DB rows as domain models.
- Custom framework layers, runtime module registries, or DI containers to hide explicit wiring.
- `any`, `as any`, broad casts, or non-null assertions to bypass modeling.

## Definition Of Done

The module has clear boundaries, behavior tests for meaningful rules, precise types for important
states/errors/events, and all relevant checks pass.
