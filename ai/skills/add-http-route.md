# Add HTTP Route

## Purpose

Expose a usecase through Hono without moving business rules into HTTP.

## When To Use

Use when adding or changing an API endpoint.

## Required Reading

- `docs/02-dependency-rules.md`
- `docs/04-error-handling.md`
- `docs/18-type-safety-policy.md`

## Steps

1. Validate params, query, body, or headers with Zod.
2. Build a plain command object.
3. Call the usecase.
4. Map `Result` to HTTP status and response body.
5. Add `app.request` route tests, using `test/http/create-test-app.ts` when testing the full app.
6. Narrow untrusted input with Zod before creating commands.

## Files Usually Touched

- `src/modules/<module>/http/*.routes.ts`
- `src/modules/<module>/http/*.schemas.ts`
- `src/modules/<module>/http/*.response.ts`
- `src/modules/<module>/tests/*.routes.test.ts`

## Tests/Checks To Run

- `pnpm test:unit`
- `pnpm typecheck`

## Forbidden Patterns

- Hono Context passed to application/domain code.
- Business rules in routes.
- Direct DB or queue calls in route handlers.
- Casting raw request input directly to application commands.
- Duplicating unrelated usecase stubs when the route-test app factory can provide default failures.

## Definition Of Done

The route validates input, builds typed commands, calls one usecase, maps all expected outcomes, and
has route contract tests.
