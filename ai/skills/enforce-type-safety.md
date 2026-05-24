# Enforce Type Safety

## Purpose

Strengthen compile-time feedback and prevent unsafe TypeScript shortcuts from weakening architecture.

## When To Use

Use when fixing type errors, adding domain states/errors/events, changing DTOs or commands, touching
`tsconfig.json`, reviewing unsafe casts, or handling untrusted input.

## Required Reading

- `AGENTS.md`
- `docs/18-type-safety-policy.md`
- `docs/11-review-checklist.md`

## Steps

1. Run or inspect `pnpm typecheck` output.
2. Identify whether the error is a model issue, boundary narrowing issue, or local implementation issue.
3. Prefer precise types, discriminated unions, literal unions, and explicit return types.
4. Use `unknown` at untrusted boundaries, then validate and narrow with Zod or a local parser.
5. Keep DB rows separate from domain models and HTTP DTOs separate from application commands.
6. Use exhaustive checks for union mappers.
7. Remove `any`, `as any`, broad casts, and unjustified non-null assertions.
8. Keep `tsconfig.json` strictness unchanged or stronger.
9. Run `pnpm typecheck` and `pnpm conventions:scan`.

## Files Usually Touched

- `tsconfig.json`
- `src/shared/*`
- `src/modules/*/domain/*`
- `src/modules/*/application/*`
- `src/modules/*/http/*`
- `src/modules/*/infra/*.mapper.ts`
- `scripts/convention-scan.ts`

## Tests/Checks To Run

- `pnpm typecheck`
- `pnpm conventions:scan`
- `pnpm test` when behavior changes
- `pnpm arch:check` when imports change

## Forbidden Patterns

- Weakening strict compiler options.
- Adding `any` or `as any` to silence the compiler.
- Casting raw request bodies directly to commands.
- Treating DB rows as domain models.
- Replacing discriminated unions with stringly typed error objects.
- Adding type tricks that obscure the domain.

## Definition Of Done

Typecheck passes, strictness is preserved, unsafe escape hatches are removed or tightly documented at
boundaries, and the resulting types make invalid states harder to represent.
