# Claude Instructions

Read `AGENTS.md` first. It is the source of truth for architecture, testing, dependency, quality
gate, and type-safety policy in this repository.

## Summary

`modular-backend-lab` is a TypeScript modular backend reference architecture. Hono, Kysely, workers,
queues, and observability are adapters. Domain and application code are portable core logic.

## Common Workflows

- Add a module: read `ai/skills/add-domain-module.md`.
- Add a usecase: read `ai/skills/add-usecase.md`.
- Add an HTTP route: read `ai/skills/add-http-route.md`.
- Add persistence: read `ai/skills/add-repository.md`.
- Add batch/queue/observability: read the matching skill file.
- Fix type drift: read `ai/skills/enforce-type-safety.md`.

## Quality Commands

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
```

Do not weaken TypeScript settings, add `any`, or use unsafe casts to bypass the compiler.
